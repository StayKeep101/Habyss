import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Image, ScrollView } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function PaywallScreen() {
    const { initPaymentSheet, presentPaymentSheet } = useStripe();
    const [loading, setLoading] = useState(false);
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'abyss'];

    const fetchPaymentSheetParams = async () => {
        const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase.functions.invoke('payment-sheet', {
            body: { email: user?.email }
        });

        if (error || !data) {
            console.error('Error fetching payment sheet params:', JSON.stringify(error, null, 2));
            // Try to extract more specific error message from the response body if available
            const message = error instanceof Error ? error.message : 'Detailed error check console';
            // If it's a FunctionsHttpError, it might hide the body. The Edge Function sends { error: 'message' }.
            // We can try to assume the server is failing likely due to secrets.
            throw new Error(message + ' (Check Supabase Secrets)');
        }

        return {
            paymentIntent: data.paymentIntent,
            ephemeralKey: data.ephemeralKey,
            customer: data.customer,
        };
    };

    const initializePaymentSheet = async () => {
        const {
            paymentIntent,
            ephemeralKey,
            customer,
        } = await fetchPaymentSheetParams();

        const { error } = await initPaymentSheet({
            merchantDisplayName: "Habyss",
            customerId: customer,
            customerEphemeralKeySecret: ephemeralKey,
            paymentIntentClientSecret: paymentIntent,
            // Set allowsDelayedPaymentMethods to true if you want to support methods like bank transfers
            allowsDelayedPaymentMethods: true,
            defaultBillingDetails: {
                name: 'Habyss User',
            },
            appearance: {
                colors: {
                    primary: colors.primary,
                    background: colors.surface,
                    componentBackground: colors.surfaceSecondary,
                    componentBorder: colors.border,
                    componentDivider: colors.border,
                    primaryText: colors.textPrimary,
                    secondaryText: colors.textSecondary,
                    componentText: colors.textPrimary,
                    placeholderText: colors.textTertiary,
                },
            }
        });

        if (error) {
            Alert.alert('Error', error.message);
            return false;
        }
        return true;
    };


    const { restorePurchases } = usePremiumStatus();

    const handleRestorePurchases = async () => {
        setLoading(true);
        const success = await restorePurchases();
        setLoading(false);

        if (success) {
            Alert.alert('Success', 'Your purchase has been restored! 🎉');
            router.back();
        } else {
            Alert.alert('Restore Failed', 'We could not find an active subscription. Please ensure you paid with the same email or contact support.');
        }
    };

    const openPaymentSheet = async () => {
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
                Alert.alert('Success', 'Welcome to Habyss Premium! 🎉');
                // Optmistically try to restore to sync up immediately
                await restorePurchases();
                router.back();
            }
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
            <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
                {/* Close Button */}
                <TouchableOpacity
                    className="absolute top-12 left-6 z-10 w-10 h-10 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.surfaceSecondary }}
                    onPress={() => router.back()}
                >
                    <Ionicons name="close" size={24} color={colors.textPrimary} />
                </TouchableOpacity>

                {/* Header Image / Graphic */}
                <View className="h-80 w-full items-center justify-center overflow-hidden relative">
                    <LinearGradient
                        colors={[colors.primary, colors.background]}
                        className="absolute inset-0"
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                    />
                    <Ionicons name="sparkles" size={120} color="white" style={{ opacity: 0.9 }} />
                    <View className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-black/50 to-transparent" />
                </View>

                {/* Content */}
                <View className="px-8 -mt-10">
                    <Text className="text-4xl font-bold text-center mb-2" style={{ color: colors.textPrimary }}>
                        Unlock AI Power
                    </Text>
                    <Text className="text-lg text-center mb-10 opacity-80" style={{ color: colors.textSecondary }}>
                        Supercharge your habits with advanced AI insights and unlimited features.
                    </Text>

                    {/* Features List */}
                    <View className="gap-6 mb-10">
                        <FeatureItem icon="chatbubbles-outline" text="Unlimited AI Chat & Coaching" colors={colors} />
                        <FeatureItem icon="analytics-outline" text="Deep Habit Analytics & Trends" colors={colors} />
                        <FeatureItem icon="images-outline" text="Custom Dark Mode & Themes" colors={colors} />
                        <FeatureItem icon="sync-outline" text="Cloud Sync & Backup" colors={colors} />
                    </View>

                    {/* Pricing */}
                    <View className="mb-8 items-center">
                        <Text className="text-3xl font-bold" style={{ color: colors.primary }}>
                            $9.99<Text className="text-base font-normal text-gray-400"> / month</Text>
                        </Text>
                        <Text className="text-sm mt-1" style={{ color: colors.textTertiary }}>
                            Cancel anytime. No questions asked.
                        </Text>
                    </View>

                    {/* CTA Button */}
                    <TouchableOpacity
                        onPress={openPaymentSheet}
                        disabled={loading}
                        className="flex-row items-center justify-center py-4 rounded-full shadow-lg"
                        style={{
                            backgroundColor: colors.primary,
                            shadowColor: colors.primary,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                        }}
                    >
                        {loading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Text className="text-lg font-bold text-white mr-2">Subscribe Now</Text>
                                <Ionicons name="arrow-forward" size={20} color="white" />
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Restore Purchase */}
                    <TouchableOpacity
                        onPress={handleRestorePurchases}
                        className="items-center py-4 mt-2"
                        disabled={loading}
                    >
                        <Text className="text-sm font-medium underline" style={{ color: colors.textSecondary }}>
                            Already paid? Restore Purchase
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

function FeatureItem({ icon, text, colors }: { icon: any, text: string, colors: any }) {
    return (
        <View className="flex-row items-center">
            <View className="w-10 h-10 rounded-full items-center justify-center mr-4" style={{ backgroundColor: colors.primary + '20' }}>
                <Ionicons name={icon} size={20} color={colors.primary} />
            </View>
            <Text className="text-base font-medium flex-1" style={{ color: colors.textPrimary }}>{text}</Text>
        </View>
    );
}
