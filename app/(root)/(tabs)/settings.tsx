import { FontFamily } from '@/theme/designSystem';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SettingsGroup, SettingsRow, SettingsSearch } from '@/components/ui/SettingsList';
import { AppTextField } from '@/components/ui/AppTextField';
import { searchDeep } from '@/lib/settingsSearch';
import { VoidShell } from '@/components/ui/VoidShell';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { router } from 'expo-router';
import { emit, on } from '@/lib/appEvents';
import { useMyProfile } from '@/hooks/useMyProfile';

import { useAppSettings } from '@/context/AppSettingsContext';
import { cachedDayWindow, DEFAULT_DAY, getDayWindow, minutesOf } from '@/lib/echo';
import { clockLabel } from '@/lib/dayFlow';
import { PERSONALITY_MODES } from '@/constants/AIPersonalities';
import { usePro } from '@/hooks/usePro';
import { hasAnyIntegration } from '@/lib/integrationAvailability';
import { APP_SLOGAN } from '@/constants/brand';
import { currentAccount, knownAccount, onAccountChange } from '@/lib/account';
import Constants from 'expo-constants';
import { useHaptics } from '@/hooks/useHaptics';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { styles } from '@/styles/screens/tabs/settings.styles';

/** The Developer page shows outside production: in development, and on preview builds. */
const showDeveloper = (() => {
    if (__DEV__) return true;
    try {
        const channel = (require('expo-updates') as typeof import('expo-updates')).channel;
        return !!channel && channel !== 'production';
    } catch {
        return false;
    }
})();

export default function ProfileScreen() {
    const pro = usePro();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { horizontalPadding, topSpacing, tabBarClearance, isCompactWidth } = useResponsiveLayout();

    // User state
    const { selectionFeedback } = useHaptics();
    // You, from the one profile store (lib/profile.ts).
    const me = useMyProfile();
    const [day, setDay] = useState(() => cachedDayWindow() ?? DEFAULT_DAY);
    useEffect(() => { void getDayWindow().then(setDay).catch(() => undefined); }, []);
    const dayHours = `${clockLabel(minutesOf(day.wake))} – ${clockLabel(minutesOf(day.sleep))}`;
    // The + on this tab is a search lens: it opens the field, and the rows filter as you type.
    const [searching, setSearching] = useState(false);
    const [query, setQuery] = useState('');
    const scroll = useRef<ScrollView>(null);
    useEffect(() => {
        const sub = on('show_settings_search', () => { setSearching(true); scroll.current?.scrollTo({ y: 0, animated: true }); });
        return () => sub.remove();
    }, []);
    const stopSearching = () => { setQuery(''); setSearching(false); };
    const deep = searchDeep(query);
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
    const [accountEmail, setAccountEmail] = useState<string | null>(() => knownAccount()?.email ?? null);
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

                {searching ? (
                    <View style={[styles.search, { paddingHorizontal: horizontalPadding }]}>
                        <AppTextField value={query} onChangeText={setQuery} accessibilityLabel="Search settings" placeholder="Search settings" autoFocus returnKeyType="search"
                            autoCorrect={false} leadingIcon="search" trailingIcon="close-circle" trailingAccessibilityLabel="Close search" onTrailingPress={stopSearching} />
                    </View>
                ) : null}

                <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarClearance, paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
                    <SettingsSearch value={query}>
                    {/* Who you are, small: a settings screen is a list, not a poster. */}
                    {query.trim() ? null : <TouchableOpacity
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
                    </TouchableOpacity>}

                    {/* One topic per group, each setting in exactly one place, named by the question
                        people come with: when is my day, what gets blocked, when does my phone buzz.
                        Only pages here; what they hold is one tap away, and found by search. */}
                    <SettingsGroup title="Your day">
                        {/* Wake and bed times, planning, calendar and meals: what the timeline is built around. */}
                        <SettingsRow icon="time" color="#FF9F0A" label="Day & calendar" keywords="wake bedtime sleep meals tasks a day week starts auto-reschedule calendar"
                            value={dayHours} onPress={() => router.push('/(root)/meals' as never)} />
                        <SettingsRow icon="timer" color="#FF375F" label="Focus" keywords="clock style ring digital block"
                            onPress={() => router.push('/(root)/focus-settings' as never)} />
                        <SettingsRow icon="lock-closed" color="#FF375F" label="App blocking" keywords="screen time earn your scroll bedtime lock top 3 apps to block hard lock"
                            onPress={() => router.push('/(root)/app-blocking' as never)} />
                    </SettingsGroup>

                    <SettingsGroup title="Echo & alerts">
                        {/* How Echo talks: its voice, what it remembers, the on-device model. */}
                        <SettingsRow icon="sparkles" color="#5E5CE6" label="Echo"
                            value={PERSONALITY_MODES.find(mode => mode.id === aiPersonality)?.name ?? 'Friendly'}
                            onPress={() => router.push('/(root)/ai-settings')} />
                        {/* When your phone buzzes: every reminder, the morning alarm and check-ins. */}
                        <SettingsRow icon="notifications" color="#FF453A" label="Notifications" keywords="alarm morning check-in weekly review reminders live activities"
                            value={notificationsEnabled ? 'On' : 'Off'} onPress={() => router.push('/(root)/notifications')} />
                    </SettingsGroup>

                    <SettingsGroup title="People">
                        <SettingsRow icon="people" color="#30D158" label="Friends & sharing" onPress={() => router.push('/(root)/sharing')} />
                    </SettingsGroup>

                    <SettingsGroup title="App">
                        <SettingsRow icon="color-palette" color="#0A84FF" label="Appearance" keywords="theme dark light accent sound music vibration" onPress={() => router.push('/(root)/appearance')} />
                        <SettingsRow icon="add-circle" color="#0A84FF" label="Plus button" keywords="+ create menu shortcut mood energy bet hold say voice speak" onPress={() => router.push('/(root)/plus-button' as never)} />
                        {hasAnyIntegration() ? (
                            <SettingsRow icon="extension-puzzle" color="#0A84FF" label="Connected apps" onPress={() => router.push('/(root)/integrations')} />
                        ) : null}
                    </SettingsGroup>

                    <SettingsGroup title="Account">
                        <SettingsRow icon="person-circle" color="#5B8CFF" label="Account & backup"
                            value={accountEmail ? 'Signed in' : 'Sign in'} onPress={() => router.push('/(root)/account')} />
                        <SettingsRow icon="finger-print" color="#8A8A94" label="Privacy & security" keywords="face id lock" onPress={() => router.push('/(root)/privacy')} />
                        {/* Everything is free; Pro is desktop sync (lib/access.ts). */}
                        <SettingsRow icon="sync" color="#FFB020" label="Habyss Pro"
                            value={pro.kind === 'pro' ? 'On' : undefined}
                            onPress={() => router.push('/(root)/paywall')} />
                    </SettingsGroup>

                    <SettingsGroup title="Help">
                        {/* The walkthrough itself, on the real screen (Home), not a page about it. */}
                        <SettingsRow icon="book" color="#FFB020" label="How Habyss works" onPress={() => {
                            router.navigate('/(root)/(tabs)/home');
                            setTimeout(() => emit('start_walkthrough'), 450);
                        }} />
                        <SettingsRow icon="help-buoy" color="#64D2FF" label="Help & feedback" onPress={() => router.push('/(root)/help')} />
                        {/* Testing tools: development and preview builds only, never the App Store build. */}
                        {showDeveloper ? (
                            <SettingsRow icon="construct" color="#8A8A94" label="Developer" onPress={() => router.push('/(root)/developer' as never)} />
                        ) : null}
                    </SettingsGroup>

                    {/* Deeper than this page: found by name, opened where they live. */}
                    {deep.length ? (
                        <SettingsGroup title="On other pages">
                            {deep.map(entry => (
                                <SettingsRow key={`${entry.page}-${entry.label}`} icon={entry.icon} color="#8A8A94" label={entry.label} value={entry.page}
                                    keywords={entry.keywords} onPress={() => router.push(entry.route as never)} />
                            ))}
                        </SettingsGroup>
                    ) : null}
                    </SettingsSearch>

                    {query.trim() ? null : (
                        <View style={styles.footer}>
                            <Text style={[styles.quote, { color: colors.textSecondary }]}>{APP_SLOGAN}</Text>
                            <Text style={[styles.version, { color: colors.textTertiary }]}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
                        </View>
                    )}

                </ScrollView>
            </SafeAreaView>
        </VoidShell>
    );
}
