import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions,
    type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    FadeIn, FlipInEasyY, ReduceMotion, interpolate, runOnJS, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
} from 'react-native-reanimated';
import { IconTile } from '@/components/ui/IconTile';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { afterPaint } from '@/lib/afterPaint';
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
import type { RailFriend } from '@/components/Community/FriendsRail';
import { StreamPostCard, type StreamContext } from '@/components/Community/StreamPostCard';
import { PagerGesture } from '@/components/Community/DayPack';
import { RaceSection } from '@/components/Challenge/RaceSection';
import { EmptyState } from '@/components/ui/EmptyState';
import { scheduleDayNotePrompt } from '@/lib/dayNote';
import { buildStream } from '@/lib/communityStream';
import { listenToComments, loadThreads, threadKey, type Comment } from '@/lib/comments';
import { CommentSheet, type CommentTarget } from '@/components/Community/CommentSheet';
import { FocusingNow } from '@/components/Community/FocusingNow';
import { useFocusSession } from '@/context/FocusTimeContext';
import { hostOf, togetherId } from '@/lib/focusTogether';
import { Colors } from '@/theme/colors';
import { Control, Radius } from '@/theme/designSystem';
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
import { MarketSection } from '@/components/Market/MarketSection';
import { ChallengeSection } from '@/components/Challenge/ChallengeSection';
import { WidgetService } from '@/lib/widgetService';
import { widgetRace } from '@/lib/widgetRace';
import { PageDots } from '@/components/ui/PageDots';
import { MarksRace } from '@/components/Community/MarksRace';
import { faceAt, type RaceFace, type Racer } from '@/lib/marksRace';
import { localMarks } from '@/lib/marksSync';
import { useTokens } from '@/hooks/useTokens';
import { marketFeed } from '@/lib/market';
import { MARKET_ENABLED } from '@/constants/features';
import { hasDropped, isSealed, minuteOf } from '@/lib/theDrop';
import { clockLabel } from '@/lib/dayFlow';
import { localDateKey } from '@/lib/habitSchedule';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STATUS_LABEL, statusOf } from '@/lib/presence';
import { listenToFriends, announceChange } from '@/lib/livePulse';
import { onAccountChange } from '@/lib/account';
import { on } from '@/lib/appEvents';
import { useCoachTarget } from '@/hooks/useCoachTarget';
import { OFFLINE_LINES, useOnline } from '@/lib/connectivity';
import { useMyProfile } from '@/hooks/useMyProfile';
import { styles } from '@/styles/screens/tabs/community.styles';
import { IrisFade, irisCoverAt } from '@/components/ui/IrisFade';
import { LinearGradient } from 'expo-linear-gradient';

const PAGE = 15;

/** A fresh page of the feed, keeping who reacted with what from the copy already shown. */
const withReactors = (fresh: FeedPost[], shown: FeedPost[]): FeedPost[] => fresh.map(post => {
    const before = shown.find(item => item.userId === post.userId && item.day === post.day)?.byUser;
    return before ? { ...post, byUser: before } : post;
});
/** The day the drop's cards last flipped open on this phone. */
const DROP_SEEN = 'habyss_drop_seen';

/**
 * Community: what your friends are doing right now, and how their days went.
 *
 * In two views. Today: every friend's face and status, who is focusing, and
 * the feed of everyone's day (accountability only). Challenges: your Shards,
 * challenges and bets, with a dot when a friend's goal is open to a bet. The
 * leaderboard is one tap away in the header.
 */
export default function CommunityScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { thud, lightFeedback, mediumFeedback, selectionFeedback } = useHaptics();
    const router = useRouter();
    const { horizontalPadding, topSpacing, tabBarClearance } = useResponsiveLayout();

    const [gate, setGate] = useState<'signed_out' | 'needs_username' | null | undefined>(undefined);
    // Community in two pages you swipe between: today (who's around, their days) and challenges (Shards, challenges, bets).
    const [page, setPage] = useState(0);
    // Whether the Challenges page has races or challenges to show; both empty, it says where new ones come from.
    const [racesShown, setRacesShown] = useState<boolean | null>(null);
    const [challengesShown, setChallengesShown] = useState<boolean | null>(null);
    // Everyone's Marks over the last month: the race drawn behind the pages.
    const [racers, setRacers] = useState<Racer[]>([]);
    const [betsNew, setBetsNew] = useState(false);
    const [me, setMe] = useState<{ id: string; name: string } | null>(null);
    // Your own name and photo come from the one profile store, not the server's copy.
    const myProfile = useMyProfile();
    const [userCode, setUserCode] = useState('');
    const [unread, setUnread] = useState(0);
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [statuses, setStatuses] = useState<FriendStatusRow[]>([]);
    const [posts, setPosts] = useState<FeedPost[]>([]);
    // The conversation under each day in the feed, by its post key, and the one open.
    const [comments, setComments] = useState<Record<string, Comment[]>>({});
    const [talking, setTalking] = useState<CommentTarget | null>(null);
    // Whose focus session you are in, if you joined one (lib/focusTogether.ts).
    const focusSession = useFocusSession();
    const joinedHost = focusSession.isRunning || focusSession.isPaused ? hostOf(focusSession.activeHabitId) : null;
    const [rank, setRank] = useState<number | null>(null);
    // Everyone's place among friends, for the #2 beside a name on a post.
    const [ranks, setRanks] = useState<Map<string, number>>(new Map());

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
            const [current, requestList, statusList, feed, board, settings, unreadCount] = await Promise.all([
                FriendsService.getCurrentUser(),
                FriendsService.getFriendRequests(),
                FeedService.friendStatuses(),
                FeedService.feed(undefined, PAGE),
                FeedService.leaderboard('friends'),
                FeedService.shareSettings(),
                FriendsService.unreadCount(),
            ]);
            setRanks(new Map(board.map(row => [row.userId, row.rank])));
            // The race: everyone's published history, and your own total as this phone knows it.
            void Promise.all([FriendsService.marksSeriesFor(board.map(row => row.userId)), localMarks()]).then(([series, mine]) => {
                const next = board.map(row => ({
                    id: row.userId, name: row.name, avatarUrl: row.avatarUrl, me: row.isMe,
                    marks: row.isMe && mine !== null ? Math.max(mine, row.marks) : row.marks,
                    series: series.get(row.userId),
                }));
                setRacers(next);
                // The same race on the Friends widget.
                void WidgetService.writeRace(widgetRace(next)).catch(() => undefined);
            }).catch(() => undefined);
            if (current) setMe({ id: current.id, name: current.displayName || current.username });
            setRequests(requestList);
            setStatuses(statusList);
            // Who gave which reaction: kept from before while the fresh answer comes, so faces never lose their emoji.
            setPosts(prev => withReactors(feed, prev));
            void FeedService.reactionsBy(feed).then(by => setPosts(current => current.map(post => {
                const found = by[`day:${post.userId}:${post.day}`];
                return found ? { ...post, byUser: found } : post;
            }))).catch(() => undefined);
            setEndReached(feed.length < PAGE);
            setRank(board.find(row => row.isMe)?.rank ?? null);
            setShareTime(settings?.enabled ? settings.time : null);
            // The note prompt rings at that time each day (lib/dayNote.ts).
            void scheduleDayNotePrompt(settings?.time ?? null, !!settings?.enabled);
            setUnread(unreadCount);
        } finally {
            loading.current = false;
        }
    }, []);

    // Fetched once the tab is on screen, so the switch to it is not held up.
    useFocusEffect(useCallback(() => { const later = afterPaint(() => { void load(); }); return () => later.cancel(); }, [load]));
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

    // The stage: the race fills the top of the screen behind one page, which slides up over it (as on a goal).
    const t = useTokens();
    const insets = useSafeAreaInsets();
    const screen = useWindowDimensions();
    const stage = Math.round(screen.height * 0.46);
    const pageWidth = screen.width;
    const pager = useAnimatedRef<Animated.ScrollView>();
    const pagerGesture = useMemo(() => Gesture.Native(), []);
    const pagePosition = useSharedValue(0);
    const lift = useSharedValue(0);
    // The race plays through the month once, the first time Community opens after
    // the app starts. Pressing the tab while here slides the page back down to it.
    const navigation = useNavigation();
    const sheetScroll = useAnimatedRef<Animated.ScrollView>();
    useEffect(() => navigation.addListener('tabPress' as never, () => {
        if (navigation.isFocused()) sheetScroll.current?.scrollTo({ y: 0, animated: true });
    }), [navigation, sheetScroll]);
    // The finger on the race, or −1: it reads that day (components/Community/MarksRace.tsx).
    const scrub = useSharedValue(-1);
    const onPager = useAnimatedScrollHandler(event => { pagePosition.set(event.contentOffset.x / Math.max(1, pageWidth)); });
    // Two resting places, like the habit page's sheet: half (the race showing, where it
    // opens) and full (the page's header at the top). iOS settles between them itself
    // (snapToOffsets), following the finger and the fling, so nothing is moved from code
    // mid-scroll (that fought the scroll and felt like a glitch); past the header the
    // feed scrolls freely (snapToEnd off).
    const stuckEdge = Math.max(1, stage - insets.top);
    const onLift = useAnimatedScrollHandler({
        onScroll: event => { lift.set(event.contentOffset.y); },
    });
    // The race stays put, like a map under its panel, and closes from the outside in as the page is lifted over it.
    const stuckAt = stuckEdge;
    const raceStyle = useAnimatedStyle(() => ({
        // The graph never moves; the iris (below) closes over it from the outside in,
        // and the last of it dims gently as the iris shuts.
        opacity: interpolate(lift.get(), [stuckAt * 0.35, stuckAt * 0.6], [1, 0], 'clamp'),
    }));
    const veilStyle = useAnimatedStyle(() => ({
        opacity: interpolate(lift.get(), [stuckAt * 0.35, stuckAt * 0.6], [0, 1], 'clamp'),
    }));
    // The page's title bar, once it reaches the status bar, stays there as the header: a fixed copy
    // takes over at exactly that spot (and steps out of the way, untappable, until then).
    const stickyStyle = useAnimatedStyle(() => {
        const stuck = lift.get() >= stuckAt;
        return { opacity: stuck ? 1 : 0, transform: [{ translateY: stuck ? 0 : -1000 }] };
    });
    // The buttons belong to the race: they fade exactly as the race does where they sit,
    // under the same iris (components/ui/IrisFade.tsx irisCoverAt) and the same dimming
    // (raceStyle), never on a clock of their own; then step out of the way so nothing
    // hidden can be tapped. Plain numbers here.
    // One step below the status bar, level with the race's heading rather than pressed against the top.
    const actionsTop = insets.top + t.space.sm;
    const actionsAt = useSharedValue({ x: screen.width - horizontalPadding - Control.hitTarget, y: actionsTop + Control.hitTarget / 2 });
    const irisFrom = t.space.xl;
    const irisTo = stuckAt * 0.6;
    const raceWidth = screen.width;
    const actionsStyle = useAnimatedStyle(() => {
        const y = lift.get();
        const dim = interpolate(y, [stuckAt * 0.35, stuckAt * 0.6], [1, 0], 'clamp');
        const at = actionsAt.get();
        const shown = (1 - irisCoverAt(y, irisFrom, irisTo, raceWidth, stage, true, at.x, at.y)) * dim;
        return { opacity: shown, transform: [{ translateY: shown > 0.05 ? 0 : -1000 }] };
    });
    // The faces on the race, where they are drawn: a tap on one opens that person.
    const [faceList, setFaceList] = useState<RaceFace[]>([]);
    const openRacer = useCallback((id: string, mine: boolean) => {
        lightFeedback();
        if (mine) router.push('/(root)/profile'); else router.push({ pathname: '/(root)/friend' as never, params: { id } });
    }, [lightFeedback, router]);
    const pick = useCallback((x: number, y: number) => {
        const hit = faceAt(faceList, x, y);
        if (hit) openRacer(hit.id, hit.me);
    }, [faceList, openRacer]);
    // Over the race: a drag sideways reads it day by day (up and down still moves the
    // page), and a tap on a face opens them. The race stays put while the page moves,
    // so a tap is placed on it by taking off how far the page has been lifted.
    const reader = useMemo(() => Gesture.Race(
        Gesture.Pan()
            .activeOffsetX([-8, 8]).failOffsetY([-12, 12])
            .onStart(event => { scrub.set(event.x); })
            .onUpdate(event => { scrub.set(event.x); })
            .onFinalize(() => { scrub.set(-1); }),
        Gesture.Tap().onEnd(event => { runOnJS(pick)(event.x, event.y - lift.get()); }),
    ), [scrub, lift, pick]);
    // Each page's height, so the one page is as tall as what it is showing.
    const [heights, setHeights] = useState<[number, number]>([0, 0]);
    const measure = (index: 0 | 1) => (event: LayoutChangeEvent) => {
        const next = Math.ceil(event.nativeEvent.layout.height);
        setHeights(prev => (prev[index] === next ? prev : (index === 0 ? [next, prev[1]] : [prev[0], next])));
    };
    const settle = (index: number) => {
        if (index === page) return;
        selectionFeedback();
        setPage(index);
        if (index === 1) setBetsNew(false);
    };
    const goTo = (index: number) => {
        pager.current?.scrollTo({ x: index * pageWidth, animated: true });
        settle(index);
    };
    // Near the end of the feed, the next days.
    const nearEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
        if (page === 0 && contentOffset.y + layoutMeasurement.height > contentSize.height - screen.height * 0.6) void loadMore();
    };

    const loadMore = async () => {
        if (loadingMore || endReached || posts.length === 0) return;
        setLoadingMore(true);
        const next = await FeedService.feed(posts[posts.length - 1].postedAt, PAGE);
        setPosts(prev => [...prev, ...next.filter(post => !prev.some(item => item.userId === post.userId && item.day === post.day))]);
        void FeedService.reactionsBy(next).then(by => setPosts(current => current.map(post => {
            const found = by[`day:${post.userId}:${post.day}`];
            return found ? { ...post, byUser: found } : post;
        }))).catch(() => undefined);
        setEndReached(next.length < PAGE);
        setLoadingMore(false);
    };

    const rail = useMemo<RailFriend[]>(() => statuses.map(row => ({
        userId: row.userId, name: row.name, avatarUrl: row.avatarUrl, status: statusOf(row, clock),
    })), [statuses, clock]);

    // Bets: new when a friend's goal is open and you have nothing on it yet.
    useFocusEffect(useCallback(() => {
        if (!MARKET_ENABLED || gate !== null) return;
        marketFeed().then(markets => setBetsNew(markets.some(market => market.status === 'open' && !market.mine && !market.myStake))).catch(() => undefined);
    }, [gate]));

    /** Names and faces for the people who acknowledged a post. */
    const people = useMemo(() => {
        const map = new Map(statuses.map(row => [row.userId, { name: row.name, avatarUrl: row.avatarUrl }]));
        if (me) map.set(me.id, { name: myProfile.name || me.name, avatarUrl: myProfile.avatar ?? undefined });
        return map;
    }, [statuses, me, myProfile.name, myProfile.avatar]);
    /** Each friend's status now, for the mark on their photo in the feed. */
    const statusById = useMemo(() => new Map(rail.map(friend => [friend.userId, friend.status])), [rail]);
    // The race, each friend wearing what they are doing now (focusing, live, asleep).
    const racersNow = useMemo(() => racers.map(racer => (racer.me ? racer : { ...racer, status: statusById.get(racer.id) })), [racers, statusById]);

    // A perfect day reacted to: confetti over the feed, once.
    const [cheer, setCheer] = useState(0);
    useEffect(() => {
        if (!cheer) return;
        const timer = setTimeout(() => setCheer(0), 2600);
        return () => clearTimeout(timer);
    }, [cheer]);
    // Today's accountability cards, each as the kind of day it was (lib/communityStream.ts).
    const stream = useMemo(() => buildStream(posts), [posts]);

    // Comments under those days: loaded with the feed, and again whenever anyone writes (live).
    const dayKeys = posts.map(post => threadKey(post.userId, post.day)).join(',');
    const loadComments = useCallback(() => {
        if (!posts.length) return;
        void loadThreads(posts.map(post => ({ toUser: post.userId, day: post.day }))).then(setComments).catch(() => undefined);
        // `dayKeys` stands for `posts`: the threads only change when the days do.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dayKeys]);
    useEffect(() => {
        loadComments();
        let pending: ReturnType<typeof setTimeout> | null = null;
        const stop = listenToComments(() => {
            if (pending) clearTimeout(pending);
            pending = setTimeout(() => { pending = null; loadComments(); }, 600);
        });
        return () => { stop(); if (pending) clearTimeout(pending); };
    }, [loadComments]);

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
                // Your face wears what you picked, at once.
                byUser: (() => {
                    const next = { ...(item.byUser ?? {}) };
                    if (me?.id) { if (to) next[me.id] = to; else delete next[me.id]; }
                    return next;
                })(),
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

    /** What every post needs from this page: names, faces, ranks, and what to do on a tap. */
    const streamContext: StreamContext = {
        meId: me?.id ?? null,
        myName: myProfile.name || me?.name || 'You',
        myAvatar: myProfile.avatar ?? undefined,
        rankOf: userId => ranks.get(userId) ?? null,
        statusOf: userId => statusById.get(userId),
        facesOf: ids => ids.flatMap(id => { const face = people.get(id); return face ? [{ ...face, id }] : []; }),
        onReact: (post, reaction) => void react(post, reaction),
        onReport: reportPost,
        commentsOf: key => comments[key] ?? [],
        onOpenComments: (post, write) => {
            selectionFeedback();
            setTalking({
                toUser: post.userId, day: post.day, name: post.mine ? 'You' : post.name, mine: post.mine, focus: !!write,
                done: post.card.habitsDone + post.card.tasksDone, total: post.card.habitsTotal + post.card.tasksTotal,
            });
        },
        openPerson: userId => (userId === me?.id ? router.push('/(root)/profile') : openFriend(userId)),
    };

    const answer = async (request: FriendRequest, accept: boolean) => {
        lightFeedback();
        setRequests(prev => prev.filter(item => item.id !== request.id));
        if (accept) await FriendsService.acceptFriendRequest(request.id);
        else await FriendsService.declineFriendRequest(request.id);
        void load();
    };

    const actions = (
        <View style={styles.headerActions}>
            {/* Your place among friends; the world board is inside. */}
            <Pressable onPress={() => { lightFeedback(); router.push('/(root)/leaderboard' as never); }}
                accessibilityRole="button" accessibilityLabel={rank ? `Leaderboard, you are number ${rank}` : 'Leaderboard'}>
                <MatteSurface radius={Radius.pill} level="control" elevation="floating" style={styles.rank}>
                    <AppIcon name="trophy" size={15} color={primary} />
                    <Text style={[styles.rankText, { color: colors.textPrimary }]}>{rank ? `#${rank}` : '—'}</Text>
                </MatteSurface>
            </Pressable>
            <IconButton icon={unread > 0 ? 'notifications' : 'notifications-outline'}
                label={unread > 0 ? `Inbox, ${unread} waiting` : 'Inbox'}
                onPress={() => { lightFeedback(); router.push('/(root)/inbox'); }} diameter={40} size={20} badge={unread} floating />
            <View ref={addFriendTarget} collapsable={false}>
                <IconButton icon="person-add" label="Add a friend" color={colors.textPrimary} onPress={() => { mediumFeedback(); setShowAddFriend(true); }} diameter={40} size={20} floating />
            </View>
        </View>
    );

    // The two pages, side by side in the one page: Today (the feed) and Challenges, swiped between.
    const PAGES = ['Accountability', 'Challenges'];
    const todayPage = (
        <View onLayout={measure(0)} style={{ width: pageWidth, paddingHorizontal: horizontalPadding }}>
            {requests.length > 0 ? (
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
            {/* Friends locked in right now: one tap to focus beside them. */}
            <FocusingNow style={styles.block} friends={statuses} now={clock.getTime()} joinedHost={joinedHost}
                onOpen={openFriend}
                onJoin={host => {
                    mediumFeedback();
                    router.push({ pathname: '/(root)/focus', params: { id: togetherId(host), kind: 'together' } });
                }} />
            {/* Today is accountability only: each friend's day. The games are on the next page. */}
            {stream.map((item, index) => {
                const day = item.post;
                return (
                    <ListItem key={item.key} index={index}>
                        {isSealed(day, today, shareTime, nowMinutes) ? (
                            <SealedDayCard key="sealed" name={day.name} avatarUrl={day.avatarUrl} opensAt={opensAt} />
                        ) : (
                            <Animated.View key="open" entering={flipping && !day.mine && day.day === today ? FlipInEasyY.duration(520).delay(index * 140).reduceMotion(ReduceMotion.System) : undefined}>
                                <StreamPostCard item={item} ctx={streamContext} />
                            </Animated.View>
                        )}
                    </ListItem>
                );
            })}
            {stream.length === 0 ? (
                <View style={styles.empty}>
                    <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                        {shareTime ? `Your day posts here at ${shareTime}. Your friends' days show up at the times they choose.` : "Your friends' days show up here at the times they choose."}
                    </Text>
                    <Pressable onPress={() => router.push('/(root)/sharing')} accessibilityRole="button">
                        <Text style={[styles.emptyLink, { color: primary }]}>{shareTime ? 'Change the time' : 'Turn on daily posts'}</Text>
                    </Pressable>
                </View>
            ) : null}
            {loadingMore ? <ActivityIndicator style={styles.more} color={colors.textTertiary} /> : null}
        </View>
    );
    const challengesPage = (
        <View onLayout={measure(1)} style={{ width: pageWidth, paddingHorizontal: horizontalPadding }}>
            {/* Races (yours and friends'), then challenges and bets on goals. New ones come from the +. */}
            <RaceSection style={styles.block} onShown={setRacesShown} />
            <ChallengeSection style={styles.block} onShown={setChallengesShown} />
            {racesShown === false && challengesShown === false ? (
                <EmptyState icon="flash-outline" title="Nothing running" message="Race the clock or pick a challenge from +" />
            ) : null}
            {MARKET_ENABLED ? <MarketSection style={styles.block} /> : null}
        </View>
    );
    // The page is as tall as the side showing (the other is clipped while you swipe).
    const pageHeight = heights[page] || undefined;

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

    if (gate !== null) {
        return (
            <VoidShell>
                <ScrollView contentContainerStyle={{ paddingTop: topSpacing + 36, paddingHorizontal: horizontalPadding, paddingBottom: tabBarClearance }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textTertiary} progressViewOffset={topSpacing} />}>
                    <Text style={[styles.headerTitle, styles.header, { color: colors.textPrimary }]}>Community</Text>
                    <FriendsGate needsUsername={gate === 'needs_username'} onReady={() => { void load(); }} />
                </ScrollView>
            </VoidShell>
        );
    }

    return (
        <VoidShell>
            {/* The race is the background: it fills the top, and steps back as the page slides over it. */}
            {/* As the race dims, the page colour covers the shell's accent wash too: no lighter band left at the top. */}
            <Animated.View pointerEvents="none" style={[styles.veil, { height: stage, backgroundColor: colors.background }, veilStyle]} />
            <Animated.View style={[styles.race, raceStyle]}>
                <MarksRace racers={racersNow} onFaces={setFaceList} width={screen.width} height={stage} top={insets.top + t.space.sm} scrub={scrub} replay={racers.length > 0} />
                {/* Closing from the outside in as the page rises: shut before the page is halfway up. */}
                <IrisFade progress={lift} from={t.space.xl} to={stuckAt * 0.6} width={screen.width} height={stage} color={colors.background} follow />
            </Animated.View>
            <Animated.ScrollView ref={sheetScroll} showsVerticalScrollIndicator={false} onScroll={onLift} scrollEventThrottle={16}
                // A window: it rests in the middle (over the race) or full, settled by iOS (see stuckEdge);
                // pulled down from the middle it stays there, never dragged further down (no bounce, so no
                // pull to refresh: the feed reloads each time Community opens). Past the header the feed scrolls freely.
                snapToOffsets={[0, stuckEdge]} snapToEnd={false} bounces={false} overScrollMode="never"
                onScrollEndDrag={nearEnd} onMomentumScrollEnd={nearEnd}>
                {/* Over the race: a drag sideways reads it, day by day. */}
                <GestureDetector gesture={reader}>
                    <View style={{ height: stage }}
                        accessible={faceList.length > 0} accessibilityLabel="Friends on the race" accessibilityHint="Swipe up or down to choose whose profile to open"
                        accessibilityActions={racersNow.filter(racer => faceList.some(face => face.id === racer.id)).map(racer => ({
                            name: racer.id, label: racer.me ? 'Your profile' : `${racer.name}, ${racer.status ? STATUS_LABEL[racer.status] : ''}`,
                        }))}
                        onAccessibilityAction={event => {
                            const face = faceList.find(item => item.id === event.nativeEvent.actionName);
                            if (face) openRacer(face.id, face.me);
                        }} />
                </GestureDetector>
                {/* The same page continuing: the race falls into it, no edge, no grabber; the title is a section heading. */}
                <LinearGradient pointerEvents="none" colors={['transparent', colors.background]} style={styles.blend} />
                <View style={[styles.sheetTop, { backgroundColor: colors.background, paddingHorizontal: horizontalPadding }]}>
                    <SectionTitle first right={<PageDots progress={pagePosition} current={page} labels={PAGES} fresh={[false, betsNew]} onPick={goTo} />}>{PAGES[page]}</SectionTitle>
                </View>
                <View style={{ backgroundColor: colors.background, minHeight: screen.height - insets.top, paddingBottom: tabBarClearance }}>
                    {/* The pages, as a gesture the day packs can hold off (a sideways swipe on a card turns cards). */}
                    <PagerGesture.Provider value={pagerGesture}>
                    <GestureDetector gesture={pagerGesture}>
                    <Animated.ScrollView ref={pager} horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ height: pageHeight }}
                        onScroll={onPager} scrollEventThrottle={16} onMomentumScrollEnd={event => settle(Math.round(event.nativeEvent.contentOffset.x / pageWidth))}>
                        <View style={styles.pages}>
                            {todayPage}
                            {challengesPage}
                        </View>
                    </Animated.ScrollView>
                    </GestureDetector>
                    </PagerGesture.Provider>
                </View>
            </Animated.ScrollView>
            {/* The title bar, stuck under the status bar once the page reaches it: Accountability or Challenges, and the dots. */}
            <Animated.View style={[styles.sticky, { paddingTop: insets.top, backgroundColor: colors.background }, stickyStyle]}>
                {/* No line and no shadow under it: the cards pass beneath a heading of the same colour. */}
                <View style={[styles.sheetTop, { paddingHorizontal: horizontalPadding }]}>
                    <SectionTitle first right={<PageDots progress={pagePosition} current={page} labels={PAGES} fresh={[false, betsNew]} onPick={goTo} />}>{PAGES[page]}</SectionTitle>
                </View>
            </Animated.View>
            {/* On the race's level, whole; they fade as the page rises to them (actionsStyle). */}
            <Animated.View style={[styles.actions, { top: actionsTop, right: horizontalPadding }, actionsStyle]}
                onLayout={event => { const { x, y, width, height } = event.nativeEvent.layout; actionsAt.set({ x: x + width / 2, y: y + height / 2 }); }}>
                {actions}
            </Animated.View>

            {cheer ? (
                <Overlay>
                    <View pointerEvents="none" style={styles.cheer}><Confetti key={cheer} colors={[primary, colors.success, colors.warning, colors.textPrimary]} /></View>
                </Overlay>
            ) : null}
            <CommentSheet target={talking} onClose={() => setTalking(null)} onChanged={loadComments} />
            <AddFriendModal visible={showAddFriend} onClose={() => setShowAddFriend(false)} userCode={userCode} onFriendAdded={() => { void load(); }} />
        </VoidShell>
    );
}
