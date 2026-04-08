import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchCamera } from 'react-native-image-picker';
import { apiPost } from '../api';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen({ navigation }) {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleFaceLogin = async () => {
        if (!identifier) {
            Alert.alert('Error', 'Please enter your Employee ID or Email first before using Face Login');
            return;
        }

        try {
            const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
            if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
                Alert.alert('Permission Denied', 'Camera permission is required for Face Login.');
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
                // The backend face_login endpoint expects 'username' and 'image' (base64 string)
                const data = await apiPost('/api/login_face', {
                    username: identifier,
                    image: b64
                });

                if (data.error) {
                    Alert.alert('Face Login Failed', data.error);
                } else if (data.user) {
                    await proceedLogin(data.user);
                }
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Could not open camera or connect to server');
        } finally {
            setLoading(false);
        }
    };

    const proceedLogin = async (user) => {
        // Store user data
        await AsyncStorage.multiSet([
            ['employee_id', user.employee_id],
            ['name', user.name],
            ['role', user.role],
            ['email', user.email]
        ]);

        // Route based on role
        if (user.role === 'manager' || user.role === 'admin') {
            navigation.replace('ManagerDashboard');
        } else {
            navigation.replace('EmployeeDashboard');
        }
    };

    const handleLogin = async () => {
        if (!identifier || !password) {
            Alert.alert('Error', 'Please enter identifier and password');
            return;
        }

        setLoading(true);
        try {
            const data = await apiPost('/api/login', { identifier, password });

            if (data.error) {
                Alert.alert('Login Failed', data.error);
            } else if (data.user) {
                await proceedLogin(data.user);
            } else {
                Alert.alert('Login Failed', 'Invalid credentials');
            }
        } catch (error) {
            console.error('Login error:', error);
            Alert.alert('Network Error', 'Check your connection or NGROK_URL in api.js');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.card}>
                <View style={styles.header}>
                    <Text style={styles.title}>GeoWork Login</Text>
                    <Text style={styles.subtitle}>Enter your credentials to access</Text>
                </View>

                <View style={styles.body}>
                    <TextInput
                        style={styles.input}
                        placeholder="Employee ID or Email"
                        placeholderTextColor="#94a3b8"
                        value={identifier}
                        onChangeText={setIdentifier}
                        autoCapitalize="none"
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor="#94a3b8"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Sign In</Text>
                        )}
                    </TouchableOpacity>

                    <View style={styles.divider}>
                        <View style={styles.dividerLine} />
                        <Text style={styles.dividerText}>OR</Text>
                        <View style={styles.dividerLine} />
                    </View>

                    <TouchableOpacity
                        style={[styles.buttonOutline, loading && styles.buttonDisabled]}
                        onPress={handleFaceLogin}
                        disabled={loading}
                    >
                        <Text style={styles.buttonOutlineText}>Face Login</Text>
                    </TouchableOpacity>

                    <Text style={styles.footerText}>
                        Contact your Manager to create an account.
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f1f5f9',
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 25,
        elevation: 5,
        overflow: 'hidden',
    },
    header: {
        padding: 25,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748b',
    },
    body: {
        padding: 30,
    },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        padding: 12,
        marginBottom: 15,
        fontSize: 16,
        color: '#1e293b',
    },
    button: {
        backgroundColor: '#3b82f6',
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 5,
    },
    buttonDisabled: {
        backgroundColor: '#93c5fd',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e2e8f0',
    },
    dividerText: {
        marginHorizontal: 10,
        color: '#94a3b8',
        fontWeight: '600',
        fontSize: 13,
    },
    buttonOutline: {
        backgroundColor: '#fff',
        borderWidth: 2,
        borderColor: '#3b82f6',
        padding: 14,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonOutlineText: {
        color: '#3b82f6',
        fontSize: 16,
        fontWeight: '600',
    },
    footerText: {
        textAlign: 'center',
        color: '#64748b',
        fontSize: 12,
        marginTop: 20,
    }
});
