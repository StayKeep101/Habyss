import React from 'react';
import { View, BackHandler, StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import RevenueCatUI from 'react-native-purchases-ui';
import { StatusBar } from 'expo-status-bar';

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
});
