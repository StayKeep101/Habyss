import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, SafeAreaView, StyleSheet, StatusBar, ScrollView, Dimensions } from 'react-native';
import { useStripe } from '@stripe/stripe-react-native';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { usePremiumStatus } from '@/hooks/usePremiumStatus';
import { AscensionBackground } from '@/components/Paywall/AscensionBackground';
import { StargateButton } from '@/components/Paywall/StargateButton';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useAccentGradient } from '@/constants/AccentContext';

const { width } = Dimensions.get('window');



export default function PaywallScreen() {
    const { initPaymentSheet, presentPaymentSheet } = useStripe();
    const [loading, setLoading] = useState(false);
    const { restorePurchases } = usePremiumStatus();
    const { primary: accentColor } = useAccentGradient();

    const BENEFITS = [
        {
            id: 'ai',
            icon: 'sparkles',
            title: 'Cosmic Wisdom',
            desc: 'Unlock specific AI personalities (Friendly, Dad Mode, Bully) and unlimited coaching chats.',
            color: accentColor // Dynamic Accent
        },
        {
            id: 'analytics',
            icon: 'analytics',
            title: 'Quantified Self',
            desc: 'Access advanced heatmaps, trend predictions, and consistency scores.',
            color: '#3B82F6'
        },
        {
            id: 'void',
            icon: 'infinite',
            title: 'No Limits',
            desc: 'Create infinite habits, goals, and customize your Void with unlimited categories.',
            color: '#10B981'
        },
        {
            id: 'sync',
            icon: 'cloud-upload',
            title: 'Universal Sync',
            desc: 'Your data flows seamlessly across all your devices in real-time.',
            color: '#F59E0B'
        },
        {
            id: 'export',
            icon: 'download',
            title: 'Total Ownership',
            desc: 'Export your entire history to CSV/JSON anytime. Your data is yours.',
            color: '#EC4899'
        }
    ];

    // --- Stripe Logic ---
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
            returnURL: 'habyss://stripe-redirect',
            appearance: {
                colors: {
                    primary: accentColor,
                    background: '#0a0a0a',
                    componentBackground: '#1a1a1a',
                    componentBorder: '#333333',
                    componentDivider: '#333333',
                    primaryText: '#ffffff',
                    secondaryText: '#aaaaaa',
                },
                primaryButton: {
                    colors: {
                        background: accentColor,
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

            {/* Close Button - Floated */}
            <SafeAreaView style={styles.headerSafe}>
                <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => router.back()}
                    hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                >
                    <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
            </SafeAreaView>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <Animated.View entering={FadeIn.duration(800)} style={styles.heroSection}>
                    <View style={[styles.iconRing, { backgroundColor: accentColor + '15', borderColor: accentColor + '40' }]}>
                        <Ionicons name="planet" size={64} color={accentColor} />
                    </View>
                    <Text style={styles.title}>Ascend to Pro</Text>
                    <Text style={styles.subtitle}>Unlock the full universe of features and destroy your limits.</Text>
                </Animated.View>

                <View style={styles.featuresContainer}>
                    {BENEFITS.map((benefit, index) => (
                        <Animated.View
                            key={benefit.id}
                            entering={FadeInDown.delay(index * 100 + 300).springify()}
                        >
                            <VoidCard glass style={styles.benefitCard}>
                                <View style={[styles.iconBox, { backgroundColor: benefit.color + '20' }]}>
                                    <Ionicons name={benefit.icon as any} size={24} color={benefit.color} />
                                </View>
                                <View style={styles.benefitTextContent}>
                                    <Text style={styles.benefitTitle}>{benefit.title}</Text>
                                    <Text style={styles.benefitDesc}>{benefit.desc}</Text>
                                </View>
                            </VoidCard>
                        </Animated.View>
                    ))}
                </View>

                {/* Social Proof / Trust */}
                <View style={styles.trustSection}>
                    <View style={styles.stars}>
                        {[1, 2, 3, 4, 5].map(s => (
                            <Ionicons key={s} name="star" size={16} color="#F59E0B" />
                        ))}
                    </View>
                    <Text style={styles.trustText}>"The only habit tracker that actually works."</Text>
                </View>

                <View style={{ height: 120 }} />
            </ScrollView>

            {/* Floating Bottom Bar */}
            <BlurView intensity={20} tint="dark" style={styles.bottomBar}>
                <StargateButton
                    onPress={handleSubscribe}
                    loading={loading}
                    price="$9.99"
                />
                <TouchableOpacity onPress={handleRestore} disabled={loading} style={styles.restoreBtn}>
                    <Text style={styles.restoreText}>Restore Purchase</Text>
                </TouchableOpacity>
            </BlurView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    headerSafe: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        alignItems: 'flex-end',
        paddingHorizontal: 20,
    },
    closeBtn: {
        width: 40,
        height: 40,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10, // Adjust for status bar
    },
    scrollContent: {
        paddingTop: 100,
        paddingBottom: 40,
    },
    heroSection: {
        alignItems: 'center',
        paddingHorizontal: 32,
        marginBottom: 40,
    },
    iconRing: {
        width: 100,
        height: 100,
        borderRadius: 50,
        // backgroundColor/borderColor set dynamically
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 1,
    },
    title: {
        fontSize: 36,
        color: 'white',
        letterSpacing: 1,
        textAlign: 'center',
        fontFamily: 'Lexend',
        marginBottom: 12,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
        textAlign: 'center',
        fontFamily: 'Lexend_400Regular',
        lineHeight: 24,
    },
    featuresContainer: {
        paddingHorizontal: 20,
        gap: 16,
    },
    benefitCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 16,
        backgroundColor: 'rgba(20, 20, 30, 0.6)',
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    benefitTextContent: {
        flex: 1,
    },
    benefitTitle: {
        fontSize: 16,
        color: 'white',
        fontFamily: 'Lexend',
        marginBottom: 4,
    },
    benefitDesc: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
        fontFamily: 'Lexend_400Regular',
        lineHeight: 18,
    },
    trustSection: {
        marginTop: 40,
        alignItems: 'center',
        gap: 8,
    },
    stars: {
        flexDirection: 'row',
        gap: 4,
    },
    trustText: {
        color: 'rgba(255,255,255,0.4)',
        fontFamily: 'Lexend_400Regular',
        fontStyle: 'italic',
        fontSize: 14,
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 20,
        paddingBottom: 40,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    restoreBtn: {
        alignItems: 'center',
        marginTop: 4,
    },
    restoreText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    }
});
