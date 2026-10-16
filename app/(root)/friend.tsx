import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VoidShell } from '@/components/ui/VoidShell';
import { IconButton } from '@/components/ui/IconButton';
import { AppButton } from '@/components/ui/AppButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { MorphMenu, type MorphMenuItem } from '@/components/ui/MorphMenu';
import { ProfileView, type ProfileNumbers } from '@/components/Profile/ProfileView';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { FriendsService, type Friend, type FriendProfile } from '@/lib/friendsService';
import { FeedService, type FriendStatusRow } from '@/lib/feedService';
import { STATUS_LABEL, statusOf } from '@/lib/presence';
import { listenToFriends } from '@/lib/livePulse';
import { styles } from '@/styles/screens/friend.styles';

/**
 * A friend's profile: the same page as your own (components/Profile/
 * ProfileView), read-only, showing only what they share. On top of it, what
 * is only true of someone else — what they are doing right now, a nudge, and
 * the menu to remove, block or report them.
 */
export default function FriendScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { mediumFeedback } = useHaptics();

    const [friend, setFriend] = useState<Friend | null>(null);
    const [status, setStatus] = useState<FriendStatusRow | null>(null);
    const [profile, setProfile] = useState<FriendProfile>({});
    const [marks, setMarks] = useState<number | undefined>();
    const [nudged, setNudged] = useState(false);
    // Friends see the whole page; anyone else (from the world leaderboard) sees
    // only their name, picture and level, and a way to add them.
    const [relation, setRelation] = useState<{ kind: 'self' | 'friend' | 'requested' | 'incoming' | 'none'; requestId?: string } | null>(null);
    const [stranger, setStranger] = useState<{ name: string; username?: string; avatarUrl?: string } | null>(null);
    const [adding, setAdding] = useState(false);
    const [clock, setClock] = useState(() => new Date());

    const load = useCallback(async () => {
        if (!id) return;
        const [found, statuses, about, marksMap, already, link, open] = await Promise.all([
            FriendsService.getFriendProfile(id),
            FeedService.friendStatuses(),
            FriendsService.profileOf(id),
            FriendsService.marksFor([id]),
            FriendsService.nudgedToday(id),
            FriendsService.relationTo(id),
            FriendsService.publicProfile(id),
        ]);
        setRelation(link);
        setStranger(open);
        setFriend(found);
        setStatus(statuses.find(row => row.userId === id) ?? null);
        setProfile(about);
        setMarks(marksMap.get(id));
        setNudged(already);
    }, [id]);

    useEffect(() => {
        void load();
        const timer = setInterval(() => setClock(new Date()), 60_000);
        let stop: (() => void) | undefined;
        void listenToFriends(changed => { if (changed === id) void load(); }).then(unsubscribe => { stop = unsubscribe; });
        return () => { clearInterval(timer); stop?.(); };
    }, [load, id]);

    const isFriend = relation?.kind === 'friend';
    const name = friend?.displayName || status?.name || stranger?.name || 'Friend';
    const username = friend?.username || status?.username || stranger?.username;
    const now = useMemo(() => (status ? statusOf(status, clock) : 'away'), [status, clock]);
    const statusColor = now === 'focus' ? primary : now === 'live' ? colors.success : colors.textTertiary;
    const statusLine = now === 'focus' && status?.focusLabel ? `${STATUS_LABEL.focus} · ${status.focusLabel}` : STATUS_LABEL[now];

    // The same four numbers your own profile shows; absent when they keep
    // their progress private (friend_stats leaves them out).
    const numbers: ProfileNumbers | undefined = isFriend && friend ? {
        streak: friend.currentStreak ?? 0,
        habits: friend.todayTotal ?? 0,
        goals: friend.goalsActive ?? 0,
        todayDone: (friend.todayCompleted ?? 0) + (friend.tasksDone ?? 0),
        todayTotal: (friend.todayTotal ?? 0) + (friend.tasksTotal ?? 0),
    } : undefined;

    const add = async () => {
        if (!relation || adding) return;
        mediumFeedback();
        setAdding(true);
        const ok = relation.kind === 'incoming' && relation.requestId
            ? await FriendsService.acceptFriendRequest(relation.requestId)
            : await FriendsService.sendFriendRequest(id);
        setAdding(false);
        if (ok) void load();
        else Alert.alert('Could not send that', 'Please try again.');
    };

    const nudge = async () => {
        if (nudged) return;
        mediumFeedback();
        if (await FriendsService.nudgeFriend(id, name)) setNudged(true);
    };

    const report = () => {
        const file = async (reason: string) => {
            const ok = await FriendsService.reportContent({ userId: id, kind: 'profile', reason });
            Alert.alert(ok ? 'Reported' : 'Could not send that', ok ? 'Thank you. Somebody will read it.' : 'Please try again.');
        };
        Alert.alert(`Report ${name}`, 'What is wrong?', [
            { text: 'Spam', onPress: () => void file('spam') },
            { text: 'Harassment', onPress: () => void file('harassment') },
            { text: 'Something else', onPress: () => void file('other') },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const menu: MorphMenuItem[] = [
        ...(isFriend ? [{ label: nudged ? 'Nudged today' : 'Nudge', icon: 'hand-left-outline', onPress: () => void nudge() } satisfies MorphMenuItem] : []),
        { label: 'Report', icon: 'flag-outline', onPress: report },
        ...(!isFriend ? [] : [{
            label: 'Remove friend', icon: 'person-remove-outline', destructive: true, onPress: async () => {
                if (await FriendsService.removeFriend(id)) router.back();
            },
        } satisfies MorphMenuItem]),
        {
            label: 'Block', icon: 'hand-left-outline', destructive: true, onPress: () => Alert.alert(`Block ${name}?`, 'They will not see your day and cannot reach you. It also removes them as a friend.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Block', style: 'destructive', onPress: async () => { if (await FriendsService.blockUser(id)) router.back(); } },
            ]),
        },
    ];

    return (
        <VoidShell>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <ProfileView
                    name={name}
                    bio={profile.bio ?? ''}
                    meta={username ? `@${username}` : ''}
                    avatar={profile.avatarUrl ?? friend?.avatarUrl ?? status?.avatarUrl ?? stranger?.avatarUrl}
                    initials={name.slice(0, 1).toUpperCase()}
                    topInset={insets.top}
                    marks={marks}
                    marksSeries={isFriend ? profile.marksSeries : undefined}
                    status={isFriend ? now : undefined}
                    numbers={numbers}
                    hiddenNote={isFriend ? undefined : 'Add them as a friend to see their day'}
                    subline={!isFriend ? null : 
                        // What only someone else has: what they are doing now.
                        <View style={styles.status}>
                            <AppIcon name={now === 'focus' ? 'lock-closed' : now === 'asleep' ? 'moon' : now === 'live' ? 'radio-button-on' : 'ellipse-outline'} size={13} color={statusColor} />
                            <Text style={[styles.statusText, { color: statusColor }]}>{statusLine}</Text>
                        </View>
                    }
                />

                {/* Someone who is not a friend yet: the way to add them. */}
                {relation && !isFriend && relation.kind !== 'self' ? (
                    <View style={styles.actions}>
                        {relation.kind === 'requested' ? (
                            <AppButton label="Requested" icon="time-outline" onPress={() => undefined} disabled />
                        ) : relation.kind === 'incoming' ? (
                            <AppButton label="Accept friend request" icon="checkmark" onPress={() => void add()} loading={adding} />
                        ) : (
                            <AppButton label="Add friend" icon="person-add" onPress={() => void add()} loading={adding} />
                        )}
                    </View>
                ) : null}
            </ScrollView>

            {/* The same floating controls as your own profile. */}
            <View style={[styles.back, { top: insets.top + 8 }]}>
                <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} diameter={40} size={24} />
            </View>
            <View style={[styles.more, { top: insets.top + 8 }]}>
                <MorphMenu items={menu} title={name} titleIcon="person" label="Manage friendship" diameter={40} />
            </View>
        </VoidShell>
    );
}
