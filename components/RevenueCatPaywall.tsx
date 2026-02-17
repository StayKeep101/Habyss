import React from 'react';
import { View, StyleSheet, DeviceEventEmitter } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { useRouter } from 'expo-router';
import { CustomerInfo, PurchasesStoreTransaction } from 'react-native-purchases';

export default function RevenueCatPaywall() {
    const router = useRouter();

    const handlePurchaseCompleted = ({ customerInfo }: { customerInfo: CustomerInfo, storeTransaction: PurchasesStoreTransaction }) => {
        console.log('Purchase completed:', customerInfo);
        DeviceEventEmitter.emit('premium_status_updated');
        router.back();
    };

    const handleRestoreCompleted = ({ customerInfo }: { customerInfo: CustomerInfo }) => {
        console.log('Restore completed:', customerInfo);
        if (customerInfo.entitlements.active['pro']) {
            DeviceEventEmitter.emit('premium_status_updated');
            router.back();
        }
    };

    return (
        <View style={styles.container}>
            <RevenueCatUI.Paywall
                onPurchaseCompleted={handlePurchaseCompleted}
                onRestoreCompleted={handleRestoreCompleted}
                options={{
                    displayCloseButton: true,
                    // If we want to force "Yearly has trial", we rely on the Offering setup in RevenueCat.
                    // However, we can use the `defaultPackage` option if available or `offering` to specific one.
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
