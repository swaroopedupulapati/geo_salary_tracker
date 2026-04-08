import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Image, PermissionsAndroid } from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiPost } from '../api';

export default function RegisterEmployeeScreen({ navigation }) {
    const [form, setForm] = useState({
        employee_id: '',
        name: '',
        email: '',
        password: 'Welcome123',
        monthly_salary: '',
        role: 'employee'
    });
    const [faceImage, setFaceImage] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleCaptureFace = async () => {
        try {
            const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                Alert.alert('Permission Denied', 'Camera permission is required to register a face.');
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
                setFaceImage(`data:${result.assets[0].type};base64,${result.assets[0].base64}`);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Could not open camera');
        }
    };

    const handleChange = (key, value) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleRegister = async () => {
        if (!form.employee_id || !form.name || !form.email || !form.password || !form.monthly_salary) {
            Alert.alert('Error', 'Please fill all fields');
            return;
        }

        setLoading(true);
        try {
            const data = await apiPost('/api/manager/register', {
                ...form,
                monthly_salary: Number(form.monthly_salary),
                face_image: faceImage || "" // Empty string matches the web fallback
            });

            if (data.status === 'created') {
                Alert.alert('Success', 'Employee created successfully');
                navigation.goBack();
            } else {
                Alert.alert('Error', data.error || 'Failed to create employee');
            }
        } catch (error) {
            console.error('Register error:', error);
            Alert.alert('Error', 'Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScrollView contentContainerStyle={styles.scroll}>
                <View style={styles.card}>
                    <Text style={styles.label}>Employee ID</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. EMP123"
                        value={form.employee_id}
                        onChangeText={(t) => handleChange('employee_id', t)}
                    />

                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. John Doe"
                        value={form.name}
                        onChangeText={(t) => handleChange('name', t)}
                    />

                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. john@example.com"
                        autoCapitalize="none"
                        keyboardType="email-address"
                        value={form.email}
                        onChangeText={(t) => handleChange('email', t)}
                    />

                    <Text style={styles.label}>Monthly Salary (₹)</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. 50000"
                        keyboardType="numeric"
                        value={form.monthly_salary}
                        onChangeText={(t) => handleChange('monthly_salary', t)}
                    />

                    <Text style={styles.label}>Temporary Password</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        secureTextEntry
                        value={form.password}
                        onChangeText={(t) => handleChange('password', t)}
                    />

                    <Text style={styles.label}>Face Registration</Text>
                    {faceImage && (
                        <Image source={{ uri: faceImage }} style={styles.previewImage} />
                    )}
                    <TouchableOpacity style={styles.btnSecondary} onPress={handleCaptureFace}>
                        <Text style={styles.btnSecondaryText}>
                            {faceImage ? "Retake Face Photo" : "Capture Face"}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.btn, loading && styles.btnDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Account</Text>}
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    scroll: { padding: 20 },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 20, elevation: 2 },
    label: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 12, marginBottom: 15, fontSize: 16, color: '#1e293b' },
    previewImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 10, alignSelf: 'center', backgroundColor: '#e2e8f0' },
    btnSecondary: { backgroundColor: '#64748b', padding: 14, borderRadius: 8, alignItems: 'center', marginBottom: 20 },
    btnSecondaryText: { color: '#fff', fontSize: 15, fontWeight: '600' },
    btn: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 10 },
    btnDisabled: { opacity: 0.7 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});
