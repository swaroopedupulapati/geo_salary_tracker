import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import BackgroundJob from 'react-native-background-actions';
import { apiGet, apiPost } from '../api';

export default function EmployeeDashboardScreen({ navigation }) {
    const [userName, setUserName] = useState('');
    const [status, setStatus] = useState('IDLE');
    const [stats, setStats] = useState({ worked_minutes: 0, earned: 0 });
    const [attendance, setAttendance] = useState([]);
    const [screenFlash, setScreenFlash] = useState(false);

    // Map State
    const [location, setLocation] = useState(null);
    const [geofences, setGeofences] = useState([]);
    const [alertIntervalMs, setAlertIntervalMs] = useState(5 * 60 * 1000); // 5 minutes default
    const mapRef = useRef(null);

    // Tracking state
    const [isTracking, setIsTracking] = useState(false);
    const watchIdRef = useRef(null);
    const verifyTimerRef = useRef(null);
    const lastLocationRef = useRef(null);
    const isVerifyFlowActiveRef = useRef(false);

    useEffect(() => {
        loadInitialData();

        return () => {
            stopWork(false); // cleanup on unmount
            if (flashIntervalRef.current) clearInterval(flashIntervalRef.current);
        };
    }, []);

    const flashIntervalRef = useRef(null);

    useEffect(() => {
        if (status === 'NEEDS_VERIFICATION') {
            if (!flashIntervalRef.current) {
                flashIntervalRef.current = setInterval(() => {
                    setScreenFlash(prev => !prev);
                }, 1000); // 1-second flash toggle
            }
        } else {
            if (flashIntervalRef.current) {
                clearInterval(flashIntervalRef.current);
                flashIntervalRef.current = null;
            }
            setScreenFlash(false);
        }
    }, [status]);

    const loadInitialData = async () => {
        const name = await AsyncStorage.getItem('name');
        setUserName(name || '');

        try {
            await notifee.requestPermission();
        } catch (e) { console.log('notifee req perms error', e); }

        // Fetch Geofences
        try {
            const geoRes = await apiGet('/api/geofence');
            if (geoRes.geofences && geoRes.geofences.length > 0) {
                // api returns [[{lat, lng}, ...], ...]
                const formattedFences = geoRes.geofences.map(fence =>
                    fence.map(pt => ({ latitude: pt.lat, longitude: pt.lng }))
                );
                setGeofences(formattedFences);

                // Fetch settings for alert interval (mock API call to me if custom needed, fallback 5m)
                // Ideally we get this together with geofence config
            }

            fetchStats();
            fetchAttendance();

            // Periodically fetch stats
            const statsInterval = setInterval(fetchStats, 60000);
            return () => clearInterval(statsInterval);
        } catch (e) {
            console.error('Geo load error', e);
        }
    };

    const fetchStats = async () => {
        const res = await apiGet('/api/employee/stats');
        if (!res.error) setStats(res);
    };

    const fetchAttendance = async () => {
        const res = await apiGet('/api/attendance');
        if (res.attendance) setAttendance(res.attendance);
    };

    // --- Tracking Logic ---
    const startWork = async () => {
        try {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                {
                    title: 'Location Permission',
                    message: 'GeoWork needs access to your location to track attendance.',
                    buttonNeutral: 'Ask Me Later',
                    buttonNegative: 'Cancel',
                    buttonPositive: 'OK',
                }
            );
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                Alert.alert('Permission Denied', 'Location permission is required to start work.');
                return;
            }
        } catch (err) {
            console.warn(err);
        }

        setIsTracking(true);
        setStatus('Locating...');

        Geolocation.getCurrentPosition(
            (position) => {
                handlePositionUpdate(position);
                sendHeartbeat(position.coords);
            },
            (error) => {
                Alert.alert('Location Error', error.message);
                setIsTracking(false);
                setStatus('IDLE');
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );

        watchIdRef.current = Geolocation.watchPosition(
            handlePositionUpdate,
            (err) => console.warn(err),
            { enableHighAccuracy: true, distanceFilter: 5, interval: 10000, fastestInterval: 5000 }
        );

        // Start Background Job
        const backgroundTask = async (taskDataArguments) => {
            const { delay } = taskDataArguments;
            await new Promise(async (resolve) => {
                for (let i = 0; BackgroundJob.isRunning(); i++) {
                    if (lastLocationRef.current) {
                        try {
                            await sendHeartbeat(lastLocationRef.current, false); // false = no state update in BG
                        } catch (e) {
                            console.log('Background heartbeat failed', e);
                        }
                    }
                    await new Promise(r => setTimeout(r, delay));
                }
                resolve();
            });
        };

        const options = {
            taskName: 'GeoWorkTracking',
            taskTitle: 'GeoWork Tracking Active',
            taskDesc: 'Your attendance is being tracked in the background',
            taskIcon: {
                name: 'ic_launcher',
                type: 'mipmap',
            },
            color: '#10b981',
            parameters: {
                delay: 60000,
            },
        };

        try {
            await BackgroundJob.start(backgroundTask, options);
        } catch (e) {
            console.warn('BackgroundJob start failed', e);
        }

        startVerifyTimer();
    };

    const stopWork = async (notifyServer = true) => {
        setIsTracking(false);
        if (watchIdRef.current !== null) Geolocation.clearWatch(watchIdRef.current);
        if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);

        watchIdRef.current = null;
        verifyTimerRef.current = null;

        try {
            await BackgroundJob.stop();
        } catch (e) { }

        if (notifyServer) {
            await apiPost('/api/stop_tracking', {});
            setStatus('STOPPED');
        }
    };

    const handlePositionUpdate = (pos) => {
        const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setLocation(coords);
        lastLocationRef.current = pos.coords;
        if (mapRef.current) {
            mapRef.current.animateToRegion({
                ...coords,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            });
        }
    };

    const sendHeartbeat = async (coords, updateUIState = true) => {
        try {
            const res = await apiPost('/api/heartbeat', {
                lat: coords.latitude,
                lng: coords.longitude
            });
            if (res.status) {
                if (updateUIState) {
                    setStatus(res.status);
                }
                if (res.status === 'NEEDS_VERIFICATION' && !isVerifyFlowActiveRef.current) {
                    // Navigate to verification modal
                    triggerVerifyFlow();
                } else if (res.status !== 'NEEDS_VERIFICATION') {
                    // Reset flag if we are verified
                    isVerifyFlowActiveRef.current = false;
                }
            }
        } catch (e) {
            console.error('Heartbeat failed', e);
        }
    };

    // --- Verification Timer ---
    const startVerifyTimer = () => {
        if (verifyTimerRef.current) clearTimeout(verifyTimerRef.current);
        verifyTimerRef.current = setTimeout(() => {
            triggerLocalVerification();
        }, alertIntervalMs);
    };

    const triggerLocalVerification = async () => {
        await apiPost('/api/trigger_verification', {});
        setStatus('NEEDS_VERIFICATION');
        if (!isVerifyFlowActiveRef.current) {
            triggerVerifyFlow();
        }
    };

    const triggerVerifyFlow = async () => {
        if (isVerifyFlowActiveRef.current) return;
        isVerifyFlowActiveRef.current = true;

        try {
            const channelId = await notifee.createChannel({
                id: 'verification',
                name: 'Presence Verification',
                importance: AndroidImportance.HIGH,
            });

            await notifee.displayNotification({
                id: 'verify_req',
                title: '⚠️ Verification Required',
                body: 'Are you still active? Please verify your presence.',
                android: {
                    channelId,
                    importance: AndroidImportance.HIGH,
                    pressAction: {
                        id: 'default',
                    },
                },
            });
        } catch (err) {
            console.error('Notification error:', err);
        }

        // Navigate immediately without blocking Alert
        navigation.navigate('VerifyPresence', {
            onVerified: async () => {
                setStatus('INSIDE'); // Optimistic
                isVerifyFlowActiveRef.current = false;
                await notifee.cancelNotification('verify_req');
                startVerifyTimer();
            }
        });
    };

    const handleLogout = async () => {
        await stopWork(true);
        await apiPost('/api/logout', {});
        await AsyncStorage.clear();
        navigation.replace('Login');
    };

    // Render helpers
    const getStatusColor = () => {
        if (status.includes('INSIDE')) return '#10b981';
        if (status === 'NEEDS_VERIFICATION') return '#f59e0b';
        if (status.includes('OUTSIDE')) return '#ef4444';
        return '#64748b';
    };

    const defaultRegion = geofences[0]?.[0]
        ? { latitude: geofences[0][0].latitude, longitude: geofences[0][0].longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
        : { latitude: 15.4796, longitude: 80.0215, latitudeDelta: 0.01, longitudeDelta: 0.01 };

    const mapHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <style>
        body { padding: 0; margin: 0; }
        #map { height: 100vh; width: 100vw; }
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        var map = L.map('map', { attributionControl: false }).setView([${defaultRegion.latitude}, ${defaultRegion.longitude}], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        
        var geofences = ${JSON.stringify(geofences)};
        geofences.forEach(function(fence) {
            var latlngs = fence.map(function(pt) { return [pt.latitude, pt.longitude]; });
            L.polygon(latlngs, { color: 'rgba(59, 130, 246, 0.8)', fillColor: 'rgba(59, 130, 246, 0.2)' }).addTo(map);
        });

        var loc = ${location ? JSON.stringify(location) : 'null'};
        if (loc) {
            L.marker([loc.latitude, loc.longitude]).addTo(map).bindPopup("You");
            map.setView([loc.latitude, loc.longitude], 16);
        }
    </script>
</body>
</html>
    `;

    return (
        <SafeAreaView style={[styles.container, screenFlash && styles.flashContainer]}>
            <View style={styles.header}>
                <Text style={styles.welcomeText}>Welcome, {userName}</Text>
                <TouchableOpacity onPress={handleLogout}>
                    <Text style={styles.logoutText}>Logout</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Stats Row */}
                <View style={styles.card}>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statVal, { color: getStatusColor() }]}>{status}</Text>
                            <Text style={styles.statLabel}>Status</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statVal}>{stats.worked_minutes}m</Text>
                            <Text style={styles.statLabel}>Worked</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statVal}>₹{stats.earned}</Text>
                            <Text style={styles.statLabel}>Earned</Text>
                        </View>
                    </View>
                </View>

                {/* Map */}
                <View style={[styles.card, { padding: 0, overflow: 'hidden' }]}>
                    <WebView
                        source={{ html: mapHtml }}
                        style={styles.map}
                        scrollEnabled={false}
                    />
                </View>

                {/* Controls */}
                <View style={styles.controlsRow}>
                    <TouchableOpacity
                        style={[styles.btn, styles.btnStart, isTracking && styles.btnDisabled]}
                        onPress={startWork}
                        disabled={isTracking}
                    >
                        <Text style={styles.btnText}>Start Work</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.btn, styles.btnStop, !isTracking && styles.btnDisabled]}
                        onPress={() => stopWork(true)}
                        disabled={!isTracking}
                    >
                        <Text style={styles.btnText}>Stop Work</Text>
                    </TouchableOpacity>
                </View>

                {/* Logs */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Recent Attendance</Text>
                    <View style={styles.tableHeader}>
                        <Text style={[styles.cell, styles.colDate]}>Date</Text>
                        <Text style={[styles.cell, styles.colStatus]}>Status</Text>
                        <Text style={[styles.cell, styles.colHrs]}>Hrs</Text>
                    </View>
                    {attendance.map((log, i) => (
                        <View key={i} style={styles.tableRow}>
                            <Text style={[styles.cell, styles.colDate]}>{log.date}</Text>
                            <Text style={[styles.cell, styles.colStatus, {
                                color: log.status?.includes('LATE') ? 'red' : log.status?.includes('PRESENT') ? 'green' : '#333'
                            }]}>{log.status}</Text>
                            <Text style={[styles.cell, styles.colHrs]}>{(log.worked_seconds / 3600).toFixed(1)}</Text>
                        </View>
                    ))}
                    {attendance.length === 0 && (
                        <Text style={styles.emptyText}>No records found.</Text>
                    )}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    flashContainer: { backgroundColor: '#fecaca' }, // light red
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center' },
    welcomeText: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
    logoutText: { color: '#ef4444', fontWeight: '600' },
    scrollContent: { paddingHorizontal: 15, paddingBottom: 30 },
    card: {
        backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 15,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
    },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statItem: { alignItems: 'center', flex: 1 },
    statVal: { fontSize: 18, fontWeight: '700', color: '#1e293b', textAlign: 'center' },
    statLabel: { fontSize: 13, color: '#64748b', marginTop: 4 },
    map: { height: 250, width: '100%' },
    controlsRow: { flexDirection: 'row', gap: 15, marginBottom: 15 },
    btn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
    btnStart: { backgroundColor: '#10b981' },
    btnStop: { backgroundColor: '#ef4444' },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 15, textAlign: 'center' },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 10, marginBottom: 10 },
    tableRow: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    cell: { fontSize: 14, color: '#334155' },
    colDate: { flex: 2 },
    colStatus: { flex: 2, fontWeight: '600' },
    colHrs: { flex: 1, textAlign: 'right' },
    emptyText: { textAlign: 'center', color: '#94a3b8', marginVertical: 10 }
});
