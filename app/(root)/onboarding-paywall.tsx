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

            BackHandler.addEventListener('hardwareBackPress', onBackPress);

            // React Native > 0.65 BackHandler.addEventListener returns a subscription
            // However, types might still suggest void/removeEventListener depending on version
            // Safer way for modern RN:
            return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
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
