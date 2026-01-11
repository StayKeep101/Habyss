import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';

import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useTheme } from '@/constants/themeContext';

const Help = () => {
    // const colorScheme = useColorScheme();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { lightFeedback } = useHaptics();

    const faqs = [
        { q: 'How do I create a habit?', a: 'Tap the + button on the home screen to create a new habit.' },
        { q: 'How do streaks work?', a: 'Complete all habits for a day to maintain your streak.' },
        { q: 'Can I use Habyss offline?', a: 'Yes! Your habits sync when you\'re back online.' },
    ];

    const openEmail = () => {
        lightFeedback();
        Linking.openURL('mailto:support@habyss.app');
    };



    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Help</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* FAQ */}
                <View style={styles.content}>


                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>FAQ</Text>
                    <VoidCard
                        glass={!isTrueDark}
                        intensity={isLight ? 20 : 80}
                        style={[
                            styles.card,
                            {
                                backgroundColor: isLight ? colors.surfaceSecondary : undefined,
                                borderColor: colors.border
                            }
                        ]}
                    >
                        {faqs.map((item, index) => (
                            <View key={index}>
                                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                                <View style={styles.faqItem}>
                                    <Text style={[styles.question, { color: colors.textPrimary }]}>{item.q}</Text>
                                    <Text style={[styles.answer, { color: colors.textSecondary }]}>{item.a}</Text>
                                </View>
                            </View>
                        ))}
                    </VoidCard>

                    {/* Contact */}
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>NEED MORE HELP?</Text>
                    <TouchableOpacity onPress={openEmail} activeOpacity={0.7}>
                        <VoidCard
                            glass={!isTrueDark}
                            intensity={isLight ? 20 : 80}
                            style={[
                                styles.contactBtn,
                                {
                                    backgroundColor: isLight ? colors.surfaceSecondary : undefined,
                                    borderColor: colors.border
                                }
                            ]}
                        >
                            <Ionicons name="mail-outline" size={22} color={colors.primary} />
                            <Text style={[styles.contactText, { color: colors.textPrimary }]}>Email Support</Text>
                            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                        </VoidCard>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </VoidShell>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    backBtn: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    content: {
        padding: 16,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
        marginLeft: 4,
        fontFamily: 'Lexend_400Regular',
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    faqItem: {
        padding: 16,
    },
    question: {
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'Lexend',
        marginBottom: 6,
    },
    answer: {
        fontSize: 13,
        fontFamily: 'Lexend_400Regular',
        lineHeight: 20,
    },
    divider: {
        height: 1,
        marginHorizontal: 16,
    },
    contactBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        gap: 12,
    },
    contactText: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },


});
export default Help;
