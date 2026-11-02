import { FontFamily } from '@/theme/designSystem';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { VoidShell } from '@/components/ui/VoidShell';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { router } from 'expo-router';
import { emit } from '@/lib/appEvents';
import { useMyProfile } from '@/hooks/useMyProfile';
import { useSleep } from '@/hooks/useSleep';
import { setSleepCardVisible, setSleepTarget } from '@/lib/sleepLog';
import { CLOCK_STYLES, setClockStyle, type ClockStyle } from '@/lib/focusClock';
import { useClockStyle } from '@/hooks/useClockStyle';
import { setFocusBlocking, useFocusBlocking } from '@/lib/focusBlocking';
import { ScreenTimeService } from '@/lib/ScreenTimeService';
import { DEFAULT_WEEK_START, getWeekStart, setWeekStart, type WeekStart } from '@/lib/weekStart';
import { syncBrainDumpReview } from '@/lib/brainDumpReview';
import { DEFAULT_VOICE_DESTINATION, VOICE_DESTINATIONS, getVoiceDestination, setVoiceDestination, type VoiceDestination } from '@/lib/voiceDestination';

/** Sleep goals offered, in hours. */
const SLEEP_GOALS = [6, 7, 8, 9];
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { saveDailyTarget } from '@/lib/dailyFocus';

import { useAppSettings } from '@/context/AppSettingsContext';
import { PERSONALITY_MODES } from '@/constants/AIPersonalities';
import { PAYWALL_ENABLED } from '@/constants/features';
import { useAccess } from '@/hooks/useAccess';
import { hasAnyIntegration } from '@/lib/integrationAvailability';
import { APP_SLOGAN } from '@/constants/brand';
import { currentAccount, onAccountChange } from '@/lib/account';
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
    const { access } = useAccess();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { horizontalPadding, topSpacing, tabBarClearance, isCompactWidth } = useResponsiveLayout();

    // User state
    const { selectionFeedback, lightFeedback } = useHaptics();
    const dailyTarget = useDailyTarget();
    // You, from the one profile store (lib/profile.ts).
    const me = useMyProfile();
    const sleep = useSleep();
    const clockStyle = useClockStyle();
    const blocking = useFocusBlocking();
    const [voiceDestination, setVoiceDestinationState] = useState<VoiceDestination>(DEFAULT_VOICE_DESTINATION);
    const [weekStart, setWeekStartState] = useState<WeekStart>(DEFAULT_WEEK_START);
    useEffect(() => { void getWeekStart().then(setWeekStartState); }, []);
    useEffect(() => { void getVoiceDestination().then(setVoiceDestinationState); }, []);
    const username = me.name;
    const avatarUri = me.avatar;

    // Settings state - use global context
    const {
        notificationsEnabled,
        aiPersonality,
        autoReschedule,
        setAutoReschedule,
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

                    {/* One topic per group, in the order people reach for them:
                        their day, focusing, Echo, their things, the app, the
                        account, help. Plain names; nothing that is not a setting
                        or a place only Settings leads to. */}
                    <SettingsGroup title="Your day">
                        {/* Wake and bed times, meals and calendars: what the timeline is built around. */}
                        <SettingsRow icon="time" color="#FF9F0A" label="Day, meals & calendar" onPress={() => router.push('/(root)/meals' as never)} />
                        <SettingsRow icon="checkmark-done" color="#FF9F0A" label="Tasks a day"
                            choices={[{ id: '3', label: '3' }, { id: '5', label: '5' }]}
                            chosen={String(dailyTarget)} onChoose={id => void saveDailyTarget(Number(id) as 3 | 5)} />
                        {/* When a week ends: calendars start on it and the brain dump is reviewed then. */}
                        <SettingsRow icon="calendar" color="#64D2FF" label="Week starts"
                            choices={[{ id: 'monday', label: 'Mon' }, { id: 'sunday', label: 'Sun' }]} chosen={weekStart}
                            onChoose={id => {
                                setWeekStartState(id as WeekStart);
                                void setWeekStart(id as WeekStart).then(() => syncBrainDumpReview());
                            }} />
                        {/* Whether the timeline moves things for you. Off, everything stays at its
                            time, and Exact, Urgency and Difficulty leave the task and habit forms. */}
                        <SettingsRow icon="shuffle" color="#30D158" label="Auto-reschedule"
                            toggle={autoReschedule} onToggle={value => { lightFeedback(); setAutoReschedule(value); }} />
                        {/* Sleep: one switch for Home's sleep card; while it is on, the goal a
                            night has to reach to earn Marks sits right under it. */}
                        <SettingsRow icon="moon" color="#5E5CE6" label="Sleep"
                            toggle={sleep.showCard !== false} onToggle={value => void setSleepCardVisible(value)} />
                        {sleep.showCard !== false ? (
                            <SettingsRow icon="bed" color="#5E5CE6" label="Sleep goal"
                                choices={SLEEP_GOALS.map(hours => ({ id: String(hours), label: `${hours}h` }))}
                                chosen={String(sleep.target / 60)} onChoose={id => void setSleepTarget(Number(id) * 60)} />
                        ) : null}
                    </SettingsGroup>

                    <SettingsGroup title="Focus">
                        {/* Focus blocks the apps chosen here (Screen Time) until it ends or is paused. */}
                        <SettingsRow icon="hand-left" color="#FF375F" label="Block apps while focusing"
                            toggle={blocking} onToggle={value => { lightFeedback(); void setFocusBlocking(value); }} />
                        {blocking ? (
                            <SettingsRow icon="apps" color="#FF375F" label="Apps to block"
                                onPress={() => {
                                    lightFeedback();
                                    void ScreenTimeService.chooseApps().then(ok => {
                                        if (!ok) Alert.alert('Screen Time not available', 'Allow Habyss in Settings → Screen Time, or update to the newest version of Habyss, then try again.');
                                    });
                                }} />
                        ) : null}
                        <SettingsRow icon="timer" color="#FF375F" label="Clock style"
                            choices={CLOCK_STYLES} chosen={clockStyle} onChoose={id => void setClockStyle(id as ClockStyle)} />
                    </SettingsGroup>

                    <SettingsGroup title="Echo & reminders">
                        <SettingsRow icon="sparkles" color="#5E5CE6" label="Echo"
                            value={PERSONALITY_MODES.find(mode => mode.id === aiPersonality)?.name ?? 'Friendly'}
                            onPress={() => router.push('/(root)/ai-settings')} />
                        <SettingsRow icon="notifications" color="#FF453A" label="Notifications"
                            value={notificationsEnabled ? 'On' : 'Off'} onPress={() => router.push('/(root)/notifications')} />
                    </SettingsGroup>

                    <SettingsGroup title="Your habits & goals">
                        <SettingsRow icon="repeat" color="#BF5AF2" label="All habits" onPress={() => router.push('/(root)/all-habits')} />
                        <SettingsRow icon="flag" color="#FF453A" label="Goal plans" onPress={() => router.push('/(root)/goal-roadmap')} />
                        <SettingsRow icon="bulb" color="#FFD60A" label="Brain dump" onPress={() => router.push('/brain-dump' as never)} />
                    </SettingsGroup>

                    <SettingsGroup title="App">
                        <SettingsRow icon="color-palette" color="#0A84FF" label="Appearance" onPress={() => router.push('/(root)/appearance')} />
                        {/* Hold + and speak: where the words go. */}
                        <SettingsRow icon="mic" color="#0A84FF" label="Hold + to say"
                            choices={VOICE_DESTINATIONS} chosen={voiceDestination}
                            onChoose={id => { setVoiceDestinationState(id as VoiceDestination); void setVoiceDestination(id as VoiceDestination); }} />
                        {hasAnyIntegration() ? (
                            <SettingsRow icon="extension-puzzle" color="#0A84FF" label="Connected apps" onPress={() => router.push('/(root)/integrations')} />
                        ) : null}
                    </SettingsGroup>

                    <SettingsGroup title="Account">
                        <SettingsRow icon="person-circle" color="#5B8CFF" label="Account & backup"
                            value={accountEmail ? 'Signed in' : 'Sign in'} onPress={() => router.push('/(root)/account')} />
                        <SettingsRow icon="people" color="#30D158" label="Friends & sharing" onPress={() => router.push('/(root)/sharing')} />
                        <SettingsRow icon="lock-closed" color="#8A8A94" label="Privacy" onPress={() => router.push('/(root)/privacy')} />
                        {PAYWALL_ENABLED ? (
                            <SettingsRow icon="star" color="#FFB020" label="Habyss"
                                value={access.kind === 'owned' ? 'Yours for good' : access.kind === 'trial' ? `Free · ${access.daysLeft} ${access.daysLeft === 1 ? 'day' : 'days'} left` : undefined}
                                onPress={() => router.push('/(root)/paywall')} />
                        ) : null}
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

                    <View style={styles.footer}>
                        <Text style={[styles.quote, { color: colors.textSecondary }]}>{APP_SLOGAN}</Text>
                        <Text style={[styles.version, { color: colors.textTertiary }]}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </VoidShell>
    );
}
