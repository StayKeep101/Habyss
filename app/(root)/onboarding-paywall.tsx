import React from 'react';
import { View, BackHandler, StyleSheet, Text } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import RevenueCatUI from 'react-native-purchases-ui';
import { StatusBar } from 'expo-status-bar';
import RevenueCatService from '@/lib/RevenueCat';

export default function OnboardingPaywall() {
    const router = useRouter();

    // Disable back button on Android
    useFocusEffect(
        React.useCallback(() => {
            const onBackPress = () => {
                return true; // Return true to prevent default behavior (going back)
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [])
    );

    const handlePurchase = () => {
        // Navigate to Home upon successful purchase or restore
        router.replace('/(root)/(tabs)/home');
    };

    if (!RevenueCatService.isConfigured()) {
        return (
            <View style={[styles.container, styles.centered]}>
                <StatusBar style="light" />
                <Text style={styles.title}>Billing isn&apos;t configured on this build.</Text>
                <Text style={styles.subtitle}>
                    Add the RevenueCat API key for this platform before using onboarding paywalls.
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar style="light" />
            <RevenueCatUI.Paywall
                onPurchaseCompleted={handlePurchase}
                onRestoreCompleted={handlePurchase}
                options={{
                    displayCloseButton: false, // HARD PAYWALL - No close button
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centered: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 12,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        textAlign: 'center',
    },
});
