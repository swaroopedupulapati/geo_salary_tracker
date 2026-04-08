import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, View, StatusBar } from 'react-native';

import LoginScreen from './src/screens/LoginScreen';
import EmployeeDashboardScreen from './src/screens/EmployeeDashboardScreen';
import VerifyPresenceScreen from './src/screens/VerifyPresenceScreen';
import ManagerDashboardScreen from './src/screens/ManagerDashboardScreen';
import RegisterEmployeeScreen from './src/screens/RegisterEmployeeScreen';

const Stack = createNativeStackNavigator();

export default function App() {
    const [authRoute, setAuthRoute] = useState(null); // null = loading

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        try {
            const role = await AsyncStorage.getItem('role');
            if (role === 'manager' || role === 'admin') {
                setAuthRoute('ManagerDashboard');
            } else if (role === 'employee') {
                setAuthRoute('EmployeeDashboard');
            } else {
                setAuthRoute('Login');
            }
        } catch (e) {
            setAuthRoute('Login');
        }
    };

    if (authRoute === null) {
        return (
            <View style={{ flex: 1, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#3b82f6" />
            </View>
        );
    }

    return (
        <NavigationContainer>
            <StatusBar barStyle="dark-content" backgroundColor="#f1f5f9" />
            <Stack.Navigator
                initialRouteName={authRoute}
                screenOptions={{
                    headerStyle: { backgroundColor: '#fff' },
                    headerTintColor: '#1e293b',
                    headerTitleStyle: { fontWeight: '700' },
                    headerShadowVisible: false,
                    contentStyle: { backgroundColor: '#f8f9fa' },
                }}
            >
                <Stack.Screen
                    name="Login"
                    component={LoginScreen}
                    options={{ headerShown: false }}
                />
                <Stack.Screen
                    name="EmployeeDashboard"
                    component={EmployeeDashboardScreen}
                    options={{ headerShown: false, gestureEnabled: false }}
                />
                <Stack.Screen
                    name="VerifyPresence"
                    component={VerifyPresenceScreen}
                    options={{ presentation: 'transparentModal', animation: 'fade', headerShown: false }}
                />
                <Stack.Screen
                    name="ManagerDashboard"
                    component={ManagerDashboardScreen}
                    options={{ headerShown: false, gestureEnabled: false }}
                />
                <Stack.Screen
                    name="RegisterEmployee"
                    component={RegisterEmployeeScreen}
                    options={{ title: 'New Employee' }}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
