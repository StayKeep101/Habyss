import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Linking, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { LinearGradient } from 'expo-linear-gradient';

const APP_VERSION = '1.0.4';
const BUILD_NUMBER = '2026.01.06';

const teamMembers = [
    { name: 'Erwan', role: 'Founder & Developer', emoji: '👨‍💻' },
];

const socialLinks = [
    { id: 'twitter', icon: 'logo-twitter', label: 'Twitter', url: 'https://twitter.com/habyss_app' },
    { id: 'instagram', icon: 'logo-instagram', label: 'Instagram', url: 'https://instagram.com/habyss_app' },
    { id: 'discord', icon: 'logo-discord', label: 'Discord', url: 'https://discord.gg/habyss' },
    { id: 'github', icon: 'logo-github', label: 'GitHub', url: 'https://github.com/habyss' },
];

const legalLinks = [
    { id: 'privacy', title: 'Privacy Policy', icon: 'shield-checkmark', route: '/(root)/privacy' },
    { id: 'terms', title: 'Terms of Service', icon: 'document-text', url: 'https://habyss.com/terms' },
    { id: 'licenses', title: 'Open Source Licenses', icon: 'code-slash', url: 'https://habyss.com/licenses' },
];

const About = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { lightFeedback } = useHaptics();

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
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>About Habyss</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent}>
                    {/* App Logo & Info */}
                    <View style={styles.appInfo}>
                        <LinearGradient
                            colors={['#3B82F6', '#8B5CF6', '#EC4899']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.logoContainer}
                        >
                            <Text style={styles.logoText}>H</Text>
                        </LinearGradient>
                        <Text style={[styles.appName, { color: colors.textPrimary }]}>Habyss</Text>
                        <Text style={[styles.tagline, { color: colors.textSecondary }]}>
                            Descend into discipline
                        </Text>
                        <View style={[styles.versionBadge, { backgroundColor: colors.surfaceSecondary }]}>
                            <Text style={[styles.versionText, { color: colors.textTertiary }]}>
                                Version {APP_VERSION} • Build {BUILD_NUMBER}
                            </Text>
                        </View>
                    </View>

                    {/* Mission Statement */}
                    <VoidCard style={styles.missionCard}>
                        <LinearGradient
                            colors={['rgba(59, 130, 246, 0.2)', 'rgba(139, 92, 246, 0.2)', 'rgba(236, 72, 153, 0.2)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.missionGradient}
                        >
                            <Ionicons name="rocket" size={32} color="#8B5CF6" />
                            <Text style={[styles.missionTitle, { color: colors.textPrimary }]}>
                                Our Mission
                            </Text>
                            <Text style={[styles.missionText, { color: colors.textSecondary }]}>
                                We believe that small, consistent actions lead to extraordinary results.
                                Habyss was built to help you build the habits that shape your future self.
                            </Text>
                            <Text style={[styles.missionText, { color: colors.textSecondary, marginTop: 12 }]}>
                                Using behavioral science and AI, we make habit building intuitive,
                                social, and dare we say... fun.
                            </Text>
                        </LinearGradient>
                    </VoidCard>

                    {/* The Team */}
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                        The Team
                    </Text>
                    <VoidCard style={styles.teamCard}>
                        {teamMembers.map((member, index) => (
                            <View key={index} style={styles.teamMember}>
                                <Text style={styles.teamEmoji}>{member.emoji}</Text>
                                <View>
                                    <Text style={[styles.teamName, { color: colors.textPrimary }]}>
                                        {member.name}
                                    </Text>
                                    <Text style={[styles.teamRole, { color: colors.textSecondary }]}>
                                        {member.role}
                                    </Text>
                                </View>
                            </View>
                        ))}
                        <Text style={[styles.teamNote, { color: colors.textTertiary }]}>
                            Built with ❤️ and too much coffee
                        </Text>
                    </VoidCard>

                    {/* Social Links */}
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                        Follow Us
                    </Text>
                    <View style={styles.socialGrid}>
                        {socialLinks.map((social) => (
                            <TouchableOpacity
                                key={social.id}
                                style={[styles.socialButton, { backgroundColor: colors.surfaceSecondary }]}
                                onPress={() => {
                                    lightFeedback();
                                    Linking.openURL(social.url);
                                }}
                            >
                                <Ionicons name={social.icon as any} size={24} color={colors.primary} />
                                <Text style={[styles.socialLabel, { color: colors.textSecondary }]}>
                                    {social.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Legal Links */}
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                        Legal
                    </Text>
                    <VoidCard style={styles.legalCard}>
                        {legalLinks.map((link, index) => (
                            <React.Fragment key={link.id}>
                                <TouchableOpacity
                                    style={styles.legalItem}
                                    onPress={() => {
                                        lightFeedback();
                                        if (link.route) {
                                            router.push(link.route as any);
                                        } else if (link.url) {
                                            Linking.openURL(link.url);
                                        }
                                    }}
                                >
                                    <View style={[styles.legalIcon, { backgroundColor: colors.primary + '20' }]}>
                                        <Ionicons name={link.icon as any} size={18} color={colors.primary} />
                                    </View>
                                    <Text style={[styles.legalText, { color: colors.textPrimary }]}>
                                        {link.title}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                                </TouchableOpacity>
                                {index < legalLinks.length - 1 && (
                                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                                )}
                            </React.Fragment>
                        ))}
                    </VoidCard>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={[styles.copyright, { color: colors.textTertiary }]}>
                            © 2026 Habyss. All rights reserved.
                        </Text>
                        <Text style={[styles.footerNote, { color: colors.textTertiary }]}>
                            Made with React Native & Expo
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
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    appInfo: {
        alignItems: 'center',
        marginBottom: 24,
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoText: {
        fontSize: 40,
        fontWeight: '900',
        color: '#fff',
        fontFamily: 'Lexend',
    },
    appName: {
        fontSize: 28,
        fontWeight: '800',
        fontFamily: 'Lexend',
        marginTop: 16,
    },
    tagline: {
        fontSize: 16,
        fontFamily: 'Lexend_400Regular',
        marginTop: 4,
    },
    versionBadge: {
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    versionText: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
    },
    missionCard: {
        marginBottom: 24,
        overflow: 'hidden',
    },
    missionGradient: {
        padding: 24,
        alignItems: 'center',
        borderRadius: 16,
    },
    missionTitle: {
        fontSize: 20,
        fontWeight: '700',
        fontFamily: 'Lexend',
        marginTop: 12,
    },
    missionText: {
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'center',
        fontFamily: 'Lexend_400Regular',
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Lexend',
        marginBottom: 16,
    },
    teamCard: {
        padding: 20,
        marginBottom: 24,
    },
    teamMember: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    teamEmoji: {
        fontSize: 32,
    },
    teamName: {
        fontSize: 16,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
    teamRole: {
        fontSize: 13,
        fontFamily: 'Lexend_400Regular',
    },
    teamNote: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
        textAlign: 'center',
        marginTop: 8,
    },
    socialGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 24,
    },
    socialButton: {
        width: '47%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 14,
        borderRadius: 14,
    },
    socialLabel: {
        fontSize: 14,
        fontFamily: 'Lexend_400Regular',
    },
    legalCard: {
        padding: 4,
        marginBottom: 24,
    },
    legalItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 12,
    },
    legalIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    legalText: {
        flex: 1,
        fontSize: 15,
        fontFamily: 'Lexend',
    },
    divider: {
        height: 1,
        marginHorizontal: 14,
    },
    footer: {
        alignItems: 'center',
        paddingVertical: 20,
    },
    copyright: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
    },
    footerNote: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
        marginTop: 4,
    },
});

export default About;
