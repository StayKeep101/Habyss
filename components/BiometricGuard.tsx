import React, { useEffect, useState, useRef } from 'react';
import { AppState, View, Text, StyleSheet, AppStateStatus, TouchableOpacity } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidShell } from './Layout/VoidShell';
import { BlurView } from 'expo-blur';

interface BiometricGuardProps {
    children: React.ReactNode;
}

export const BiometricGuard: React.FC<BiometricGuardProps> = ({ children }) => {
    const { isAppLockEnabled } = useAppSettings();
    const appState = useRef(AppState.currentState);
    const [isLocked, setIsLocked] = useState(false);
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isDark = theme !== 'light';

    useEffect(() => {
        const subscription = AppState.addEventListener('change', handleAppStateChange);
        return () => {
            subscription.remove();
        };
    }, [isAppLockEnabled]);

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
        if (
            appState.current.match(/inactive|background/) &&
            nextAppState === 'active' &&
            isAppLockEnabled
        ) {
            setIsLocked(true);
            authenticate();
        }
        appState.current = nextAppState;
    };

    const authenticate = async () => {
        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (!hasHardware || !isEnrolled) {
                // Fallback if no biometrics are available (or just unlock to avoid lockout)
                setIsLocked(false);
                return;
            }

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Unlock Habyss',
                fallbackLabel: 'Use Passcode',
                disableDeviceFallback: false,
            });

            if (result.success) {
                setIsLocked(false);
            }
        } catch (error) {
            console.error('Authentication error:', error);
        }
    };

    if (isLocked) {
        return (
            <VoidShell>
                <View style={styles.container}>
                    <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                    <View style={styles.content}>
                        <View style={[styles.iconContainer, { backgroundColor: colors.surfaceSecondary }]}>
                            <Ionicons name="lock-closed" size={48} color={colors.primary} />
                        </View>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>Habyss Locked</Text>
                        <TouchableOpacity
                            style={[styles.button, { backgroundColor: colors.primary }]}
                            onPress={authenticate}
                        >
                            <Text style={styles.buttonText}>Unlock</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </VoidShell>
        );
    }

    return <>{children}</>;
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        alignItems: 'center',
        gap: 24,
    },
    iconContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    button: {
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 100,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
});
