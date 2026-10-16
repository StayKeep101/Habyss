import { FontFamily } from '@/theme/designSystem';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { VoidShell } from '@/components/ui/VoidShell';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { router } from 'expo-router';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { saveDailyTarget } from '@/lib/dailyFocus';

import { useAppSettings } from '@/context/AppSettingsContext';
import { PERSONALITY_MODES } from '@/constants/AIPersonalities';
import { PAYWALL_ENABLED } from '@/constants/features';
import { hasAnyIntegration } from '@/lib/integrationAvailability';
import { APP_SLOGAN } from '@/constants/brand';
import { currentAccount, onAccountChange } from '@/lib/account';
import Constants from 'expo-constants';
import { useHaptics } from '@/hooks/useHaptics';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { styles } from '@/styles/screens/tabs/settings.styles';

export default function ProfileScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { horizontalPadding, topSpacing, tabBarClearance, isCompactWidth } = useResponsiveLayout();

    // User state
    const { selectionFeedback } = useHaptics();
    const dailyTarget = useDailyTarget();
    // You, from the one profile store (lib/profile.ts).
    const me = useMyProfile();
    const username = me.name;
    const avatarUri = me.avatar;

    // Settings state - use global context
    const {
        notificationsEnabled,
        aiPersonality,
    } = useAppSettings();



    // Signed-in state for the Account row. Signing out lives on the Account
    // screen, where it backs up first; the old button here cleared storage with
    // no confirmation and left every habit orphaned under a discarded id.
    const [accountEmail, setAccountEmail] = useState<string | null>(null);
    useEffect(() => {
        currentAccount().then(account => setAccountEmail(account?.email ?? null)).catch(() => undefined);
        return onAccountChange(account => setAccountEmail(account?.email ?? null));
    }, []);

    /** A titled group of rows, as one card. */
    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                {/* Header - No Settings Button */}
                <View style={[styles.header, { paddingHorizontal: horizontalPadding, paddingTop: topSpacing * 0.4 }]}>
                    <View style={{ width: isCompactWidth ? 32 : 40 }} />
                    <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: isCompactWidth ? 26 : 30 }]}>Settings</Text>
                    <View style={{ width: isCompactWidth ? 32 : 40 }} />
                </View>

                <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarClearance, paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
                    {/* Who you are, small: a settings screen is a list, not a poster. */}
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityLabel="Edit your profile"
                        activeOpacity={0.85}
                        onPress={() => { selectionFeedback(); router.push('/(root)/profile'); }}
                        style={styles.profileRow}
                    >
                        <View style={[styles.avatar, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}>
                            {avatarUri ? (
                                <Image source={{ uri: avatarUri }} style={{ width: 56, height: 56 }} />
                            ) : (
                                <Text style={{ fontSize: 20, fontFamily: FontFamily.bold, color: colors.textPrimary }}>
                                    {username[0]?.toUpperCase() || 'U'}
                                </Text>
                            )}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={[styles.profileName, { color: colors.textPrimary }]}>{username || 'You'}</Text>
                            <Text numberOfLines={1} style={[styles.profileMeta, { color: colors.textTertiary }]}>
                                {accountEmail ?? 'Not signed in'}
                            </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                    </TouchableOpacity>

                    {/* Four short groups, each row an icon you can recognise
                        without reading: who you are, your plan, the app, help. */}
                    <SettingsGroup>
                        <SettingsRow icon="person-circle" color="#5B8CFF" label="Account"
                            value={accountEmail ? 'Signed in' : 'Sign in'} onPress={() => router.push('/(root)/account')} />
                        <SettingsRow icon="people" color="#30D158" label="Friends & sharing" onPress={() => router.push('/(root)/sharing')} />
                        <SettingsRow icon="lock-closed" color="#8A8A94" label="Privacy" onPress={() => router.push('/(root)/privacy')} />
                        {PAYWALL_ENABLED ? (
                            <SettingsRow icon="star" color="#FFB020" label="Subscription" onPress={() => router.push('/(root)/paywall')} />
                        ) : null}
                    </SettingsGroup>

                    <SettingsGroup>
                        <SettingsRow icon="checkmark-done" color="#FF9F0A" label="Tasks a day"
                            choices={[{ id: '3', label: '3' }, { id: '5', label: '5' }]}
                            chosen={String(dailyTarget)} onChoose={id => void saveDailyTarget(Number(id) as 3 | 5)} />
                        <SettingsRow icon="repeat" color="#BF5AF2" label="All habits" onPress={() => router.push('/(root)/all-habits')} />
                        <SettingsRow icon="flag" color="#FF453A" label="Goal plans" onPress={() => router.push('/(root)/goal-roadmap')} />
                    </SettingsGroup>

                    <SettingsGroup>
                        <SettingsRow icon="sparkles" color="#5E5CE6" label="Echo"
                            value={PERSONALITY_MODES.find(mode => mode.id === aiPersonality)?.name ?? 'Friendly'}
                            onPress={() => router.push('/(root)/ai-settings')} />
                        <SettingsRow icon="notifications" color="#FF453A" label="Notifications"
                            value={notificationsEnabled ? 'On' : 'Off'} onPress={() => router.push('/(root)/notifications')} />
                        <SettingsRow icon="color-palette" color="#0A84FF" label="Appearance" onPress={() => router.push('/(root)/appearance')} />
                        {hasAnyIntegration() ? (
                            <SettingsRow icon="extension-puzzle" color="#5E5CE6" label="Integrations" onPress={() => router.push('/(root)/integrations')} />
                        ) : null}
                    </SettingsGroup>

                    <SettingsGroup>
                        <SettingsRow icon="book" color="#FFB020" label="How Habyss works" onPress={() => router.push('/(root)/guide')} />
                        <SettingsRow icon="help-buoy" color="#64D2FF" label="Help" onPress={() => router.push('/(root)/help')} />
                        <SettingsRow icon="grid" color="#8A8A94" label="UI catalogue" onPress={() => router.push('/(root)/ui-catalog')} />
                    </SettingsGroup>

                    <View style={styles.footer}>
                        <Text style={[styles.quote, { color: colors.textSecondary }]}>{APP_SLOGAN}</Text>
                        <Text style={[styles.version, { color: colors.textTertiary }]}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </VoidShell>
    );
}
