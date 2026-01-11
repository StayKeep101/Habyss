import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { useHaptics } from '@/hooks/useHaptics';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useTheme } from '@/constants/themeContext';

const About = () => {
    // const colorScheme = useColorScheme();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { lightFeedback } = useHaptics();

    const version = Constants.expoConfig?.version || '1.0.0';

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>About</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {/* Logo & Name */}
                    <View style={styles.logoSection}>
                        <LinearGradient
                            colors={['#3B82F6', '#8B5CF6', '#EC4899']}
                            style={styles.logoGradient}
                        >
                            <Ionicons name="infinite" size={40} color="#fff" />
                        </LinearGradient>
                        <Text style={[styles.appName, { color: colors.textPrimary }]}>Habyss</Text>
                        <Text style={[styles.version, { color: colors.textSecondary }]}>Version {version}</Text>
                    </View>

                    {/* Tagline */}
                    <Text style={[styles.tagline, { color: colors.textSecondary }]}>
                        Descend into Discipline
                    </Text>

                    {/* Links */}
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
                        <TouchableOpacity
                            style={styles.linkRow}
                            onPress={() => { lightFeedback(); Linking.openURL('https://habyss.app/privacy'); }}
                        >
                            <Ionicons name="shield-outline" size={20} color={colors.textSecondary} />
                            <Text style={[styles.linkText, { color: colors.textPrimary }]}>Privacy Policy</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        <TouchableOpacity
                            style={styles.linkRow}
                            onPress={() => { lightFeedback(); Linking.openURL('https://habyss.app/terms'); }}
                        >
                            <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
                            <Text style={[styles.linkText, { color: colors.textPrimary }]}>Terms of Service</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </TouchableOpacity>
                    </VoidCard>

                    {/* Footer */}
                    <Text style={[styles.footer, { color: colors.textTertiary }]}>
                        Made with ♥ for habit builders
                    </Text>
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
        alignItems: 'center',
    },
    logoSection: {
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 16,
    },
    logoGradient: {
        width: 80,
        height: 80,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    appName: {
        fontSize: 28,
        fontWeight: '800',
        fontFamily: 'Lexend',
    },
    version: {
        fontSize: 13,
        fontFamily: 'Lexend_400Regular',
        marginTop: 4,
    },
    tagline: {
        fontSize: 15,
        fontStyle: 'italic',
        fontFamily: 'Lexend_400Regular',
        marginBottom: 32,
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        width: '100%',
    },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        gap: 12,
    },
    linkText: {
        flex: 1,
        fontSize: 15,
        fontFamily: 'Lexend_400Regular',
    },
    divider: {
        height: 1,
        marginHorizontal: 16,
    },
    footer: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
        marginTop: 32,
    },
});

export default About;
