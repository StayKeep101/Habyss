import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { IconTile } from '@/components/ui/IconTile';
import { useFocusEffect, useRouter } from 'expo-router';
import { VoidShell } from '@/components/ui/VoidShell';
import { VoidCard } from '@/components/ui/VoidCard';
import { IconButton } from '@/components/ui/IconButton';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon } from '@/components/ui/AppIcon';
import { Avatar } from '@/components/ui/Avatar';
import { ListItem } from '@/components/ui/Motion';
import { FriendsGate } from '@/components/Community/FriendsGate';
import { AddFriendModal } from '@/components/Community/AddFriendModal';
import { FriendsRail, type RailFriend } from '@/components/Community/FriendsRail';
import { DayPostCard } from '@/components/Community/DayPostCard';
import { Colors } from '@/theme/colors';
import { Radius } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { FriendsService, getMyUsername, type FriendRequest } from '@/lib/friendsService';
import { FeedService, type FeedPost, type FriendStatusRow } from '@/lib/feedService';
import { statusOf } from '@/lib/presence';
import { listenToFriends, announceChange } from '@/lib/livePulse';
import { onAccountChange } from '@/lib/account';
import { on } from '@/lib/appEvents';
import { OFFLINE_LINES, useOnline } from '@/lib/connectivity';
import { styles } from '@/styles/screens/tabs/community.styles';

const PAGE = 15;

/**
 * Community: what your friends are doing right now, and how their days went.
 *
 * Along the top, every friend's face and status — locked in, live, asleep.
 * Below, the feed: each person's day, posted at the time they chose, which
 * friends acknowledge. The leaderboard is one tap away in the header.
 */
export default function CommunityScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { thud, lightFeedback, mediumFeedback, selectionFeedback } = useHaptics();
    const router = useRouter();
    const { horizontalPadding, topSpacing, tabBarClearance } = useResponsiveLayout();

    const [gate, setGate] = useState<'signed_out' | 'needs_username' | null | undefined>(undefined);
    const [me, setMe] = useState<{ id: string; name: string; avatarUrl?: string } | null>(null);
    const [userCode, setUserCode] = useState('');
    const [unread, setUnread] = useState(0);
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [statuses, setStatuses] = useState<FriendStatusRow[]>([]);
    const [posts, setPosts] = useState<FeedPost[]>([]);
    const [rank, setRank] = useState<number | null>(null);
    const [shareTime, setShareTime] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [endReached, setEndReached] = useState(false);
    const [showAddFriend, setShowAddFriend] = useState(false);
    // Status depends on the clock (bedtime, a focus session ending), so it is
    // recomputed every minute without fetching anything.
    const [clock, setClock] = useState(() => new Date());
    const loading = useRef(false);
    // Community is the one place that needs the internet; without it, a joke
    // rather than an empty page, and a fresh one each time you pull.
    const online = useOnline();
    const [joke, setJoke] = useState(0);

    const load = useCallback(async () => {
        if (loading.current) return;
        loading.current = true;
        try {
            if (!(await FriendsService.isAvailable())) { setGate('signed_out'); return; }
            const username = await getMyUsername();
            setUserCode(username ?? '');
            setGate(username ? null : 'needs_username');
            if (!username) return;
            await FriendsService.repairFriendshipsFromAcceptedRequests().catch(() => undefined);
            void FriendsService.refreshSharedIds().catch(() => undefined);
            const [current, requestList, statusList, feed, board, settings, unreadCount] = await Promise.all([
                FriendsService.getCurrentUser(),
                FriendsService.getFriendRequests(),
                FeedService.friendStatuses(),
                FeedService.feed(undefined, PAGE),
                FeedService.leaderboard('friends'),
                FeedService.shareSettings(),
                FriendsService.unreadCount(),
            ]);
            if (current) setMe({ id: current.id, name: current.displayName || current.username, avatarUrl: current.avatarUrl });
            setRequests(requestList);
            setStatuses(statusList);
            setPosts(feed);
            setEndReached(feed.length < PAGE);
            setRank(board.find(row => row.isMe)?.rank ?? null);
            setShareTime(settings?.enabled ? settings.time : null);
            setUnread(unreadCount);
        } finally {
            loading.current = false;
        }
    }, []);

    useFocusEffect(useCallback(() => { void load(); }, [load]));
    // Back online: catch up at once.
    useEffect(() => { if (online) void load(); }, [online, load]);
    useEffect(() => {
        const timer = setInterval(() => setClock(new Date()), 60_000);
        const social = on('social_state_updated', () => { void load(); });
        const account = onAccountChange(() => { void load(); });
        // A friend's day or status changed: refresh, a beat later so a burst is one load.
        let pending: ReturnType<typeof setTimeout> | null = null;
        let stop: (() => void) | undefined;
        void listenToFriends(() => {
            if (pending) clearTimeout(pending);
            pending = setTimeout(() => { pending = null; void load(); }, 800);
        }).then(unsubscribe => { stop = unsubscribe; });
        return () => { clearInterval(timer); social.remove(); account(); stop?.(); if (pending) clearTimeout(pending); };
    }, [load]);

    const onRefresh = async () => {
        thud();
        setRefreshing(true);
        if (online) await load();
        setRefreshing(false);
        if (!online) setTimeout(() => setJoke(value => value + 1), 350);
    };

    const loadMore = async () => {
        if (loadingMore || endReached || posts.length === 0) return;
        setLoadingMore(true);
        const next = await FeedService.feed(posts[posts.length - 1].postedAt, PAGE);
        setPosts(prev => [...prev, ...next.filter(post => !prev.some(item => item.userId === post.userId && item.day === post.day))]);
        setEndReached(next.length < PAGE);
        setLoadingMore(false);
    };

    const rail = useMemo<RailFriend[]>(() => statuses.map(row => ({
        userId: row.userId, name: row.name, avatarUrl: row.avatarUrl, status: statusOf(row, clock),
    })), [statuses, clock]);

    /** Names and faces for the people who acknowledged a post. */
    const people = useMemo(() => {
        const map = new Map(statuses.map(row => [row.userId, { name: row.name, avatarUrl: row.avatarUrl }]));
        if (me) map.set(me.id, { name: me.name, avatarUrl: me.avatarUrl });
        return map;
    }, [statuses, me]);

    const acknowledge = async (post: FeedPost) => {
        selectionFeedback();
        const next = !post.ackedByMe;
        // Shown at once; put back if the server says no.
        const flip = (acked: boolean) => setPosts(prev => prev.map(item => item.userId === post.userId && item.day === post.day
            ? {
                ...item,
                ackedByMe: acked,
                ackCount: item.ackCount + (acked ? 1 : -1),
                ackUsers: acked ? [...item.ackUsers, me?.id ?? ''] : item.ackUsers.filter(id => id !== me?.id),
            }
            : item));
        flip(next);
        const ok = next ? await FeedService.acknowledge(post) : await FeedService.unacknowledge(post);
        if (!ok) flip(!next);
        else announceChange();
    };

    const openFriend = (userId: string) => {
        lightFeedback();
        router.push({ pathname: '/(root)/friend' as never, params: { id: userId } });
    };

    const answer = async (request: FriendRequest, accept: boolean) => {
        lightFeedback();
        setRequests(prev => prev.filter(item => item.id !== request.id));
        if (accept) await FriendsService.acceptFriendRequest(request.id);
        else await FriendsService.declineFriendRequest(request.id);
        void load();
    };

    const header = (
        <View>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Community</Text>
                {gate === null ? (
                    <View style={styles.headerActions}>
                        {/* Your place among friends; the world board is inside. */}
                        <Pressable onPress={() => { lightFeedback(); router.push('/(root)/leaderboard' as never); }}
                            accessibilityRole="button" accessibilityLabel={rank ? `Leaderboard, you are number ${rank}` : 'Leaderboard'}>
                            <MatteSurface radius={Radius.pill} level="control" style={styles.rank}>
                                <AppIcon name="trophy" size={15} color={primary} />
                                <Text style={[styles.rankText, { color: colors.textPrimary }]}>{rank ? `#${rank}` : '—'}</Text>
                            </MatteSurface>
                        </Pressable>
                        <IconButton icon={unread > 0 ? 'notifications' : 'notifications-outline'}
                            label={unread > 0 ? `Inbox, ${unread} waiting` : 'Inbox'}
                            onPress={() => { lightFeedback(); router.push('/(root)/inbox'); }} diameter={40} size={20} badge={unread} />
                        <IconButton icon="person-add" label="Add a friend" onPress={() => { mediumFeedback(); setShowAddFriend(true); }} diameter={40} size={20} />
                    </View>
                ) : null}
            </View>

            {gate ? <FriendsGate needsUsername={gate === 'needs_username'} onReady={() => { void load(); }} /> : null}

            {gate === null && requests.length > 0 ? (
                <View style={styles.block}>
                    <SectionTitle first>Requests</SectionTitle>
                    <VoidCard style={styles.requests}>
                        {requests.map(request => {
                            const name = request.fromName ?? request.fromUsername;
                            return (
                                <View key={request.id} style={styles.requestRow}>
                                    <Avatar name={name} uri={request.fromAvatarUrl} size={36} />
                                    <Text numberOfLines={1} style={[styles.requestName, { color: colors.textPrimary }]}>{name}</Text>
                                    <IconButton icon="checkmark" label={`Accept ${name}`} onPress={() => void answer(request, true)} diameter={34} size={18} color={colors.success} />
                                    <IconButton icon="close" label={`Decline ${name}`} onPress={() => void answer(request, false)} diameter={34} size={18} color={colors.textTertiary} />
                                </View>
                            );
                        })}
                    </VoidCard>
                </View>
            ) : null}

            {gate === null && rail.length > 0 ? (
                <View style={styles.block}>
                    <FriendsRail friends={rail} onOpen={friend => openFriend(friend.userId)} />
                </View>
            ) : null}

            {gate === null ? <SectionTitle first>Feed</SectionTitle> : null}
        </View>
    );

    if (!online) {
        return (
            <VoidShell>
                <ScrollView
                    contentContainerStyle={[styles.offlineContent, { paddingTop: topSpacing + 36, paddingHorizontal: horizontalPadding }]}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textTertiary} progressViewOffset={topSpacing} />}
                >
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Community</Text>
                    <View style={styles.offline}>
                        <IconTile icon="cloud-offline" color={colors.textTertiary} size={56} />
                        <Animated.Text key={joke} entering={FadeIn.duration(250)} style={[styles.offlineTitle, { color: colors.textPrimary }]}>
                            {OFFLINE_LINES[joke % OFFLINE_LINES.length]}
                        </Animated.Text>
                        <Text style={[styles.offlineText, { color: colors.textTertiary }]}>Community comes back when you’re online. Everything else works without it.</Text>
                    </View>
                </ScrollView>
            </VoidShell>
        );
    }

    if (gate === undefined) {
        return <VoidShell><View style={styles.loader}><ActivityIndicator color={colors.textTertiary} /></View></VoidShell>;
    }

    return (
        <VoidShell>
            <FlatList
                data={gate === null ? posts : []}
                keyExtractor={post => `${post.userId}:${post.day}`}
                ListHeaderComponent={header}
                contentContainerStyle={{ paddingTop: topSpacing + 36, paddingHorizontal: horizontalPadding, paddingBottom: tabBarClearance }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textTertiary} progressViewOffset={topSpacing} />}
                onEndReached={() => { void loadMore(); }}
                onEndReachedThreshold={0.6}
                renderItem={({ item, index }) => (
                    <ListItem index={index}>
                        <DayPostCard
                            name={item.name}
                            avatarUrl={item.avatarUrl}
                            postedAt={item.postedAt}
                            card={item.card}
                            mine={item.mine}
                            ackCount={item.ackCount}
                            acked={item.ackedByMe}
                            ackFaces={item.ackUsers.flatMap(id => { const face = people.get(id); return face ? [face] : []; })}
                            onAcknowledge={() => void acknowledge(item)}
                            onOpenAuthor={() => (item.mine ? router.push('/(root)/profile') : openFriend(item.userId))}
                        />
                    </ListItem>
                )}
                ListEmptyComponent={gate === null ? (
                    <View style={styles.empty}>
                        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                            {shareTime ? `Your day posts here at ${shareTime}. Your friends' days show up at the times they choose.` : "Your friends' days show up here at the times they choose."}
                        </Text>
                        <Pressable onPress={() => router.push('/(root)/sharing')} accessibilityRole="button">
                            <Text style={[styles.emptyLink, { color: primary }]}>{shareTime ? 'Change the time' : 'Turn on daily posts'}</Text>
                        </Pressable>
                    </View>
                ) : null}
                ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.more} color={colors.textTertiary} /> : null}
            />

            <AddFriendModal visible={showAddFriend} onClose={() => setShowAddFriend(false)} userCode={userCode} onFriendAdded={() => { void load(); }} />
        </VoidShell>
    );
}
