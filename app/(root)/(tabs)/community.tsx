import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FlipInEasyY, ReduceMotion } from 'react-native-reanimated';
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
import { FocusingNow } from '@/components/Community/FocusingNow';
import { useFocusSession } from '@/context/FocusTimeContext';
import { hostOf, togetherId } from '@/lib/focusTogether';
import { Colors } from '@/theme/colors';
import { Radius } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { FriendsService, getMyUsername, type FriendRequest } from '@/lib/friendsService';
import { FeedService, type FeedPost, type FriendStatusRow } from '@/lib/feedService';
import { withMyReaction, type Reaction } from '@/lib/reactions';
import { Confetti } from '@/components/ui/Confetti';
import { Overlay } from '@/components/ui/Overlay';
import { SealedDayCard } from '@/components/Community/SealedDayCard';
import { CrewQuest } from '@/components/Community/CrewQuest';
import { MarketSection } from '@/components/Market/MarketSection';
import { WeekView } from '@/components/Community/WeekView';
import { CrownMoment } from '@/components/Community/CrownMoment';
import { ViewSwitcher } from '@/components/ui/ViewSwitcher';
import { useCrewWeek } from '@/hooks/useCrewWeek';
import { marketFeed } from '@/lib/market';
import { MARKET_ENABLED } from '@/constants/features';
import { questStanding, questWeek, type CrewMember } from '@/lib/crewQuest';
import { useWeekStart } from '@/hooks/useWeekStart';
import { hasDropped, isSealed, minuteOf } from '@/lib/theDrop';
import { clockLabel } from '@/lib/dayFlow';
import { localDateKey } from '@/lib/habitSchedule';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { statusOf } from '@/lib/presence';
import { listenToFriends, announceChange } from '@/lib/livePulse';
import { onAccountChange } from '@/lib/account';
import { on } from '@/lib/appEvents';
import { useCoachTarget } from '@/hooks/useCoachTarget';
import { OFFLINE_LINES, useOnline } from '@/lib/connectivity';
import { useMyProfile } from '@/hooks/useMyProfile';
import { styles } from '@/styles/screens/tabs/community.styles';

const PAGE = 15;
/** The day the drop's cards last flipped open on this phone. */
const DROP_SEEN = 'habyss_drop_seen';
/** The week whose crew quest was last celebrated on this phone. */
const QUEST_CHEERED = 'habyss_crew_quest_cheered';

/**
 * Community: what your friends are doing right now, and how their days went.
 *
 * In three views, each with a dot when something there is new. Today: every
 * friend's face and status (the crown on whoever holds it), who is focusing,
 * and the feed of everyone's day. This week: King of the Week and the race
 * for the next crown, the king's challenge, your secret mission and last
 * week's secrets, the crew quest. Bets: friends' goals open to Shards. The
 * leaderboard is one tap away in the header.
 */
export default function CommunityScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { thud, lightFeedback, mediumFeedback, selectionFeedback, successFeedback } = useHaptics();
    const router = useRouter();
    const { horizontalPadding, topSpacing, tabBarClearance } = useResponsiveLayout();

    const [gate, setGate] = useState<'signed_out' | 'needs_username' | null | undefined>(undefined);
    // Community in three: today (who's around, their days), this week (the crown,
    // your mission, the crew quest), and bets. Each says when something there is new.
    const [view, setView] = useState<'today' | 'week' | 'bets'>('today');
    const week = useCrewWeek(gate === null);
    const [betsNew, setBetsNew] = useState(false);
    const [me, setMe] = useState<{ id: string; name: string } | null>(null);
    // Your own name and photo come from the one profile store, not the server's copy.
    const myProfile = useMyProfile();
    const [userCode, setUserCode] = useState('');
    const [unread, setUnread] = useState(0);
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [statuses, setStatuses] = useState<FriendStatusRow[]>([]);
    const [posts, setPosts] = useState<FeedPost[]>([]);
    // Whose focus session you are in, if you joined one (lib/focusTogether.ts).
    const focusSession = useFocusSession();
    const joinedHost = focusSession.isRunning || focusSession.isPaused ? hostOf(focusSession.activeHabitId) : null;
    const [rank, setRank] = useState<number | null>(null);
    const [shareTime, setShareTime] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [endReached, setEndReached] = useState(false);
    const [showAddFriend, setShowAddFriend] = useState(false);
    // The tour ends here: friends are added from this button.
    const addFriendTarget = useCoachTarget<View>('add-friend');
    // Status depends on the clock (bedtime, a focus session ending), so it is
    // recomputed every minute without fetching anything.
    const [clock, setClock] = useState(() => new Date());
    // This week's crew quest (lib/crewQuest.ts), and the week it is for.
    const [crew, setCrew] = useState<CrewMember[]>([]);
    const [questFrom, setQuestFrom] = useState('');
    const mondayFirst = useRef(true);
    mondayFirst.current = useWeekStart() === 'monday';
    // The drop (lib/theDrop.ts): friends' cards from today stay sealed until
    // your day goes up at your time, then flip open one by one, once a day.
    const today = localDateKey(clock);
    const nowMinutes = clock.getHours() * 60 + clock.getMinutes();
    const dropped = hasDropped(shareTime, nowMinutes);
    const opensAt = clockLabel(minuteOf(shareTime) ?? 0);
    const [dropSeen, setDropSeen] = useState<string | null | undefined>(undefined);
    useEffect(() => { AsyncStorage.getItem(DROP_SEEN).then(value => setDropSeen(value ?? null)).catch(() => setDropSeen(null)); }, []);
    const flipping = dropped && dropSeen !== undefined && dropSeen !== today && posts.some(post => !post.mine && post.day === today);
    useEffect(() => {
        if (!flipping) return;
        const timer = setTimeout(() => { setDropSeen(today); void AsyncStorage.setItem(DROP_SEEN, today).catch(() => undefined); }, 4000);
        return () => clearTimeout(timer);
    }, [flipping, today]);
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
            // Unknown (the lookup failed) is not "no username": keep what is shown.
            const username = await getMyUsername().catch(() => undefined);
            if (username === undefined) return;
            setUserCode(username ?? '');
            setGate(username ? null : 'needs_username');
            if (!username) return;
            await FriendsService.repairFriendshipsFromAcceptedRequests().catch(() => undefined);
            void FriendsService.refreshSharedIds().catch(() => undefined);
            const week = questWeek(localDateKey(new Date()), mondayFirst.current);
            const [current, requestList, statusList, feed, board, settings, unreadCount, quest] = await Promise.all([
                FriendsService.getCurrentUser(),
                FriendsService.getFriendRequests(),
                FeedService.friendStatuses(),
                FeedService.feed(undefined, PAGE),
                FeedService.leaderboard('friends'),
                FeedService.shareSettings(),
                FriendsService.unreadCount(),
                FeedService.crewQuest(week.from, week.to),
            ]);
            setCrew(quest);
            setQuestFrom(week.from);
            if (current) setMe({ id: current.id, name: current.displayName || current.username });
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
        if (online) { week.reload(); await load(); }
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

    const kingId = week.king?.userId ?? null;
    const rail = useMemo<RailFriend[]>(() => statuses.map(row => ({
        userId: row.userId, name: row.name, avatarUrl: row.avatarUrl, status: statusOf(row, clock), crowned: row.userId === kingId,
    })), [statuses, clock, kingId]);

    // Bets: new when a friend's goal is open and you have nothing on it yet.
    useFocusEffect(useCallback(() => {
        if (!MARKET_ENABLED || gate !== null) return;
        marketFeed().then(markets => setBetsNew(markets.some(market => market.status === 'open' && !market.mine && !market.myStake))).catch(() => undefined);
    }, [gate]));
    const choose = (next: 'today' | 'week' | 'bets') => {
        setView(next);
        if (next === 'week') week.markSeen();
        if (next === 'bets') setBetsNew(false);
    };

    /** Names and faces for the people who acknowledged a post. */
    const people = useMemo(() => {
        const map = new Map(statuses.map(row => [row.userId, { name: row.name, avatarUrl: row.avatarUrl }]));
        if (me) map.set(me.id, { name: myProfile.name || me.name, avatarUrl: myProfile.avatar ?? undefined });
        return map;
    }, [statuses, me, myProfile.name, myProfile.avatar]);
    /** Each friend's status now, for the mark on their photo in the feed. */
    const statusById = useMemo(() => new Map(rail.map(friend => [friend.userId, friend.status])), [rail]);

    // A perfect day reacted to: confetti over the feed, once.
    const [cheer, setCheer] = useState(0);
    useEffect(() => {
        if (!cheer) return;
        const timer = setTimeout(() => setCheer(0), 2600);
        return () => clearTimeout(timer);
    }, [cheer]);
    // The crew quest reached: confetti once that week, on this phone.
    const questReached = questStanding(crew).reached && crew.length >= 2;
    useEffect(() => {
        if (!questReached || !questFrom) return;
        void AsyncStorage.getItem(QUEST_CHEERED).then(week => {
            if (week === questFrom) return;
            setCheer(Date.now());
            successFeedback();
            void AsyncStorage.setItem(QUEST_CHEERED, questFrom).catch(() => undefined);
        }).catch(() => undefined);
    }, [questReached, questFrom, successFeedback]);
    /** Reacts to a friend's day, changes the reaction, or takes it back (null). */
    const react = async (post: FeedPost, reaction: Reaction | null) => {
        if (reaction) mediumFeedback(); else selectionFeedback();
        const before = post.myReaction;
        // Shown at once; put back if the server says no.
        const show = (from: Reaction | null, to: Reaction | null) => setPosts(prev => prev.map(item => item.userId === post.userId && item.day === post.day
            ? {
                ...item,
                myReaction: to,
                ackedByMe: !!to,
                reactions: withMyReaction(item.reactions, from, to),
                ackCount: item.ackCount + (to ? 1 : 0) - (from ? 1 : 0),
                ackUsers: to ? [...item.ackUsers.filter(id => id !== me?.id), me?.id ?? ''] : item.ackUsers.filter(id => id !== me?.id),
            }
            : item));
        show(before, reaction);
        const total = post.card.habitsTotal + post.card.tasksTotal;
        if (reaction && !before && total > 0 && post.card.habitsDone + post.card.tasksDone >= total) setCheer(Date.now());
        const ok = reaction ? await FeedService.acknowledge(post, reaction) : await FeedService.unacknowledge(post);
        if (!ok) show(reaction, before);
        else announceChange();
    };

    /** Reports a day card (its habit and task names are what others wrote). */
    const reportPost = (post: FeedPost) => {
        lightFeedback();
        const file = async (reason: string) => {
            const ok = await FriendsService.reportContent({ userId: post.userId, kind: 'other', reason, reference: `day_card:${post.day}` });
            Alert.alert(ok ? 'Reported' : 'Could not send that', ok ? 'Thank you. Somebody will read it.' : 'Please try again.');
        };
        Alert.alert(`Report ${post.name}'s day`, 'What is wrong?', [
            { text: 'Offensive words', onPress: () => void file('offensive') },
            { text: 'Spam', onPress: () => void file('spam') },
            { text: 'Something else', onPress: () => void file('other') },
            { text: 'Cancel', style: 'cancel' },
        ]);
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
                        <View ref={addFriendTarget} collapsable={false}>
                            <IconButton icon="person-add" label="Add a friend" onPress={() => { mediumFeedback(); setShowAddFriend(true); }} diameter={40} size={20} />
                        </View>
                    </View>
                ) : null}
            </View>

            {gate ? <FriendsGate needsUsername={gate === 'needs_username'} onReady={() => { void load(); }} /> : null}

            {gate === null ? (
                <View style={styles.block}>
                    <ViewSwitcher accent={primary} value={view} onChange={choose} options={[
                        { id: 'today', label: 'Today', icon: 'sunny' },
                        { id: 'week', label: 'This week', icon: 'calendar', dot: week.fresh },
                        ...(MARKET_ENABLED ? [{ id: 'bets' as const, label: 'Bets', icon: 'trending-up' as const, dot: betsNew }] : []),
                    ]} />
                </View>
            ) : null}

            {gate === null && view === 'today' && requests.length > 0 ? (
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

            {gate === null && view === 'today' && rail.length > 0 ? (
                <View style={styles.block}>
                    <FriendsRail friends={rail} onOpen={friend => openFriend(friend.userId)} />
                </View>
            ) : null}

            {/* Friends locked in right now: one tap to focus beside them. */}
            {gate === null && view === 'today' ? (
                <FocusingNow style={styles.block} friends={statuses} now={clock.getTime()} joinedHost={joinedHost}
                    onOpen={openFriend}
                    onJoin={host => {
                        mediumFeedback();
                        router.push({ pathname: '/(root)/focus', params: { id: togetherId(host), kind: 'together' } });
                    }} />
            ) : null}

            {/* This week: the crown and its race, the king's challenge, your secret mission, the crew quest. */}
            {gate === null && view === 'week' ? (
                <WeekView style={styles.block} week={week} meId={me?.id ?? null} quest={<CrewQuest members={crew} />} />
            ) : null}

            {/* Friends' goals open to bets: Shards on whether they make it. */}
            {gate === null && view === 'bets' && MARKET_ENABLED ? <MarketSection style={styles.block} /> : null}

            {gate === null && view === 'today' ? <SectionTitle first>Feed</SectionTitle> : null}
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
                data={gate === null && view === 'today' ? posts : []}
                keyExtractor={post => `${post.userId}:${post.day}`}
                ListHeaderComponent={header}
                contentContainerStyle={{ paddingTop: topSpacing + 36, paddingHorizontal: horizontalPadding, paddingBottom: tabBarClearance }}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textTertiary} progressViewOffset={topSpacing} />}
                onEndReached={() => { void loadMore(); }}
                onEndReachedThreshold={0.6}
                renderItem={({ item, index }) => (
                    <ListItem index={index}>
                        {isSealed(item, today, shareTime, nowMinutes) ? (
                            <SealedDayCard key="sealed" name={item.name} avatarUrl={item.avatarUrl} opensAt={opensAt} />
                        ) : (
                        <Animated.View key="open" entering={flipping && !item.mine && item.day === today ? FlipInEasyY.duration(520).delay(index * 140).reduceMotion(ReduceMotion.System) : undefined}>
                        <DayPostCard
                            name={item.mine ? (myProfile.name || item.name) : item.name}
                            avatarUrl={item.mine ? myProfile.avatar ?? undefined : item.avatarUrl}
                            status={item.mine ? undefined : statusById.get(item.userId)}
                            postedAt={item.postedAt}
                            card={item.card}
                            mine={item.mine}
                            myReaction={item.myReaction}
                            reactions={item.reactions}
                            ackFaces={item.ackUsers.flatMap(id => { const face = people.get(id); return face ? [face] : []; })}
                            onReact={reaction => void react(item, reaction)}
                            onOpenAuthor={() => (item.mine ? router.push('/(root)/profile') : openFriend(item.userId))}
                            onReport={item.mine ? undefined : () => reportPost(item)}
                            crowned={item.userId === kingId}
                        />
                        </Animated.View>
                        )}
                    </ListItem>
                )}
                ListEmptyComponent={gate === null && view === 'today' ? (
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

            {cheer ? (
                <Overlay>
                    <View pointerEvents="none" style={styles.cheer}><Confetti key={cheer} colors={[primary, colors.success, colors.warning, colors.textPrimary]} /></View>
                </Overlay>
            ) : null}
            {/* The crown changed hands: everyone in the crew sees it once that week. */}
            {gate === null && week.dethroned && week.king && week.previousKing ? (
                <CrownMoment king={week.king} previous={week.previousKing} meId={me?.id ?? null} onDone={week.markCrownSeen} />
            ) : null}
            <AddFriendModal visible={showAddFriend} onClose={() => setShowAddFriend(false)} userCode={userCode} onFriendAdded={() => { void load(); }} />
        </VoidShell>
    );
}
