import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';
import { Spacing } from '@/theme/designSystem';
import { SettingsGroup, SettingsRow, SettingsSearch } from '@/components/ui/SettingsList';
import { AppTextField } from '@/components/ui/AppTextField';
import { searchDeep } from '@/lib/settingsSearch';
import { VoidShell } from '@/components/ui/VoidShell';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { router } from 'expo-router';
import { on } from '@/lib/appEvents';
import { useMyProfile } from '@/hooks/useMyProfile';

import { useAppSettings } from '@/context/AppSettingsContext';
import { cachedDayWindow, DEFAULT_DAY, getDayWindow, minutesOf } from '@/lib/echo';
import { clockLabel } from '@/lib/dayFlow';
import { PERSONALITY_MODES } from '@/constants/AIPersonalities';
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

import { useTimeOff } from '@/hooks/useTimeOff';
export default function ProfileScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { horizontalPadding, topSpacing, isCompactWidth } = useResponsiveLayout();

    // User state
    const { selectionFeedback } = useHaptics();
    // You, from the one profile store (lib/profile.ts).
    const me = useMyProfile();
    const [day, setDay] = useState(() => cachedDayWindow() ?? DEFAULT_DAY);
    useEffect(() => { void getDayWindow().then(setDay).catch(() => undefined); }, []);
    const dayHours = `${clockLabel(minutesOf(day.wake))} – ${clockLabel(minutesOf(day.sleep))}`;
    // The + on this tab is a search lens: it opens the field, and the rows filter as you type.
    const timeOff = useTimeOff();
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
                {/* A page now, opened from the profile's corner: back on the left, search on the right. */}
                <View style={[styles.header, { paddingHorizontal: horizontalPadding, paddingTop: topSpacing * 0.4 }]}>
                    <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
                    <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: isCompactWidth ? 26 : 30 }]}>Settings</Text>
                    <IconButton icon="search" label="Search settings" onPress={() => { selectionFeedback(); setSearching(true); scroll.current?.scrollTo({ y: 0, animated: true }); }} />
                </View>

                {searching ? (
                    <View style={[styles.search, { paddingHorizontal: horizontalPadding }]}>
                        <AppTextField value={query} onChangeText={setQuery} accessibilityLabel="Search settings" placeholder="Search settings" autoFocus returnKeyType="search"
                            autoCorrect={false} leadingIcon="search" trailingIcon="close-circle" trailingAccessibilityLabel="Close search" onTrailingPress={stopSearching} />
                    </View>
                ) : null}

                <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: Spacing.bottom * 2, paddingHorizontal: horizontalPadding }]} showsVerticalScrollIndicator={false}>
                    <SettingsSearch value={query}>
                    {/* Your account first: who you are (name, @, what you do, age, picture) is edited
                        there, so the profile only shows it and nothing changes by a stray tap. */}
                    <SettingsGroup title="Account">
                        <SettingsRow icon="person-circle" color="#0A84FF" label="Account" keywords="name username display name occupation job age birthday picture photo delete account"
                            value={username || undefined} onPress={() => router.push('/(root)/account-settings' as never)} />
                        <SettingsRow icon="finger-print" color="#8A8A94" label="Privacy & security" keywords="sign in sign out backup face id lock export"
                            value={accountEmail ? undefined : 'Sign in'} onPress={() => router.push('/(root)/privacy')} />
                    </SettingsGroup>

                    {/* One topic per group, each setting in exactly one place, named by the question
                        people come with: when is my day, what gets blocked, when does my phone buzz.
                        Only pages here; what they hold is one tap away, and found by search. */}
                    <SettingsGroup title="Your day">
                        {/* Wake and bed times, planning, calendar and meals: what the timeline is built around. */}
                        <SettingsRow icon="time" color="#FF9F0A" label="Day & calendar" keywords="wake bedtime sleep meals tasks a day week starts auto-reschedule calendar"
                            value={dayHours} onPress={() => router.push('/(root)/meals' as never)} />
                        <SettingsRow icon="checkmark-done" color="#FF453A" label="Tasks" keywords="tasks a day three five friends see"
                            onPress={() => router.push('/(root)/task-settings' as never)} />
                        <SettingsRow icon="repeat" color="#FF9F0A" label="Habits" keywords="habit names friends see shared"
                            onPress={() => router.push('/(root)/habit-settings' as never)} />
                        <SettingsRow icon="airplane" color="#64D2FF" label="Time off" keywords="sick ill vacation holiday away travel pause rest break streak safe"
                            value={timeOff ? (timeOff.kind === 'sick' ? 'Sick' : 'Vacation') : undefined} onPress={() => router.push('/(root)/time-off' as never)} />
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

                    <SettingsGroup title="Help">
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
