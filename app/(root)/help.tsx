import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { LinearGradient } from 'expo-linear-gradient';

interface FAQItem {
    question: string;
    answer: string;
    icon: string;
}

const faqData: FAQItem[] = [
    {
        question: "How do I create a new habit?",
        answer: "Tap the + button on the home screen, then select 'Create Habit'. Fill in the name, category, and schedule. You can also link it to a goal for better tracking.",
        icon: "add-circle"
    },
    {
        question: "What are Goals and how do they work?",
        answer: "Goals are long-term objectives that can contain multiple habits. When you complete habits linked to a goal, the goal's progress increases automatically. Set a deadline to stay accountable.",
        icon: "flag"
    },
    {
        question: "How is my streak calculated?",
        answer: "Your streak counts consecutive days where you've completed at least one scheduled habit. Missing a day resets your streak to zero. Pro tip: Complete easier habits on busy days to maintain momentum.",
        icon: "flame"
    },
    {
        question: "What does the AI Coach do?",
        answer: "ABYSS, our AI coach, provides personalized advice based on behavioral science. It can create habits for you, analyze your patterns, and offer motivation tailored to your personality setting.",
        icon: "sparkles"
    },
    {
        question: "How do I share habits with friends?",
        answer: "Go to the Community tab, tap 'Add Friend' and share your unique friend code. Once connected, you can share habits and see each other's progress for mutual accountability.",
        icon: "people"
    },
    {
        question: "Can I customize when I get reminders?",
        answer: "Yes! Go to Settings → Notifications. You can set custom reminder times for each habit, enable/disable daily summaries, and choose celebration notifications.",
        icon: "notifications"
    },
    {
        question: "What's the difference between Pro and Free?",
        answer: "Pro unlocks: Unlimited goals, AI coaching, advanced analytics, custom themes, habit sharing, priority support, and no ads. Free users get core habit tracking with basic features.",
        icon: "star"
    },
    {
        question: "How do I backup my data?",
        answer: "Go to Settings → Backup & Restore. Your data syncs automatically to the cloud when signed in. You can also export your habits and progress as a file.",
        icon: "cloud-upload"
    },
];

const HelpCenter = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback } = useHaptics();

    const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);

    const handleExpand = (index: number) => {
        lightFeedback();
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        onPress={() => {
                            lightFeedback();
                            router.back();
                        }}
                        style={[styles.backButton, { backgroundColor: colors.surfaceSecondary }]}
                    >
                        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <View>
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Help Center</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                            Answers to common questions
                        </Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* Hero Section */}
                    <VoidCard style={styles.heroCard}>
                        <LinearGradient
                            colors={['rgba(59, 130, 246, 0.3)', 'rgba(139, 92, 246, 0.3)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.heroGradient}
                        >
                            <Ionicons name="help-buoy" size={48} color="#8B5CF6" />
                            <Text style={styles.heroTitle}>How can we help?</Text>
                            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
                                Find answers to frequently asked questions about Habyss
                            </Text>
                        </LinearGradient>
                    </VoidCard>

                    {/* Quick Links */}
                    <View style={styles.quickLinks}>
                        <TouchableOpacity
                            style={[styles.quickLink, { backgroundColor: colors.surfaceSecondary }]}
                            onPress={() => {
                                lightFeedback();
                                router.push('/(root)/contact');
                            }}
                        >
                            <Ionicons name="chatbubbles" size={24} color={colors.primary} />
                            <Text style={[styles.quickLinkText, { color: colors.textPrimary }]}>Contact Us</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.quickLink, { backgroundColor: colors.surfaceSecondary }]}
                            onPress={() => {
                                lightFeedback();
                                Linking.openURL('https://habyss.com/docs');
                            }}
                        >
                            <Ionicons name="book" size={24} color={colors.success} />
                            <Text style={[styles.quickLinkText, { color: colors.textPrimary }]}>Full Docs</Text>
                        </TouchableOpacity>
                    </View>

                    {/* FAQ Section */}
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                        Frequently Asked Questions
                    </Text>

                    {faqData.map((faq, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[styles.faqItem, { backgroundColor: colors.surfaceSecondary }]}
                            onPress={() => handleExpand(index)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.faqHeader}>
                                <View style={[styles.faqIcon, { backgroundColor: colors.primary + '20' }]}>
                                    <Ionicons name={faq.icon as any} size={18} color={colors.primary} />
                                </View>
                                <Text style={[styles.faqQuestion, { color: colors.textPrimary }]}>
                                    {faq.question}
                                </Text>
                                <Ionicons
                                    name={expandedIndex === index ? "chevron-up" : "chevron-down"}
                                    size={20}
                                    color={colors.textTertiary}
                                />
                            </View>
                            {expandedIndex === index && (
                                <Text style={[styles.faqAnswer, { color: colors.textSecondary }]}>
                                    {faq.answer}
                                </Text>
                            )}
                        </TouchableOpacity>
                    ))}

                    {/* Still Need Help */}
                    <VoidCard style={styles.needHelpCard}>
                        <Ionicons name="chatbox-ellipses" size={32} color={colors.primary} />
                        <Text style={[styles.needHelpTitle, { color: colors.textPrimary }]}>
                            Still need help?
                        </Text>
                        <Text style={[styles.needHelpSubtitle, { color: colors.textSecondary }]}>
                            Our support team typically responds within 24 hours
                        </Text>
                        <TouchableOpacity
                            style={[styles.contactButton, { backgroundColor: colors.primary }]}
                            onPress={() => {
                                lightFeedback();
                                router.push('/(root)/contact');
                            }}
                        >
                            <Text style={styles.contactButtonText}>Contact Support</Text>
                        </TouchableOpacity>
                    </VoidCard>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </SafeAreaView>
        </VoidShell>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    headerSubtitle: {
        fontSize: 13,
        fontFamily: 'Lexend_400Regular',
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    heroCard: {
        marginBottom: 20,
        overflow: 'hidden',
    },
    heroGradient: {
        padding: 24,
        alignItems: 'center',
        borderRadius: 16,
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#fff',
        fontFamily: 'Lexend',
        marginTop: 12,
    },
    heroSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        fontFamily: 'Lexend_400Regular',
    },
    quickLinks: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    quickLink: {
        flex: 1,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        gap: 8,
    },
    quickLinkText: {
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Lexend',
        marginBottom: 16,
    },
    faqItem: {
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    faqHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    faqIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    faqQuestion: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
    faqAnswer: {
        marginTop: 12,
        marginLeft: 48,
        fontSize: 14,
        lineHeight: 22,
        fontFamily: 'Lexend_400Regular',
    },
    needHelpCard: {
        marginTop: 8,
        padding: 24,
        alignItems: 'center',
    },
    needHelpTitle: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Lexend',
        marginTop: 12,
    },
    needHelpSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
        fontFamily: 'Lexend_400Regular',
    },
    contactButton: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    contactButtonText: {
        color: '#000',
        fontSize: 15,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
});

export default HelpCenter;
