import React, { useMemo } from 'react';
import { View, StyleSheet, DeviceEventEmitter, Text, TouchableOpacity } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { useRouter } from 'expo-router';
import { CustomerInfo, PurchasesStoreTransaction } from 'react-native-purchases';
import RevenueCatService from '@/lib/RevenueCat';

export default function RevenueCatPaywall() {
    const router = useRouter();
    const isConfigured = useMemo(() => RevenueCatService.isConfigured(), []);

    const handlePurchaseCompleted = ({ customerInfo }: { customerInfo: CustomerInfo, storeTransaction: PurchasesStoreTransaction }) => {
        console.log('Purchase completed:', customerInfo);
        DeviceEventEmitter.emit('premium_status_updated');
        router.back();
    };

    const handleRestoreCompleted = ({ customerInfo }: { customerInfo: CustomerInfo }) => {
        console.log('Restore completed:', customerInfo);
        if (customerInfo.entitlements.active['pro'] || customerInfo.entitlements.active['Habyss Pro']) {
            DeviceEventEmitter.emit('premium_status_updated');
            router.back();
        }
    };

    if (!isConfigured) {
        return (
            <View style={[styles.container, styles.fallback]}>
                <Text style={styles.title}>Billing isn&apos;t configured on this build.</Text>
                <Text style={styles.subtitle}>
                    Add the RevenueCat API key for this platform before showing the paywall.
                </Text>
                <TouchableOpacity onPress={() => router.back()} style={styles.button}>
                    <Text style={styles.buttonText}>Close</Text>
                </TouchableOpacity>
            </View>
        );
    }

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
    fallback: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#000',
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
        marginBottom: 24,
    },
    button: {
        backgroundColor: '#fff',
        borderRadius: 999,
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    buttonText: {
        color: '#000',
        fontSize: 14,
        fontWeight: '600',
    },
});
