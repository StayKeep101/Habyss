import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';

const Help = () => {
    const colorScheme = useColorScheme();
    const colors = Colors[colorScheme ?? 'dark'];
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
        <View style={[styles.container, { backgroundColor: colors.background }]}>
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
                    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                        {faqs.map((item, index) => (
                            <View key={index}>
                                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                                <View style={styles.faqItem}>
                                    <Text style={[styles.question, { color: colors.textPrimary }]}>{item.q}</Text>
                                    <Text style={[styles.answer, { color: colors.textSecondary }]}>{item.a}</Text>
                                </View>
                            </View>
                        ))}
                    </View>

                    {/* Contact */}
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 24 }]}>NEED MORE HELP?</Text>
                    <TouchableOpacity
                        style={[styles.contactBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={openEmail}
                    >
                        <Ionicons name="mail-outline" size={22} color={colors.primary} />
                        <Text style={[styles.contactText, { color: colors.textPrimary }]}>Email Support</Text>
                        <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </View>
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
