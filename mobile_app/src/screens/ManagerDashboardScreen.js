import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiGet, apiPost } from '../api';

export default function ManagerDashboardScreen({ navigation }) {
    const [userName, setUserName] = useState('');
    const [liveData, setLiveData] = useState({ live: [], offline: [] });
    const [stats, setStats] = useState({ total: 0, active: 0, inside: 0 });
    const [geofences, setGeofences] = useState([]);
    const [refreshing, setRefreshing] = useState(false);

    const mapRef = useRef(null);

    useEffect(() => {
        loadData();
        const interval = setInterval(fetchLiveData, 5000); // 5s refresh
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        const name = await AsyncStorage.getItem('name');
        setUserName(name || '');

        try {
            const geoRes = await apiGet('/api/geofence');
            if (geoRes.geofences && geoRes.geofences.length > 0) {
                const formattedFences = geoRes.geofences.map(fence =>
                    fence.map(pt => ({ latitude: pt.lat, longitude: pt.lng }))
                );
                setGeofences(formattedFences);
            }
        } catch (e) { }

        await fetchLiveData();
    };

    const fetchLiveData = async () => {
        try {
            const res = await apiGet('/api/manager/live');
            if (res.live || res.offline) {
                setLiveData(res);

                const total = (res.live?.length || 0) + (res.offline?.length || 0);
                const active = res.live?.length || 0;
                const inside = res.live?.filter(e => e.status?.includes('INSIDE')).length || 0;

                setStats({ total, active, inside });
            }
        } catch (e) {
            console.error('Live data fetch error', e);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchLiveData();
        setRefreshing(false);
    };

    const handleLogout = async () => {
        await apiPost('/api/logout', {});
        await AsyncStorage.clear();
        navigation.replace('Login');
    };

    const getStatusColor = (status) => {
        if (!status || status === 'OFFLINE') return '#64748b';
        if (status.includes('INSIDE')) return '#10b981';
        if (status.includes('OUTSIDE')) return '#ef4444';
        return '#f59e0b';
    };

    const defaultRegion = geofences[0]?.[0]
        ? { latitude: geofences[0][0].latitude, longitude: geofences[0][0].longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
        : { latitude: 15.4796, longitude: 80.0215, latitudeDelta: 0.02, longitudeDelta: 0.02 };

    const allEmps = [...(liveData.live || []), ...(liveData.offline || [])];

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

        var liveData = ${JSON.stringify(liveData.live || [])};
        liveData.forEach(function(emp) {
            if (emp.lat && emp.lng) {
                var color = emp.status.indexOf('INSIDE') !== -1 ? 'green' : 'red';
                var markerHtml = '<div style="background-color:' + color + ';width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.4);"></div>';
                var icon = L.divIcon({ html: markerHtml, className: '' });
                L.marker([emp.lat, emp.lng], { icon: icon }).addTo(map).bindPopup("<b>" + emp.name + "</b><br/>" + emp.status);
            }
        });
    </script>
</body>
</html>
    `;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcomeText}>Manager Dashboard</Text>
                    <Text style={styles.subtitle}>Welcome, {userName}</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity style={styles.btnNew} onPress={() => navigation.navigate('RegisterEmployee')}>
                        <Text style={styles.btnNewText}>+ New</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleLogout}>
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Stats */}
                <View style={styles.statsContainer}>
                    <View style={[styles.statCard, { backgroundColor: '#3b82f6' }]}>
                        <Text style={styles.statLabelLight}>Total Emp</Text>
                        <Text style={styles.statValLight}>{stats.total}</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: '#10b981' }]}>
                        <Text style={styles.statLabelLight}>Active Now</Text>
                        <Text style={styles.statValLight}>{stats.active}</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: '#06b6d4' }]}>
                        <Text style={styles.statLabelLight}>Inside Fence</Text>
                        <Text style={styles.statValLight}>{stats.inside}</Text>
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

                {/* List */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Live Status</Text>
                    {allEmps.map((emp, i) => {
                        const status = emp.status || 'OFFLINE';
                        const hrs = Math.floor((emp.worked_minutes || 0) / 60);
                        const mins = (emp.worked_minutes || 0) % 60;
                        const timeStr = `${hrs}h ${mins}m`;

                        return (
                            <View key={i} style={styles.empRow}>
                                <View style={styles.empInfo}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarText}>{emp.name?.charAt(0) || '?'}</Text>
                                    </View>
                                    <View>
                                        <Text style={styles.empName}>{emp.name}</Text>
                                        <Text style={styles.empId}>{emp.id}</Text>
                                    </View>
                                </View>
                                <View style={styles.empData}>
                                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(status) + '20' }]}>
                                        <Text style={[styles.statusText, { color: getStatusColor(status) }]}>{status}</Text>
                                    </View>
                                    <Text style={styles.timeText}>{timeStr}</Text>
                                </View>
                            </View>
                        );
                    })}
                    {allEmps.length === 0 && (
                        <Text style={{ textAlign: 'center', color: '#94a3b8' }}>No employees found</Text>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', backgroundColor: '#fff' },
    welcomeText: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
    subtitle: { fontSize: 13, color: '#64748b' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    btnNew: { backgroundColor: '#3b82f6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    btnNewText: { color: '#fff', fontWeight: '600', fontSize: 13 },
    logoutText: { color: '#ef4444', fontWeight: '600' },
    scrollContent: { padding: 15 },
    statsContainer: { flexDirection: 'row', gap: 10, marginBottom: 15 },
    statCard: { flex: 1, padding: 15, borderRadius: 12, alignItems: 'center' },
    statLabelLight: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
    statValLight: { color: '#fff', fontSize: 22, fontWeight: '700' },
    card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, elevation: 1 },
    map: { height: 250, width: '100%' },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 15 },
    empRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 10 },
    empInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e2e8f0', justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontWeight: '700', color: '#64748b' },
    empName: { fontWeight: '600', color: '#1e293b' },
    empId: { fontSize: 12, color: '#64748b' },
    empData: { alignItems: 'flex-end' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginBottom: 4 },
    statusText: { fontSize: 10, fontWeight: '700' },
    timeText: { fontSize: 12, fontWeight: '600', color: '#10b981' }
});
