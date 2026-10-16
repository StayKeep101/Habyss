import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { AppButton } from '@/components/ui/AppButton';
import { MorphMenu, type MorphMenuItem } from '@/components/ui/MorphMenu';
import { AppIcon } from '@/components/ui/AppIcon';
import { Avatar } from '@/components/ui/Avatar';
import { CountUp, ListItem, PopIn } from '@/components/ui/Motion';
import { DayPostCard } from '@/components/Community/DayPostCard';
import { LevelCard } from '@/components/Profile/LevelCard';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { FriendsService, type Friend } from '@/lib/friendsService';
import { FeedService, type FeedPost, type FriendStatusRow } from '@/lib/feedService';
import { STATUS_LABEL, statusOf } from '@/lib/presence';
import { announceChange, listenToFriends } from '@/lib/livePulse';
import { styles } from '@/styles/screens/friend.styles';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * A friend's page: who they are, what they are doing right now, how their
 * week is going, and the days they have posted. Nudging, removing, blocking
 * and reporting live in one menu at the top.
 */
export default function FriendScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { lightFeedback, mediumFeedback, selectionFeedback } = useHaptics();

    const [friend, setFriend] = useState<Friend | null>(null);
    const [status, setStatus] = useState<FriendStatusRow | null>(null);
    const [bio, setBio] = useState<string | undefined>();
    const [marks, setMarks] = useState<number | undefined>();
    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [nudged, setNudged] = useState(false);
    const [clock, setClock] = useState(() => new Date());

    const load = useCallback(async () => {
        if (!id) return;
        const [found, statuses, profile, marksMap, feed, already] = await Promise.all([
            FriendsService.getFriendProfile(id),
            FeedService.friendStatuses(),
            FriendsService.profileOf(id),
            FriendsService.marksFor([id]),
            FeedService.feed(undefined, 10, id),
            FriendsService.nudgedToday(id),
        ]);
        setFriend(found);
        setStatus(statuses.find(row => row.userId === id) ?? null);
        setBio(profile.bio);
        setMarks(marksMap.get(id));
        setPosts(feed);
        setNudged(already);
    }, [id]);

    useEffect(() => {
        void load();
        const timer = setInterval(() => setClock(new Date()), 60_000);
        let stop: (() => void) | undefined;
        void listenToFriends(changed => { if (changed === id) void load(); }).then(unsubscribe => { stop = unsubscribe; });
        return () => { clearInterval(timer); stop?.(); };
    }, [load, id]);

    const name = friend?.displayName || status?.name || 'Friend';
    const now = useMemo(() => (status ? statusOf(status, clock) : 'away'), [status, clock]);
    const statusColor = now === 'focus' ? primary : now === 'live' ? colors.success : colors.textTertiary;
    const statusLine = now === 'focus' && status?.focusLabel ? `${STATUS_LABEL.focus} · ${status.focusLabel}` : STATUS_LABEL[now];

    const nudge = async () => {
        if (!friend || nudged) return;
        mediumFeedback();
        const ok = await FriendsService.nudgeFriend(friend.id, name);
        if (ok) setNudged(true);
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
        { label: 'Report', icon: 'flag-outline', onPress: report },
        {
            label: 'Remove friend', icon: 'person-remove-outline', destructive: true, onPress: async () => {
                if (await FriendsService.removeFriend(id)) router.back();
            },
        },
        {
            label: 'Block', icon: 'hand-left-outline', destructive: true, onPress: () => Alert.alert(`Block ${name}?`, 'They will not see your day and cannot reach you. It also removes them as a friend.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Block', style: 'destructive', onPress: async () => { if (await FriendsService.blockUser(id)) router.back(); } },
            ]),
        },
    ];

    const acknowledge = async (post: FeedPost) => {
        selectionFeedback();
        const next = !post.ackedByMe;
        const flip = (acked: boolean) => setPosts(prev => prev.map(item => item.day === post.day
            ? { ...item, ackedByMe: acked, ackCount: item.ackCount + (acked ? 1 : -1) } : item));
        flip(next);
        const ok = next ? await FeedService.acknowledge(post) : await FeedService.unacknowledge(post);
        if (!ok) flip(!next); else announceChange();
    };

    const done = (friend?.todayCompleted ?? 0) + (friend?.tasksDone ?? 0);
    const total = (friend?.todayTotal ?? 0) + (friend?.tasksTotal ?? 0);
    const week = friend?.weeklyActivity ?? [];

    return (
        <SheetScreen title="" onBack={() => router.back()} rightSlot={<MorphMenu items={menu} title={name} titleIcon="person" label="Manage friendship" />}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.hero}>
                    <Avatar name={name} uri={friend?.avatarUrl ?? status?.avatarUrl} size={104}
                        ring={now === 'focus' ? primary : now === 'live' ? colors.success : undefined}
                        dim={now === 'asleep'} />
                    <Text style={[styles.name, { color: colors.textPrimary }]}>{name}</Text>
                    {friend?.username ? <Text style={[styles.handle, { color: colors.textTertiary }]}>@{friend.username}</Text> : null}
                    <View style={styles.status}>
                        <AppIcon name={now === 'focus' ? 'lock-closed' : now === 'asleep' ? 'moon' : now === 'live' ? 'radio-button-on' : 'ellipse-outline'} size={13} color={statusColor} />
                        <Text style={[styles.statusText, { color: statusColor }]}>{statusLine}</Text>
                    </View>
                    {bio ? <Text style={[styles.bio, { color: colors.textSecondary }]}>{bio}</Text> : null}
                </View>

                {marks !== undefined ? <View style={styles.level}><LevelCard marks={marks} /></View> : null}

                <VoidCard>
                    <View style={styles.stats}>
                        <View style={styles.stat}>
                            <CountUp style={[styles.statValue, { color: colors.textPrimary }]} value={friend?.currentStreak ?? 0} />
                            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Streak</Text>
                        </View>
                        <View style={styles.stat}>
                            <CountUp style={[styles.statValue, { color: colors.textPrimary }]} value={week.slice(-7).filter(share => share > 0).length} />
                            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Days this week</Text>
                        </View>
                        <View style={styles.stat}>
                            <CountUp style={[styles.statValue, { color: total > 0 && done === total ? colors.success : colors.textPrimary }]} value={`${done}/${total}`} />
                            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Today</Text>
                        </View>
                    </View>
                    {week.length ? (
                        <View style={styles.week}>
                            {week.slice(-7).map((share, index) => (
                                <PopIn key={index} index={index}>
                                    <View style={styles.weekDay}>
                                        <View style={[styles.weekDot, { backgroundColor: share > 0 ? primary : colors.surfaceTertiary, opacity: share > 0 ? 0.35 + Math.min(1, share / 100) * 0.65 : 1 }]} />
                                        <Text style={[styles.weekLabel, { color: colors.textTertiary }]}>{DAYS[index]}</Text>
                                    </View>
                                </PopIn>
                            ))}
                        </View>
                    ) : null}
                </VoidCard>

                <AppButton label={nudged ? 'Nudged today' : 'Nudge'} icon="hand-left-outline" onPress={() => void nudge()} disabled={nudged} style={styles.nudge} />

                <View style={styles.section}>
                    <SectionTitle first>Days</SectionTitle>
                    {posts.length === 0 ? (
                        <Text style={[styles.empty, { color: colors.textTertiary }]}>Nothing posted yet</Text>
                    ) : posts.map((post, index) => (
                        <ListItem key={post.day} index={index}>
                            <DayPostCard name={post.name} avatarUrl={post.avatarUrl} postedAt={post.postedAt} card={post.card}
                                mine={post.mine} ackCount={post.ackCount} acked={post.ackedByMe} ackFaces={[]}
                                onAcknowledge={() => void acknowledge(post)} onOpenAuthor={() => undefined} />
                        </ListItem>
                    ))}
                </View>
            </ScrollView>
        </SheetScreen>
    );
}
