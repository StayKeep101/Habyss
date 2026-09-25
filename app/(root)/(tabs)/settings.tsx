import { FontFamily, Typography, UIStyles } from '@/constants/DesignSystem';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { VoidShell } from '@/components/Layout/VoidShell';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { router } from 'expo-router';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import { saveDailyTarget } from '@/lib/dailyFocus';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppSettings } from '@/constants/AppSettingsContext';
import { PERSONALITY_MODES } from '@/constants/AIPersonalities';
import { PAYWALL_ENABLED } from '@/constants/features';
import { hasAnyIntegration, integrationsSummary } from '@/lib/integrationAvailability';
import { APP_SLOGAN } from '@/constants/brand';
import { currentAccount, onAccountChange } from '@/lib/account';
import Constants from 'expo-constants';
import { EditProfileModal } from '@/components/Profile/EditProfileModal';
import { useHaptics } from '@/hooks/useHaptics';
import { useAccentGradient } from '@/constants/AccentContext';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

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

export default function ProfileScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accentColor } = useAccentGradient();
    const { horizontalPadding, topSpacing, tabBarClearance, isCompactWidth } = useResponsiveLayout();

    // User state
    const { selectionFeedback } = useHaptics();
    const dailyTarget = useDailyTarget();
    const [username, setUsername] = useState('');
    const [showEditProfile, setShowEditProfile] = useState(false);

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
                        onPress={() => { selectionFeedback(); setShowEditProfile(true); }}
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
                        <Row icon="shield-checkmark-outline" label="Privacy & security" onPress={() => router.push('/(root)/privacy')} />
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
                        <Row icon="color-palette-outline" label="Theme & accent" onPress={() => router.push('/(root)/appearance')} />
                        <Row
                            icon="volume-medium-outline"
                            label="Sounds"
                            toggle={soundsEnabled}
                            onPress={() => { setSoundsEnabled(!soundsEnabled); selectionFeedback(); }}
                        />
                        <Row
                            icon="phone-portrait-outline"
                            label="Haptics"
                            toggle={hapticsEnabled}
                            onPress={() => { setHapticsEnabled(!hapticsEnabled); selectionFeedback(); }}
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
            <EditProfileModal
                visible={showEditProfile}
                onClose={() => setShowEditProfile(false)}
                currentUsername={username}
                currentAvatarUri={avatarUri}
                onProfileUpdate={(newAvatarUri) => {
                    // Reload username from local storage
                    AsyncStorage.getItem('profile_nickname').then(name => {
                        if (name) setUsername(name);
                    });
                    if (newAvatarUri) setAvatarUri(newAvatarUri);
                }}
            />
        </VoidShell>
    );
}

const styles = StyleSheet.create({
    profileRow: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 14, marginTop: 4, marginBottom: 8,
    },
    avatar: {
        width: 56, height: 56, borderRadius: 28, borderWidth: 1,
        alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    profileName: { fontSize: 17, fontFamily: FontFamily.semibold },
    profileMeta: { fontSize: 13, fontFamily: FontFamily.regular, marginTop: 2 },
    group: { marginTop: 22 },
    sectionHeading: { fontSize: 11, letterSpacing: 1.2, fontFamily: FontFamily.medium, marginBottom: 8, marginLeft: 4 },
    sectionCardPlain: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
    rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
    rowIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    rowLabel: { flex: 1, fontSize: 15, fontFamily: FontFamily.regular },
    rowValue: { fontSize: 13, fontFamily: FontFamily.regular, maxWidth: 150 },
    switch: { width: 44, height: 26, borderRadius: 13, padding: 3, justifyContent: 'center' },
    knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
    },
    headerTitle: Typography.screenTitle,
    settingsButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    scrollContent: {
        paddingBottom: 120,
        paddingHorizontal: 20,
    },
    profileSection: {
        alignItems: 'center',
        marginBottom: 32,
        marginTop: 20,
    },
    avatarContainer: {
        marginBottom: 12,
    },
    avatarPlaceholder: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    verifiedBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#050505',
    },
    name: {
        fontSize: 20,
        fontFamily: FontFamily.bold,
        marginBottom: 2,
    },
    email: {
        fontSize: 12,
        fontFamily: FontFamily.regular,
        marginBottom: 12,
    },
    usernameEditContainer: {
        width: '100%',
        paddingHorizontal: 20,
        marginBottom: 8,
    },
    usernameInput: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8,
    },
    usernameInputText: {
        flex: 1,
        fontSize: 16,
        fontFamily: FontFamily.regular,
    },
    usernameButtons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginTop: 12,
    },
    cancelBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
    },
    saveBtn: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 16,
        minWidth: 80,
        alignItems: 'center',
    },
    tag: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
        borderWidth: 1,
    },
    tagText: {
        fontSize: 9,
        letterSpacing: 1,
        fontFamily: FontFamily.bold,
    },
    groupCard: {
        padding: 12,
        marginBottom: 12,
    },
    groupTitle: {
        fontSize: 9,
        letterSpacing: 1,
        marginBottom: 12,
        fontFamily: FontFamily.semibold,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    settingLabel: {
        fontSize: 14,
        fontFamily: FontFamily.medium,
    },
    divider: {
        height: 1,
        marginVertical: 6,
    },
    footer: {
        alignItems: 'center',
        marginTop: 24,
        paddingBottom: 20,
    },
    quote: {
        fontSize: 11,
        fontStyle: 'italic',
        fontFamily: FontFamily.regular,
    },
    version: {
        fontSize: 9,
        marginTop: 6,
        fontFamily: FontFamily.regular,
    },
    premiumAvatarBorder: {
        position: 'absolute',
        width: 88,
        height: 88,
        borderRadius: 44,
        top: -4,
        left: -4,
    },
    proBadge: {
        position: 'absolute',
        bottom: -2,
        left: '50%',
        marginLeft: -16,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    proBadgeText: {
        fontSize: 9,
        color: '#fff',
        fontFamily: FontFamily.bold,
    },
    upgradeBtnContainer: {
        marginTop: 12,
        shadowColor: '#8B5CF6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    upgradeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        gap: 8,
    },
    upgradeText: {
        fontSize: 13,
        color: '#fff',
        fontFamily: FontFamily.bold,
    },
    // Inline settings styles
    settingsSection: {
        marginTop: 20,
    },
    sectionTitle: UIStyles.sectionTitle,
    sectionCard: {
        padding: 4,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        gap: 12,
    },
    settingIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingContent: {
        flex: 1,
    },
    settingTitle: {
        fontSize: 15,
        fontFamily: FontFamily.semibold,
    },
    settingSubtitle: {
        fontSize: 12,
        fontFamily: FontFamily.regular,
        marginTop: 2,
    },
    settingDivider: {
        height: 1,
        marginHorizontal: 14,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 16,
        gap: 8,
    },
    signOutText: {
        fontSize: 15,
        fontFamily: FontFamily.semibold,
    },
});
