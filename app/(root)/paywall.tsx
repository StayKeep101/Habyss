import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, SafeAreaView, StyleSheet, StatusBar, ScrollView, Dimensions, Platform } from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';
import RevenueCatService from '@/lib/RevenueCat';
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
    const [packages, setPackages] = useState<PurchasesPackage[]>([]);
    const [selectedPackage, setSelectedPackage] = useState<PurchasesPackage | null>(null);
    const [loading, setLoading] = useState(false);

    // Fallback Plans in case RevenueCat fails or for design preview
    const FALLBACK_PLANS = [
        { identifier: 'yearly', product: { priceString: '$12.99', title: 'Yearly' } },
        { identifier: 'lifetime', product: { priceString: '$29.99', title: 'Lifetime' } }
    ];

    const { primary: accentColor } = useAccentGradient();

    // Initialize & Fetch Offerings
    useEffect(() => {
        const loadOfferings = async () => {
            try {
                const offerings = await RevenueCatService.getOfferings();
                if (offerings && offerings.availablePackages.length > 0) {
                    setPackages(offerings.availablePackages);
                    // Select yearly by default if available, else first one
                    const yearly = offerings.availablePackages.find(p => p.packageType === 'ANNUAL');
                    setSelectedPackage(yearly || offerings.availablePackages[0]);
                }
            } catch (e) {
                console.warn('Failed to load offerings', e);
            }
        };
        loadOfferings();
    }, []);

    const handleSubscribe = async () => {
        if (loading || !selectedPackage) return;
        setLoading(true);

        try {
            const result = await RevenueCatService.purchasePackage(selectedPackage);
            if (result.isPro) {
                Alert.alert('Ascension Complete', 'Welcome to the cosmos. 🎉');
                router.back();
            }
        } catch (e: any) {
            if (e.message !== 'User cancelled') {
                Alert.alert('Error', e.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async () => {
        setLoading(true);
        try {
            const isPro = await RevenueCatService.restorePurchases();
            if (isPro) {
                Alert.alert('Restored', 'Your cosmic access has been restored.');
                router.back();
            } else {
                Alert.alert('Restore Failed', 'No active subscription found.');
            }
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

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
                                <View style={[styles.iconBox, { backgroundColor: benefit.color + '20', borderColor: benefit.color + '30' }]}>
                                    <Ionicons name={benefit.icon as any} size={28} color={benefit.color} />
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
                        {(packages.length > 0 ? packages : FALLBACK_PLANS).map((pkg: any) => {
                            const isSelected = selectedPackage?.identifier === pkg.identifier || (packages.length === 0 && pkg.identifier === 'yearly');
                            const title = pkg.product.title.replace(/\s*\((.*?)\)\s*/g, ''); // Remove (Duration) from title if present

                            return (
                                <TouchableOpacity
                                    key={pkg.identifier}
                                    onPress={() => {
                                        import('expo-haptics').then(H => H.selectionAsync());
                                        if (packages.length > 0) {
                                            setSelectedPackage(pkg);
                                        }
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <Animated.View
                                        style={[
                                            styles.planCard,
                                            isSelected && { borderColor: accentColor, backgroundColor: accentColor + '10' }
                                        ]}
                                    >
                                        {/* Badge logic can be added here if we identify 'best value' etc */}
                                        {pkg.packageType === 'LIFETIME' && (
                                            <View style={[styles.saveBadge, { backgroundColor: accentColor }]}>
                                                <Text style={styles.saveText}>BEST VALUE</Text>
                                            </View>
                                        )}
                                        {pkg.packageType === 'ANNUAL' && (
                                            <View style={[styles.saveBadge, { backgroundColor: accentColor }]}>
                                                <Text style={styles.saveText}>MOST POPULAR</Text>
                                            </View>
                                        )}

                                        <Text style={[styles.planTitle, isSelected && { color: accentColor }]}>
                                            {title || pkg.product.title}
                                        </Text>
                                        <View style={styles.priceRow}>
                                            <Text style={styles.planPrice}>{pkg.product.priceString}</Text>
                                            {/* Period logic */}
                                            <Text style={styles.planPeriod}>
                                                {pkg.packageType === 'ANNUAL' ? '/yr' :
                                                    pkg.packageType === 'MONTHLY' ? '/mo' :
                                                        pkg.packageType === 'LIFETIME' ? 'one-time' : ''}
                                            </Text>
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
                    price={selectedPackage?.product.priceString || packages[0]?.product.priceString || '$6.99'}
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
        marginTop: Platform.OS === 'android' ? 40 : 10, // Adjust for status bar
    },
    scrollContent: {
        paddingTop: 100,
        paddingBottom: 200, // Increased to avoid overlap with bottom bar
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
        padding: 20, // Increased padding
        gap: 20, // Increased gap
        backgroundColor: 'rgba(20, 20, 30, 0.6)',
        minHeight: 100, // Ensure substantial vertical size
    },
    iconBox: {
        width: 56, // Bigger icon box
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1, // Added border for style
    },
    benefitTextContent: {
        flex: 1,
    },
    benefitTitle: {
        fontSize: 18, // Bigger title
        color: 'white',
        fontFamily: 'Lexend',
        marginBottom: 6,
        fontWeight: '600',
    },
    benefitDesc: {
        fontSize: 14, // Bigger desc
        color: 'rgba(255,255,255,0.7)',
        fontFamily: 'Lexend_400Regular',
        lineHeight: 20,
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
        paddingTop: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24, // Explicit padding for bottom safe area
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 20,
    },
    restoreBtn: {
        alignItems: 'center',
        marginTop: 16, // More space between button and restore text
        paddingVertical: 8,
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
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        fontWeight: '600',
        fontFamily: 'Lexend_400Regular',
    }
});
