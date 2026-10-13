import { FontFamily, Typography, UIStyles } from '@/theme/designSystem';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { VoidShell } from '@/components/ui/VoidShell';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { router } from 'expo-router';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { saveDailyTarget } from '@/lib/dailyFocus';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '@/context/AppSettingsContext';
import { PERSONALITY_MODES } from '@/constants/AIPersonalities';
import { PAYWALL_ENABLED } from '@/constants/features';
import { hasAnyIntegration, integrationsSummary } from '@/lib/integrationAvailability';
import { APP_SLOGAN } from '@/constants/brand';
import { currentAccount, onAccountChange } from '@/lib/account';
import Constants from 'expo-constants';
import { emit } from '@/lib/appEvents';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccentGradient } from '@/context/AccentContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { styles } from '@/styles/screens/tabs/settings.styles';

// Settings configuration


/**
 * A titled group of rows.
 *
 * Declared here rather than inside the screen: a component created during
 * render is a new component type on every render, so React threw away every
 * row and built it again each time anything on the page changed.
 */
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const rows = React.Children.toArray(children).filter(Boolean);
    return (
        <View style={styles.group}>
            <Text style={[styles.sectionHeading, { color: colors.textTertiary }]}>{title.toUpperCase()}</Text>
            <View style={[styles.sectionCardPlain, { backgroundColor: isLight ? colors.surfaceSecondary : 'rgba(255,255,255,0.04)', borderColor: colors.border }]}>
                {rows.map((row, index) => (
                    <View key={index}>
                        {index > 0 ? <View style={[styles.rowDivider, { backgroundColor: colors.border }]} /> : null}
                        {row}
                    </View>
                ))}
            </View>
        </View>
    );
};

/**
 * One setting. A small monochrome icon, the name, and either what it is set to
 * or a switch. No gradient tiles: this is a list, and every row shouting the
 * accent colour made none of them readable.
 */
const Row = ({ icon, label, value, toggle, onPress }: {
    icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value?: string;
    toggle?: boolean; onPress: () => void;
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accentColor } = useAccentGradient();
    const { selectionFeedback } = useHaptics();

    return (
    <TouchableOpacity
        accessibilityRole={toggle === undefined ? 'button' : 'switch'}
        accessibilityState={toggle === undefined ? undefined : { checked: toggle }}
        accessibilityLabel={label}
        activeOpacity={0.7}
        onPress={() => { selectionFeedback(); onPress(); }}
        style={styles.row}
    >
        <View style={[styles.rowIcon, { backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)' }]}>
            <Ionicons name={icon} size={16} color={colors.textSecondary} />
        </View>
        <Text numberOfLines={1} style={[styles.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
        {toggle === undefined ? (
            <>
                {value ? <Text numberOfLines={1} style={[styles.rowValue, { color: colors.textTertiary }]}>{value}</Text> : null}
                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </>
        ) : (
            <View style={[styles.switch, { backgroundColor: toggle ? accentColor : (isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)') }]}>
                <View style={[styles.knob, { alignSelf: toggle ? 'flex-end' : 'flex-start' }]} />
            </View>
        )}
    </TouchableOpacity>
    );
};

/**
 * Two switches in the room of one.
 *
 * Sound and haptics are the same decision — how loudly the app answers you —
 * so they read better as one row with two channels than as two rows repeating
 * the same shape. Each is still a separate switch; it just stops spending a
 * full row each to say so.
 */
const FeedbackRow = ({ sounds, haptics, onSounds, onHaptics }: {
    sounds: boolean; haptics: boolean; onSounds: () => void; onHaptics: () => void;
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accentColor } = useAccentGradient();
    const { selectionFeedback } = useHaptics();

    const channels = [
        { on: sounds, icon: 'volume-medium' as const, off: 'volume-mute-outline' as const, label: 'Sounds', press: onSounds },
        { on: haptics, icon: 'phone-portrait' as const, off: 'phone-portrait-outline' as const, label: 'Haptics', press: onHaptics },
    ];

    return (
        <View style={styles.row}>
            <View style={[styles.rowIcon, { backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)' }]}>
                <Ionicons name="pulse-outline" size={16} color={colors.textSecondary} />
            </View>
            <Text numberOfLines={1} style={[styles.rowLabel, { color: colors.textPrimary }]}>Sound &amp; haptics</Text>
            <View style={styles.channels}>
                {channels.map(channel => (
                    <TouchableOpacity
                        key={channel.label}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: channel.on }}
                        accessibilityLabel={channel.label}
                        activeOpacity={0.7}
                        onPress={() => { selectionFeedback(); channel.press(); }}
                        style={[styles.channel, {
                            backgroundColor: channel.on ? accentColor + '24' : (isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)'),
                            borderColor: channel.on ? accentColor + '66' : 'transparent',
                        }]}
                    >
                        <Ionicons
                            name={channel.on ? channel.icon : channel.off}
                            size={15}
                            color={channel.on ? accentColor : colors.textTertiary}
                        />
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

export default function ProfileScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { horizontalPadding, topSpacing, tabBarClearance, isCompactWidth } = useResponsiveLayout();

    // User state
    const { selectionFeedback } = useHaptics();
    const dailyTarget = useDailyTarget();
    const [username, setUsername] = useState('');

    // Settings state - use global context
    const {
        hapticsEnabled, setHapticsEnabled,
        soundsEnabled, setSoundsEnabled,
        notificationsEnabled,
        aiPersonality,
    } = useAppSettings();

    // Profile picture state
    const [avatarUri, setAvatarUri] = useState<string | null>(null);

    // Load user profile from local storage
    useEffect(() => {
        const loadProfile = async () => {
            const savedNickname = await AsyncStorage.getItem('profile_nickname');
            if (savedNickname) setUsername(savedNickname);
            else setUsername('User');

            // Load saved avatar
            const savedAvatar = await AsyncStorage.getItem('profile_avatar');
            if (savedAvatar) setAvatarUri(savedAvatar);
        };
        loadProfile();
    }, []);


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
                    <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: isCompactWidth ? 26 : 30 }]}>SETTINGS</Text>
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

                    <Section title="Account">
                        <Row
                            icon="cloud-upload-outline"
                            label="Account & backup"
                            value={accountEmail ? 'Signed in' : 'Sign in'}
                            onPress={() => router.push('/(root)/account')}
                        />
                        <Row icon="people-outline" label="Sharing & friends" value="What friends see" onPress={() => router.push('/(root)/sharing')} />
                        <Row icon="shield-checkmark-outline" label="Privacy & security" onPress={() => router.push('/(root)/privacy')} />
                        <Row icon="hand-left-outline" label="Blocked accounts" onPress={() => router.push('/(root)/blocked')} />
                        {PAYWALL_ENABLED ? (
                            <Row icon="star-outline" label="Subscription" value="Manage" onPress={() => router.push('/(root)/paywall')} />
                        ) : null}
                    </Section>

                    <Section title="Your plan">
                        {/* The promise is two numbers, so the row is the choice
                            rather than a page that holds one. */}
                        <Row
                            icon="checkmark-circle-outline"
                            label="Daily tasks"
                            value={`${dailyTarget} a day`}
                            onPress={() => void saveDailyTarget(dailyTarget === 3 ? 5 : 3)}
                        />
                        <Row icon="git-branch-outline" label="Full roadmap" onPress={() => router.push('/(root)/goal-roadmap')} />
                        <Row icon="list-outline" label="All habits" value="Including archived" onPress={() => router.push('/(root)/all-habits')} />
                    </Section>

                    <Section title="Echo & reminders">
                        <Row
                            icon="sparkles-outline"
                            label="Echo"
                            value={PERSONALITY_MODES.find(mode => mode.id === aiPersonality)?.name ?? 'Friendly'}
                            onPress={() => router.push('/(root)/ai-settings')}
                        />
                        <Row
                            icon="notifications-outline"
                            label="Notifications"
                            value={notificationsEnabled ? 'On' : 'Off'}
                            onPress={() => router.push('/(root)/notifications')}
                        />
                    </Section>

                    <Section title="Appearance & feedback">
                        <Row icon="color-palette-outline" label="Appearance" onPress={() => router.push('/(root)/appearance')} />
                        <FeedbackRow
                            sounds={soundsEnabled}
                            haptics={hapticsEnabled}
                            onSounds={() => setSoundsEnabled(!soundsEnabled)}
                            onHaptics={() => setHapticsEnabled(!hapticsEnabled)}
                        />
                    </Section>

                    {hasAnyIntegration() ? (
                        <Section title="Connections">
                            <Row
                                icon="link-outline"
                                label="Integrations"
                                value={integrationsSummary()}
                                onPress={() => router.push('/(root)/integrations')}
                            />
                        </Section>
                    ) : null}

                    <Section title="Support">
                        {/* First, because it is the one people actually need,
                            and it opens a box rather than another screen. */}
                        <Row
                            icon="paper-plane-outline"
                            label="Send feedback"
                            value="Or hold the Settings tab"
                            onPress={() => emit('show_feedback', { screen: 'settings' })}
                        />
                        <Row icon="help-circle-outline" label="Help centre" onPress={() => router.push('/(root)/help')} />
                        <Row icon="chatbubble-ellipses-outline" label="Contact support" onPress={() => router.push('/(root)/contact')} />
                        <Row icon="information-circle-outline" label="About Habyss" onPress={() => router.push('/(root)/about')} />
                    </Section>

                    <View style={styles.footer}>
                        <Text style={[styles.quote, { color: colors.textSecondary }]}>{APP_SLOGAN}</Text>
                        <Text style={[styles.version, { color: colors.textTertiary }]}>v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
                    </View>

                </ScrollView>
            </SafeAreaView>
        </VoidShell>
    );
}
