import React, { useState, useRef } from 'react';
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
    const [selectedPlanId, setSelectedPlanId] = useState<'yearly' | '2year' | 'lifetime'>('yearly');
    const { restorePurchases } = usePremiumStatus();
    const { primary: accentColor } = useAccentGradient();
    const isProcessingPayment = useRef(false); // Prevent double payment sheet calls

    const PLANS = [
        // { id: 'monthly', title: 'Monthly', price: '$1.99', period: '/mo', save: null },
        { id: 'yearly', title: 'Yearly', price: '$6.99', originalPrice: '$12.99', period: '/yr', save: '50% OFF', priceId: 'price_1SoRgGAzxf3pzNzAHlzJd5GF' },
        { id: '2year', title: '2 Years', price: '$19.99', period: '/2yr', save: null, priceId: 'price_1SoRgyAzxf3pzNzAyKcBMIvq' },
        { id: 'lifetime', title: 'Lifetime', price: '$29.99', period: 'one-time', save: 'BEST VALUE', priceId: 'price_1SoRiYAzxf3pzNzA28oOqFTw' }
    ] as const;

    const selectedPlan = PLANS.find(p => p.id === selectedPlanId) || PLANS[1];

    const BENEFITS = [
        {
            id: 'ai',
            icon: 'sparkles',
            title: 'AI Agent',
            desc: 'Unlock your personal AI coach with unlimited conversations and personalized insights.',
            color: accentColor // Dynamic Accent
        },
        {
            id: 'unlimited',
            icon: 'infinite',
            title: 'Unlimited Goals & Habits',
            desc: 'Create as many goals and habits as you need. No restrictions, no limits.',
            color: '#10B981'
        },
        {
            id: 'automation',
            icon: 'flash',
            title: 'Unlimited Automation',
            desc: 'Automate your habit tracking with smart triggers, schedules, and workflows.',
            color: '#3B82F6'
        },
        {
            id: 'siri',
            icon: 'mic',
            title: 'Shortcuts & Siri',
            desc: 'Use Siri voice commands and iOS Shortcuts to complete habits hands-free.',
            color: '#F59E0B'
        }
    ];

    // --- Stripe Logic ---
    const fetchPaymentSheetParams = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase.functions.invoke('payment-sheet', {
            body: {
                email: user?.email,
                priceId: selectedPlan.priceId,
                planId: selectedPlanId
            }
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
        // Prevent multiple calls - Stripe SDK throws "resolve promise more than once" if called twice
        if (isProcessingPayment.current || loading) return;
        isProcessingPayment.current = true;
        setLoading(true);

        try {
            const isInitialized = await initializePaymentSheet();
            if (!isInitialized) {
                setLoading(false);
                isProcessingPayment.current = false;
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
            isProcessingPayment.current = false;
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

                {/* Plan Selection */}
                <View style={styles.plansContainer}>
                    <Text style={styles.sectionHeader}>CHOOSE YOUR PATH</Text>
                    <View style={styles.plansGrid}>
                        {PLANS.map((plan) => {
                            const isSelected = selectedPlanId === plan.id;
                            return (
                                <TouchableOpacity
                                    key={plan.id}
                                    onPress={() => {
                                        import('expo-haptics').then(H => H.selectionAsync());
                                        setSelectedPlanId(plan.id);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Animated.View
                                        style={[
                                            styles.planCard,
                                            isSelected && { borderColor: accentColor, backgroundColor: accentColor + '10' }
                                        ]}
                                    >
                                        {plan.save && (
                                            <View style={[styles.saveBadge, { backgroundColor: accentColor }]}>
                                                <Text style={styles.saveText}>{plan.save}</Text>
                                            </View>
                                        )}
                                        <Text style={[styles.planTitle, isSelected && { color: accentColor }]}>{plan.title}</Text>
                                        <View style={styles.priceRow}>
                                            {(plan as any).originalPrice && (
                                                <Text style={styles.originalPrice}>{(plan as any).originalPrice}</Text>
                                            )}
                                            <Text style={styles.planPrice}>{plan.price}</Text>
                                            <Text style={styles.planPeriod}>{plan.period}</Text>
                                        </View>
                                    </Animated.View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
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
                    price={selectedPlan.price}
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
    plansContainer: {
        marginTop: 40,
        paddingHorizontal: 20,
    },
    sectionHeader: {
        fontSize: 12,
        fontWeight: 'bold',
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: 2,
        marginBottom: 16,
        textAlign: 'center',
        fontFamily: 'Lexend',
    },
    plansGrid: {
        gap: 12,
    },
    planCard: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 2,
        borderColor: 'transparent',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 70,
    },
    saveBadge: {
        position: 'absolute',
        top: -10,
        right: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    saveText: {
        color: '#000',
        fontSize: 10,
        fontWeight: 'bold',
    },
    planTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: 'white',
        fontFamily: 'Lexend',
    },
    priceRow: {
        alignItems: 'flex-end',
    },
    originalPrice: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        textDecorationLine: 'line-through',
        marginRight: 6,
        marginBottom: 4,
        fontFamily: 'Lexend_400Regular',
    },
    planPrice: {
        fontSize: 18,
        fontWeight: 'bold',
        color: 'white',
        fontFamily: 'Lexend',
    },
    planPeriod: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'Lexend_400Regular',
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
