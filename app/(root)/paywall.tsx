import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, SafeAreaView, StyleSheet, StatusBar } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';

import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { AscensionBackground } from '@/components/Paywall/AscensionBackground';
import { BenefitPrism } from '@/components/Paywall/BenefitPrism';
import { StargateButton } from '@/components/Paywall/StargateButton';

export default function PaywallScreen() {
    const { initPaymentSheet, presentPaymentSheet } = useStripe();
    const [loading, setLoading] = useState(false);
    const { restorePurchases } = usePremiumStatus();

    // --- Stripe Logic (Kept from original) ---

    const fetchPaymentSheetParams = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.functions.invoke('payment-sheet', {
            body: { email: user?.email }
        });

        if (error || !data) {
            console.error('Error:', error);
            const message = error instanceof Error ? error.message : 'Server error';
            throw new Error(message);
        }

        return {
            paymentIntent: data.paymentIntent,
            ephemeralKey: data.ephemeralKey,
            customer: data.customer,
        };
    };

    const initializePaymentSheet = async () => {
        const { paymentIntent, ephemeralKey, customer } = await fetchPaymentSheetParams();

        const { error } = await initPaymentSheet({
            merchantDisplayName: "Habyss",
            customerId: customer,
            customerEphemeralKeySecret: ephemeralKey,
            paymentIntentClientSecret: paymentIntent,
            allowsDelayedPaymentMethods: true,
            appearance: {
                colors: {
                    primary: '#8B5CF6',
                    background: '#0a0a0a',
                    componentBackground: '#1a1a1a',
                    componentBorder: '#333',
                    componentDivider: '#333',
                    primaryText: '#fff',
                    secondaryText: '#aaa',
                },
                primaryButton: {
                    colors: {
                        background: '#8B5CF6',
                        text: '#ffffff',
                    }
                }
            }
        });

        if (error) {
            Alert.alert('Error', error.message);
            return false;
        }
        return true;
    };

    const handleSubscribe = async () => {
        setLoading(true);
        try {
            const isInitialized = await initializePaymentSheet();
            if (!isInitialized) {
                setLoading(false);
                return;
            }

            const { error } = await presentPaymentSheet();

            if (error) {
                if (error.code !== "Canceled") {
                    Alert.alert(`Error code: ${error.code}`, error.message);
                }
            } else {
                Alert.alert('Ascension Complete', 'Welcome to the cosmos. 🎉');
                await restorePurchases();
                router.back();
            }
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async () => {
        setLoading(true);
        const success = await restorePurchases();
        setLoading(false);
        if (success) {
            Alert.alert('Restored', 'Your cosmic access has been restored.');
            router.back();
        } else {
            Alert.alert('Restore Failed', 'No active subscription found.');
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <AscensionBackground />

            {/* Close Button */}
            <SafeAreaView style={styles.safeArea}>
                <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => router.back()}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                    <Ionicons name="close" size={28} color="white" />
                </TouchableOpacity>

                <Animated.View entering={FadeIn.duration(800).delay(200)} style={styles.header}>
                    <Ionicons name="planet" size={64} color="#8B5CF6" style={{ marginBottom: 16 }} />
                    <Text style={styles.title}>Ascend to Pro</Text>
                    <Text style={styles.subtitle}>Unlock the full universe of features.</Text>
                </Animated.View>

                <View style={styles.spacer} />

                <BenefitPrism />

                <View style={styles.spacer} />

                {/* Footer Actions */}
                <StargateButton
                    onPress={handleSubscribe}
                    loading={loading}
                    price="$9.99"
                />

                <TouchableOpacity onPress={handleRestore} disabled={loading} style={styles.restoreBtn}>
                    <Text style={styles.restoreText}>Restore Purchase</Text>
                </TouchableOpacity>

            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    safeArea: {
        flex: 1,
    },
    closeBtn: {
        position: 'absolute',
        top: 50, // Approximate safe area
        right: 24,
        zIndex: 10,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        padding: 8,
    },
    header: {
        alignItems: 'center',
        marginTop: 60,
        marginBottom: 20,
    },
    title: {
        fontSize: 36,
        fontWeight: '900',
        color: 'white',
        letterSpacing: 1,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 8,
        textAlign: 'center',
    },
    spacer: {
        flex: 1,
    },
    restoreBtn: {
        alignItems: 'center',
        paddingBottom: 20,
    },
    restoreText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    }
});
