import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, PermissionsAndroid } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { apiUpload } from '../api';

export default function VerifyPresenceScreen({ navigation, route }) {
    const [tab, setTab] = useState('face'); // 'face' | 'pass'
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const onVerified = route.params?.onVerified;

    const handleFaceScan = async () => {
        try {
            const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                Alert.alert('Permission Denied', 'Camera permission is required to scan your face.');
                return;
            }

            const result = await launchCamera({
                mediaType: 'photo',
                includeBase64: true,
                cameraType: 'front',
                quality: 0.5
            });

            if (result.didCancel) return;
            if (result.errorCode) {
                Alert.alert('Camera Error', result.errorMessage);
                return;
            }

            if (result.assets && result.assets[0].base64) {
                setLoading(true);
                const b64 = `data:${result.assets[0].type};base64,${result.assets[0].base64}`;
                const formData = new FormData();
                formData.append('image', b64);

                const res = await apiUpload('/api/verify_presence', formData);
                if (res.status === 'verified') {
                    setSuccess(true);
                    setTimeout(() => {
                        if (onVerified) onVerified();
                        navigation.goBack();
                    }, 1500);
                } else {
                    Alert.alert('Verification Failed', res.error || 'Face match failed');
                    setLoading(false);
                }
            }
        } catch (error) {
            console.error('Face error:', error);
            Alert.alert('Error', 'Camera failed');
            setLoading(false);
        }
    };

    const handleVerify = async () => {
        if (!password) {
            Alert.alert('Error', 'Please enter your password');
            return;
        }

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('password', password);

            const res = await apiUpload('/api/verify_presence', formData);
            if (res.status === 'verified') {
                setSuccess(true);
                setTimeout(() => {
                    if (onVerified) onVerified();
                    navigation.goBack();
                }, 1500);
            } else {
                Alert.alert('Verification Failed', res.error || 'Invalid password');
                setLoading(false);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.modalContent}>
                {success ? (
                    <View style={styles.successBox}>
                        <Text style={styles.successIcon}>✅</Text>
                        <Text style={styles.successTitle}>Verification Successful!</Text>
                        <Text style={styles.successSub}>You can close this tab and continue working.</Text>
                    </View>
                ) : (
                    <>
                        <Text style={styles.title}>Active Presence</Text>
                        <Text style={styles.subtitle}>Are you still working? Please verify.</Text>

                        <View style={styles.tabs}>
                            <TouchableOpacity style={[styles.tab, tab === 'face' && styles.tabActive]} onPress={() => setTab('face')}>
                                <Text style={[styles.tabText, tab === 'face' && styles.tabTextActive]}>Face Match</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.tab, tab === 'pass' && styles.tabActive]} onPress={() => setTab('pass')}>
                                <Text style={[styles.tabText, tab === 'pass' && styles.tabTextActive]}>Password</Text>
                            </TouchableOpacity>
                        </View>

                        {tab === 'face' ? (
                            <View style={styles.pane}>
                                <TouchableOpacity style={[styles.btn, styles.btnFace, loading && styles.btnDisabled]} onPress={handleFaceScan} disabled={loading}>
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTextLight}>Scan Face</Text>}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.pane}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter password"
                                    placeholderTextColor="#000000ff"
                                    secureTextEntry
                                    value={password}
                                    onChangeText={setPassword}
                                />

                                <View style={styles.buttons}>
                                    <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={() => navigation.goBack()}>
                                        <Text style={styles.btnTextDark}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={[styles.btn, styles.btnVerify, loading && styles.btnDisabled]} onPress={handleVerify} disabled={loading}>
                                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnTextLight}>Verify Password</Text>}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 25, elevation: 10 },
    title: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginBottom: 5, textAlign: 'center' },
    subtitle: { fontSize: 14, color: '#64748b', marginBottom: 20, textAlign: 'center' },
    successBox: { alignItems: 'center', paddingVertical: 20 },
    successIcon: { fontSize: 50, marginBottom: 10 },
    successTitle: { fontSize: 20, fontWeight: '700', color: '#10b981', textAlign: 'center', marginBottom: 5 },
    successSub: { fontSize: 14, color: '#64748b', textAlign: 'center' },
    tabs: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#f1f5f9', marginBottom: 20 },
    tab: { flex: 1, paddingBottom: 10, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: '#3b82f6', marginBottom: -2 },
    tabText: { color: '#94a3b8', fontWeight: '600' },
    tabTextActive: { color: '#3b82f6' },
    pane: { alignItems: 'center', width: '100%' },
    input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 16, width: '100%' },
    buttons: { flexDirection: 'row', gap: 10 },
    btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
    btnCancel: { backgroundColor: '#f1f5f9' },
    btnVerify: { backgroundColor: '#10b981' },
    btnFace: { backgroundColor: '#3b82f6', width: '100%' },
    btnDisabled: { opacity: 0.5 },
    btnTextDark: { color: '#334155', fontWeight: '600' },
    btnTextLight: { color: '#fff', fontWeight: '600' }
});
