import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Linking, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { LinearGradient } from 'expo-linear-gradient';

const contactOptions = [
    {
        id: 'email',
        icon: 'mail',
        title: 'Email Support',
        subtitle: 'support@habyss.com',
        description: 'Response within 24-48 hours',
        action: () => Linking.openURL('mailto:support@habyss.com'),
    },
    {
        id: 'twitter',
        icon: 'logo-twitter',
        title: 'Twitter / X',
        subtitle: '@habyss_app',
        description: 'DM us for quick questions',
        action: () => Linking.openURL('https://twitter.com/habyss_app'),
    },
    {
        id: 'discord',
        icon: 'logo-discord',
        title: 'Discord Community',
        subtitle: 'Join 5,000+ users',
        description: 'Get help from the community',
        action: () => Linking.openURL('https://discord.gg/habyss'),
    },
];

const ContactSupport = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback, successFeedback } = useHaptics();

    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);

    const handleSubmit = async () => {
        if (!subject.trim() || !message.trim()) {
            Alert.alert('Missing Information', 'Please fill in both the subject and message.');
            return;
        }

        lightFeedback();
        setSending(true);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));

        setSending(false);
        successFeedback();
        Alert.alert(
            'Message Sent! 🎉',
            'Thanks for reaching out! We typically respond within 24-48 hours.',
            [{ text: 'OK', onPress: () => router.back() }]
        );
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
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Contact Support</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                            We're here to help
                        </Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    {/* Hero */}
                    <VoidCard style={styles.heroCard}>
                        <LinearGradient
                            colors={['rgba(236, 72, 153, 0.3)', 'rgba(139, 92, 246, 0.3)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.heroGradient}
                        >
                            <Ionicons name="chatbubbles" size={48} color="#EC4899" />
                            <Text style={styles.heroTitle}>Get in Touch</Text>
                            <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
                                Have a question, feedback, or issue? We'd love to hear from you.
                            </Text>
                        </LinearGradient>
                    </VoidCard>

                    {/* Quick Contact Options */}
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                        Quick Contact
                    </Text>

                    {contactOptions.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            style={[styles.contactOption, { backgroundColor: colors.surfaceSecondary }]}
                            onPress={() => {
                                lightFeedback();
                                option.action();
                            }}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.contactIcon, { backgroundColor: colors.primary + '20' }]}>
                                <Ionicons name={option.icon as any} size={22} color={colors.primary} />
                            </View>
                            <View style={styles.contactContent}>
                                <Text style={[styles.contactTitle, { color: colors.textPrimary }]}>
                                    {option.title}
                                </Text>
                                <Text style={[styles.contactSubtitle, { color: colors.primary }]}>
                                    {option.subtitle}
                                </Text>
                                <Text style={[styles.contactDescription, { color: colors.textTertiary }]}>
                                    {option.description}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
                        </TouchableOpacity>
                    ))}

                    {/* Contact Form */}
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 24 }]}>
                        Send a Message
                    </Text>

                    <VoidCard style={styles.formCard}>
                        <View style={styles.formField}>
                            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>SUBJECT</Text>
                            <TextInput
                                style={[styles.formInput, { color: colors.textPrimary, borderColor: colors.border }]}
                                placeholder="What's this about?"
                                placeholderTextColor={colors.textTertiary}
                                value={subject}
                                onChangeText={setSubject}
                            />
                        </View>

                        <View style={styles.formField}>
                            <Text style={[styles.formLabel, { color: colors.textSecondary }]}>MESSAGE</Text>
                            <TextInput
                                style={[styles.formTextArea, { color: colors.textPrimary, borderColor: colors.border }]}
                                placeholder="Describe your question or issue in detail..."
                                placeholderTextColor={colors.textTertiary}
                                value={message}
                                onChangeText={setMessage}
                                multiline
                                numberOfLines={5}
                                textAlignVertical="top"
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.submitButton, { opacity: sending ? 0.7 : 1 }]}
                            onPress={handleSubmit}
                            disabled={sending}
                        >
                            <LinearGradient
                                colors={['#3B82F6', '#8B5CF6', '#EC4899']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.submitGradient}
                            >
                                {sending ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="send" size={18} color="#fff" />
                                        <Text style={styles.submitText}>Send Message</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </VoidCard>

                    {/* Response Time */}
                    <View style={[styles.responseTime, { backgroundColor: colors.surfaceSecondary }]}>
                        <Ionicons name="time" size={20} color={colors.success} />
                        <Text style={[styles.responseText, { color: colors.textSecondary }]}>
                            Average response time: <Text style={{ color: colors.success, fontWeight: '600' }}>24 hours</Text>
                        </Text>
                    </View>

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
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Lexend',
        marginBottom: 16,
    },
    contactOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        gap: 12,
    },
    contactIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    contactContent: {
        flex: 1,
    },
    contactTitle: {
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
    contactSubtitle: {
        fontSize: 14,
        fontFamily: 'Lexend_400Regular',
    },
    contactDescription: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2,
    },
    formCard: {
        padding: 20,
    },
    formField: {
        marginBottom: 16,
    },
    formLabel: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
        fontFamily: 'Lexend_400Regular',
    },
    formInput: {
        height: 50,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        fontFamily: 'Lexend_400Regular',
    },
    formTextArea: {
        minHeight: 120,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingTop: 12,
        fontSize: 16,
        fontFamily: 'Lexend_400Regular',
    },
    submitButton: {
        marginTop: 8,
    },
    submitGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 12,
    },
    submitText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    responseTime: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 16,
        borderRadius: 12,
        marginTop: 16,
    },
    responseText: {
        fontSize: 14,
        fontFamily: 'Lexend_400Regular',
    },
});

export default ContactSupport;
