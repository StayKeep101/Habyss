import { FontFamily } from '@/constants/DesignSystem';
import React, { useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { ProfileView } from '@/components/Profile/ProfileView';
import { Friend, FriendProfile, FriendsService } from '@/lib/friendsService';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { LinearGradient } from 'expo-linear-gradient';

import { useAccentGradient } from '@/constants/AccentContext';

interface FriendStatsModalProps {
    visible: boolean;
    friend: Friend | null;
    onClose: () => void;
    onNudge: (friend: Friend) => void;
    /** Called after a block, so the feed can stop showing them at once. */
    onBlocked?: (friend: Friend) => void;
}

export const FriendStatsModal: React.FC<FriendStatsModalProps> = ({
    visible,
    friend,
    onClose,
    onNudge,
    onBlocked,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accentColor } = useAccentGradient();


    // Animations


    /** The parts of their profile the day numbers do not carry. */
    const [profile, setProfile] = React.useState<FriendProfile>({});
    useEffect(() => {
        if (!visible || !friend) return;
        let alive = true;
        FriendsService.profileOf(friend.userId || friend.id)
            .then(found => { if (alive) setProfile(found); })
            .catch(() => undefined);
        return () => { alive = false; };
    }, [visible, friend]);

    if (!friend) return null;

    /**
     * Blocking and reporting, as two native prompts rather than a screen.
     *
     * A report asks for a reason from a fixed list instead of free text: it is
     * one tap instead of typing, and a chosen reason is more use to whoever
     * reads it than a sentence.
     */
    const report = (person: Friend) => {
        const file = async (reason: string) => {
            const ok = await FriendsService.reportContent({ userId: person.userId || person.id, kind: 'profile', reason });
            Alert.alert(
                ok ? 'Reported' : 'Could not send that',
                ok ? 'Thank you. Somebody will read it.' : 'Please try again.',
            );
        };
        Alert.alert(`Report ${person.displayName ?? person.username}`, 'What is wrong?', [
            { text: 'Spam', onPress: () => void file('spam') },
            { text: 'Harassment', onPress: () => void file('harassment') },
            { text: 'Something else', onPress: () => void file('other') },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const block = (person: Friend) => {
        Alert.alert(
            `Block ${person.displayName ?? person.username}?`,
            'They will not see your day, and cannot react or write to you. It also removes them as a friend.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Block', style: 'destructive', onPress: async () => {
                        const ok = await FriendsService.blockUser(person.userId || person.id);
                        if (!ok) { Alert.alert('Could not block them', 'Please try again.'); return; }
                        onBlocked?.(person);
                        onClose();
                    },
                },
            ],
        );
    };


    return (
        <VoidModal visible={visible} onClose={onClose}>
            <View style={{ flex: 1 }}>
                {/* Background Atmosphere */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <LinearGradient
                        colors={[accentColor, 'transparent']}
                        style={{ width: '100%', height: 300, opacity: 0.1 }}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                    />
                </View>

                <ModalHeader
                    title={friend.displayName ?? friend.username}
                    onBack={onClose}
                    backIcon="close"
                    rightSlot={friend.username !== 'You' ? (
                        <TouchableOpacity
                            style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.05)' }]}
                            accessibilityLabel="Manage friendship"
                            // One menu, not a menu and a button and a link:
                            // nudging, removing, blocking and reporting are all
                            // things you do *to* a person, so they belong in the
                            // same place rather than scattered down the page.
                            onPress={() => {
                                Alert.alert(friend.displayName ?? friend.username, undefined, [
                                    { text: 'Nudge', onPress: () => { onNudge(friend); onClose(); } },
                                    { text: 'Block', style: 'destructive', onPress: () => block(friend) },
                                    { text: 'Report', onPress: () => report(friend) },
                                    {
                                        text: 'Remove friend',
                                        style: 'destructive',
                                        onPress: async () => {
                                            const success = await FriendsService.removeFriend(friend.id);
                                            if (success) onClose();
                                        },
                                    },
                                    { text: 'Cancel', style: 'cancel' },
                                ]);
                            }}
                        >
                            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                    ) : undefined}
                />

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* The page you see for yourself, for them.
                        What you see of yourself should be what they see of you,
                        or one of the two pages is lying. The numbers are the
                        ones a friend's data actually supports: everything else
                        on your own page is worked out from habits only you can
                        read. */}
                    <ProfileView
                        name={friend.displayName ?? friend.username}
                        bio={profile.bio ?? ''}
                        meta={[`@${friend.username}`, `${friend.todayTotal ?? 0} habit${(friend.todayTotal ?? 0) === 1 ? '' : 's'} today`].join(' · ')}
                        avatar={profile.avatarUrl ?? friend.avatarUrl}
                        initials={(friend.displayName ?? friend.username)[0]?.toUpperCase() ?? ''}
                        stats={[
                            { label: 'Day streak', value: `${friend.currentStreak ?? friend.streak ?? 0}` },
                            { label: 'Done today', value: `${friend.todayCompleted ?? 0}` },
                            { label: 'Habits', value: `${friend.todayTotal ?? 0}` },
                        ]}
                    />

                </ScrollView>
            </View>
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    safety: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, marginTop: 4 },
    safetyText: { fontSize: 12, fontFamily: FontFamily.medium },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingBottom: 40,
    },
    profileHeader: {
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 30,
    },
    glowRing: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 2,
        top: -10,
    },
    avatarContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 2,
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 48,
        fontFamily: FontFamily.bold,
    },
    handle: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 1 },
    username: {
        fontSize: 28,
        fontFamily: FontFamily.bold,
        marginTop: 16,
        letterSpacing: -1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 8,
        gap: 6,
    },
    statusText: {
        fontSize: 12,
        fontFamily: FontFamily.semibold,
    },
    hudContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 20,
        marginBottom: 30,
    },
    hudItem: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressCenter: {
        position: 'absolute',
        alignItems: 'center',
    },
    hudValue: {
        fontSize: 24,
        fontFamily: FontFamily.bold,
    },
    hudLabel: {
        fontSize: 9,
        fontFamily: FontFamily.bold,
        letterSpacing: 1,
    },
    hudStats: {
        flex: 1,
        gap: 12,
    },
    statBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 12,
        borderRadius: 16,
    },
    boxValue: {
        fontSize: 18,
        fontFamily: FontFamily.bold,
    },
    boxLabel: {
        fontSize: 9,
        fontFamily: FontFamily.semibold,
        letterSpacing: 0.5,
    },
    activitySection: {
        paddingHorizontal: 24,
        marginBottom: 40,
    },
    heatmapStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        height: 60,
        alignItems: 'flex-end',
    },
    heatmapColumn: {
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    heatmapBlock: {
        width: '80%',
        height: 40,
        borderRadius: 6,
    },
    heatmapLabel: {
        fontSize: 10,
        fontFamily: FontFamily.semibold,
    },
    actionContainer: {
        paddingHorizontal: 40,
        alignItems: 'center',
    },
    nudgeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        gap: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    nudgeText: {
        color: '#FFF',
        fontSize: 16,
        letterSpacing: 1,
        fontFamily: FontFamily.bold,
    }
});
