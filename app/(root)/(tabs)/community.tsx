import { FontFamily, Typography, UIStyles } from '@/theme/designSystem';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, Share, ActivityIndicator } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Colors } from '@/theme/colors';
import { vs } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidShell } from '@/components/ui/VoidShell';
import { VoidCard } from '@/components/ui/VoidCard';
import { useAccentGradient } from '@/context/AccentContext';
import { FriendsService, Friend, FriendRequest, ReactionType, type DayComment, friendTasksToday, getMyUsername, inviteMessage } from '@/lib/friendsService';
import { onAccountChange } from '@/lib/account';
import { FriendsGate } from '@/components/Community/FriendsGate';
import { FriendStatsModal } from '@/components/Community/FriendStatsModal';
import { AddFriendModal } from '@/components/Community/AddFriendModal';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from '@/lib/habitSchedule';
import { DayCard } from '@/components/Community/DayCard';
import { Pulse } from '@/components/Community/Pulse';
import { addNote, getNotes, mergeNotes, pendingNotes, removeNote, type DayNote } from '@/lib/dayNotes';
import { buildFeed, pulseOrder, summarise } from '@/lib/feed';
import { MarksBoard, type MarksPerson } from '@/components/Community/MarksBoard';
import { evidenceListToday } from '@/lib/evidence';
import type { Evidence } from '@/lib/proof';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { on } from '@/lib/appEvents';
import { styles } from '@/styles/screens/tabs/community.styles';

/** Reactions are a thing about today, so they are stored under today. */
const reactionsKey = () => `feed_reactions_${localDateKey(new Date())}`;

/** A server comment as the card draws it. One shape, whichever side it came from. */
const asNote = (comment: DayComment): DayNote => ({
    id: comment.id, cardId: comment.toUser, date: comment.day, text: comment.body,
    at: Date.parse(comment.createdAt) || 0, mine: comment.mine, authorName: comment.authorName,
});

export default function CommunityScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { primary: accentColor } = useAccentGradient();
    const { thud, lightFeedback, mediumFeedback, selectionFeedback } = useHaptics();
    const router = useRouter();
    const { horizontalPadding, topSpacing, tabBarClearance, isCompactWidth } = useResponsiveLayout();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const hasLoadedOnce = useRef(false);

    // State
    const [friends, setFriends] = useState<Friend[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Friend[]>([]);
    const [searching, setSearching] = useState(false);

    const [sentReactions, setSentReactions] = useState<Record<string, ReactionType>>({});
    const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
    const [showFriendStats, setShowFriendStats] = useState(false);
    const [showAddFriendModal, setShowAddFriendModal] = useState(false);
    const [userCode, setUserCode] = useState('');
    const [unread, setUnread] = useState(0);
    // Friends need an account and a username; until then the tab says so.
    const [gate, setGate] = useState<'signed_out' | 'needs_username' | null>(null);

    const isLoadingRef = useRef(false);
    const refreshQueued = useRef(false);


    const loadData = useCallback(async (forceRefresh = false) => {
        // Skip if already loaded and not forcing refresh
        if (!forceRefresh && hasLoadedOnce.current) {
            return;
        }

        // Prevent concurrent loads that cause flickering
        if (isLoadingRef.current) { if (forceRefresh) refreshQueued.current = true; return; }
        isLoadingRef.current = true;

        // Only show full-page loader on initial load
        if (!hasLoadedOnce.current) {
            setLoading(true);
        }

        try {
            if (!(await FriendsService.isAvailable())) {
                setGate('signed_out');
                setFriends([]);
                setFriendRequests([]);
                hasLoadedOnce.current = true;
                return;
            }
            const username = await getMyUsername();
            setUserCode(username ?? '');
            FriendsService.unreadCount().then(setUnread).catch(() => undefined);
            setGate(username ? null : 'needs_username');

            await FriendsService.repairFriendshipsFromAcceptedRequests();
            // Which habits and tasks are shared, so ticking one tells the
            // people on it without a network call on every ordinary tick.
            void FriendsService.refreshSharedIds().catch(() => undefined);

            const [friendsList, requests] = await Promise.all([
                FriendsService.getFriendsWithProgress(),
                FriendsService.getFriendRequests(),
            ]);
            setFriends(friendsList);
            setFriendRequests(requests);
            // Your own published total, beside theirs.
            // This phone's own count wins: it is always current, and it is
            // there even before the server has a total to hand back.
            void FriendsService.getCurrentUser().then(async me => {
                if (!me) return;
                const { localMarks } = require('@/lib/marksSync') as typeof import('@/lib/marksSync');
                const local = await localMarks();
                const total = local ?? (await FriendsService.marksFor([])).get(me.id);
                if (typeof total === 'number') setMyMarks({ id: me.id, marks: total, avatarUrl: me.avatarUrl });
            }).catch(() => undefined);

            hasLoadedOnce.current = true;
        } catch (error) {
            console.error('Error loading community data:', error);
        } finally {
            setLoading(false);
            isLoadingRef.current = false;
            if (refreshQueued.current) { refreshQueued.current = false; void loadData(true); }
        }
    }, []);

    // Only load data once on initial mount
    useEffect(() => {
        if (!hasLoadedOnce.current) {
            loadData();
        }
    }, []);

    useEffect(() => {
        const subscription = on('social_state_updated', () => {
            loadData(true);
        });
        const stopWatchingAccount = onAccountChange(() => loadData(true));

        return () => {
            subscription.remove();
            stopWatchingAccount();
        };
    }, [loadData]);

    const onRefresh = async () => {
        thud();
        setRefreshing(true);
        await loadData(true); // Force refresh bypasses cache
        setRefreshing(false);
    };

    const handleSearch = async (query: string) => {
        setSearchQuery(query);
        if (query.length >= 1) { // Changed from 3 to 1 - search immediately
            setSearching(true);
            const results = await FriendsService.searchUsers(query);
            setSearchResults(results);
            setSearching(false);
        } else {
            setSearchResults([]);
        }
    };

    const handleSendRequest = async (userId: string) => {
        lightFeedback();
        const success = await FriendsService.sendFriendRequest(userId);
        if (success) {
            Alert.alert('Success! 🎉', 'Friend request sent (or auto-accepted if they already requested you)!');
            setSearchResults(prev => prev.filter(u => u.id !== userId));
            setSearchQuery('');
            await loadData(true); // Refresh to show new friend if auto-accepted
        } else {
            Alert.alert('Already Connected', 'You may already be friends or have a pending request with this user.');
        }
    };

    const handleAcceptRequest = async (requestId: string) => {
        lightFeedback();
        const success = await FriendsService.acceptFriendRequest(requestId);
        if (success) {
            await loadData(true);
        }
    };

    const handleDeclineRequest = async (requestId: string) => {
        lightFeedback();
        await FriendsService.declineFriendRequest(requestId);
        setFriendRequests(prev => prev.filter(r => r.id !== requestId));
    };

    const handleNudge = async (friend: Friend) => {
        mediumFeedback();
        if (await FriendsService.nudgedToday(friend.id)) {
            Alert.alert('Already nudged today', 'Try again tomorrow.');
            return;
        }
        const success = await FriendsService.nudgeFriend(friend.id, friend.displayName ?? friend.username);
        if (success) {
            Alert.alert('Nudged! 👋', `${friend.displayName ?? friend.username} has been notified.`);
        }
    };

    // Animation for 1st place crown

    const getRankIcon = (rank: number) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };




    /**
     * Reacting to someone's day.
     *
     * Tapping the same one again takes it back, because a reaction you cannot
     * withdraw is a reaction people hesitate to give. It now reaches the person
     * — `feed_reactions` holds one per pair per day, so a second reaction
     * replaces the first — and it is still written to the device as well, so the
     * feed does not lose its answer while the insert is in flight.
     */
    const handleReaction = async (friendId: string, reaction: ReactionType) => {
        mediumFeedback();
        const taken = sentReactions[friendId] === reaction;
        const next = { ...sentReactions };
        if (taken) delete next[friendId]; else next[friendId] = reaction;
        setSentReactions(next);
        void AsyncStorage.setItem(reactionsKey(), JSON.stringify(next)).catch(() => undefined);
        if (taken) await FriendsService.clearDayReaction(friendId);
        else await FriendsService.reactToDay(friendId, reaction);
    };

    /**
     * Saying something about someone's day.
     *
     * Sent to `feed_comments`, and kept on the device when it cannot be: signed
     * out, or the insert failed. A note kept that way is marked pending and goes
     * on the next visit, so nothing typed is lost to a dropped connection.
     */
    const handleComment = async (cardId: string, text: string) => {
        const day = localDateKey(new Date());
        const sent = await FriendsService.addDayComment(cardId, text);
        if (sent) {
            selectionFeedback();
            setNotes(current => ({ ...current, [cardId]: [...(current[cardId] ?? []), asNote(sent)] }));
            return;
        }
        const note = await addNote(day, cardId, text);
        if (!note) return;
        selectionFeedback();
        setNotes(current => ({ ...current, [cardId]: [...(current[cardId] ?? []), note] }));
    };

    const handleDeleteNote = async (cardId: string, id: string) => {
        lightFeedback();
        setNotes(current => ({ ...current, [cardId]: (current[cardId] ?? []).filter(note => note.id !== id) }));
        // One of the two holds it; asking both is cheaper than remembering which.
        await Promise.all([
            FriendsService.deleteDayComment(id),
            removeNote(localDateKey(new Date()), cardId, id),
        ]);
    };

    const getTimeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return 'Today';
    };

    // One card per person, you included, ordered by what was done rather than
    // by who anyone is.
    // Your own evidence is known exactly — the app has your Health habits and
    // your timer sessions. A friend's arrives with the feed migration; until
    // then theirs reads as logged, which is the truthful default.
    const [notes, setNotes] = useState<Record<string, DayNote[]>>({});
    /** What each friend and I are doing together today, by their id. */
    const [together, setTogether] = useState<Record<string, { id: string; name: string; mineDone: boolean; theirsDone: boolean }[]>>({});
    const [myEvidence, setMyEvidence] = useState<Record<string, Evidence[]>>({});
    /**
     * Today's short list for everybody in the feed, keyed by user id.
     *
     * One call for all of them rather than one per card: a dozen friends would
     * be a dozen requests arriving separately, and a dozen re-renders while
     * somebody is trying to scroll.
     */
    const [todayTasks, setTodayTasks] = useState<Record<string, { id: string; title: string; done: boolean; dueTime?: string }[]>>({});
    useEffect(() => {
        if (friends.length === 0) return;
        let alive = true;
        friendTasksToday()
            .then(found => { if (alive) setTodayTasks(found); })
            .catch(() => undefined);
        return () => { alive = false; };
    }, [friends]);
    useEffect(() => {
        const me = friends.find(friend => friend.isCurrentUser);
        if (!me) return;
        let alive = true;
        (async () => {
            const { getHabits, getCompletions } = require('@/lib/habitsSQLite') as typeof import('@/lib/habitsSQLite');
            const day = localDateKey(new Date());
            const [habits, completions] = await Promise.all([getHabits(), getCompletions(day)]);
            const doneIds = Object.keys(completions).filter(id => completions[id]);
            const list = await evidenceListToday(habits, doneIds, day);
            if (alive) setMyEvidence({ [me.userId]: list });
        })().catch(() => undefined);
        return () => { alive = false; };
    }, [friends]);

    const dayFeed = useMemo(() => buildFeed(friends, myEvidence), [friends, myEvidence]);
    const [myMarks, setMyMarks] = useState<{ id: string; marks: number; avatarUrl?: string } | null>(null);
    const marksPeople = useMemo<MarksPerson[]>(() => [
        ...(myMarks ? [{ id: myMarks.id, name: 'You', marks: myMarks.marks, avatarUrl: myMarks.avatarUrl, isYou: true }] : []),
        // A friend whose phone has not published a total yet starts at zero.
        ...friends.map(friend => ({
            id: friend.id, name: friend.displayName || friend.username, avatarUrl: friend.avatarUrl, marks: friend.marks ?? 0,
        })),
    ], [friends, myMarks]);
    const marksById = useMemo(() => new Map(marksPeople.map(person => [person.id, person.marks])), [marksPeople]);

    /**
     * The rail along the top, and the one line above the feed.
     *
     * Ordered by who needs you rather than by who is doing best: somebody
     * waiting on your half of a shared habit is the only fact on this screen
     * you can act on, and sorting by achievement would bury them behind
     * whoever tracks the most undemanding things. You are always last — a rail
     * of faces is a list of other people.
     */
    const pulse = useMemo(() => pulseOrder(dayFeed, together), [dayFeed, together]);

    const waiting = pulse.filter(person => person.waitingOnYou).length;

    /**
     * Where each card sits, so a tap on the rail can go to it.
     *
     * Measured rather than calculated: a card grows a composer, a notes list
     * and a shared-items section, so its height is not something this screen
     * can know in advance.
     */
    const cardTops = useRef<Record<string, number>>({});
    /**
     * Where the feed itself starts.
     *
     * `onLayout` reports a position inside the parent, not inside the scroll
     * content, so a card's own `y` is measured from the top of the feed — and
     * scrolling to it without this would land short by the height of the
     * header, the requests and the rail above it.
     */
    const feedTop = useRef(0);
    const scroller = useRef<ScrollView>(null);
    const goToCard = useCallback((id: string) => {
        const y = cardTops.current[id];
        if (y === undefined) return;
        // A little above it, so the card does not sit flush against the header.
        scroller.current?.scrollTo({ y: Math.max(0, feedTop.current + y - vs(12)), animated: true });
    }, []);

    /**
     * The named part of each friend's day.
     *
     * Only for people who are actually friends, and only for what has been
     * shared between the two of you — a count can be derived from numbers the
     * server already returns, but a name has to be something they chose to
     * show you.
     */
    useEffect(() => {
        const others = friends.filter(friend => !friend.isCurrentUser);
        if (others.length === 0) { setTogether({}); return; }
        let alive = true;
        Promise.all(others.map(async friend => {
            const items = await FriendsService.sharedWithFriend(friend.userId).catch(() => []);
            return [friend.id || friend.userId, items] as const;
        }))
            .then(pairs => { if (alive) setTogether(Object.fromEntries(pairs.filter(([, items]) => items.length))); })
            .catch(() => undefined);
        return () => { alive = false; };
    }, [friends]);

    /**
     * What has already been said today, from the server and from this device.
     *
     * Anything still pending here is sent first, so a note written offline
     * arrives before the card is drawn and is then held in one place rather
     * than two. The server's rows are the truth; `mergeNotes` puts whatever has
     * not reached it after them.
     */
    useEffect(() => {
        const day = localDateKey(new Date());
        (async () => {
            const [stored, waiting] = await Promise.all([
                AsyncStorage.getItem(reactionsKey()).catch(() => null),
                pendingNotes(day).catch(() => []),
            ]);
            if (stored) { try { setSentReactions(JSON.parse(stored)); } catch { /* keep none */ } }

            for (const note of waiting) {
                if (await FriendsService.addDayComment(note.cardId, note.text, day)) {
                    await removeNote(day, note.cardId, note.id);
                }
            }

            const [fromServer, local, reactions] = await Promise.all([
                FriendsService.getDayComments(day),
                getNotes(day),
                FriendsService.getDayReactions(day),
            ]);
            const cards = new Set([...Object.keys(fromServer), ...Object.keys(local)]);
            const merged: Record<string, DayNote[]> = {};
            for (const cardId of cards) {
                merged[cardId] = mergeNotes((fromServer[cardId] ?? []).map(asNote), local[cardId]);
            }
            setNotes(merged);
            // The server knows what was sent from any device; the local copy is
            // only a guess made while an insert was in flight.
            if (Object.keys(reactions.mine).length) setSentReactions(reactions.mine);
        })().catch(() => undefined);
    }, []);

    const handleFriendPress = (friend: Friend) => {
        // Allow viewing own profile too - shows what friends see
        lightFeedback();
        setSelectedFriend(friend);
        setShowFriendStats(true);
    };

    const handleShareCode = async () => {
        try {
            lightFeedback();
            await Share.share({
                message: inviteMessage(userCode),
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <VoidShell>
            {/* Full-Page Loading Overlay (Initial Load Only) */}
            {loading && !refreshing && !hasLoadedOnce.current && (
                <Animated.View
                    exiting={require('react-native-reanimated').FadeOut.duration(300)}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: colors.background,
                        zIndex: 100,
                    }}
                >
                    {/* An ordinary spinner. A logo turning over is a brand
                        animation, and waiting is not the moment for one. */}
                    <ActivityIndicator size="large" color={accentColor} />
                    <Text style={{ color: colors.textSecondary, marginTop: vs(16), fontFamily: FontFamily.regular }}>Loading your people…</Text>
                </Animated.View>
            )}

            <ScrollView
                ref={scroller}
                contentContainerStyle={{ paddingTop: topSpacing + vs(36), paddingHorizontal: horizontalPadding, paddingBottom: tabBarClearance }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={'transparent'}
                        progressBackgroundColor={'transparent'}
                        style={{ backgroundColor: 'transparent' }}
                    />
                }
            >
                {refreshing && (
                    <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                        <ActivityIndicator color={colors.textTertiary} />
                    </View>
                )}
                {/* Header */}
                <View style={{ marginBottom: isCompactWidth ? 20 : 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Community</Text>
                    </View>
                    {!gate && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>

                        {/* Where a friend request waits. Without somewhere to
                            put it, being asked was invisible unless you came
                            here and scrolled past the feed. */}
                        <IconButton icon={unread > 0 ? 'notifications' : 'notifications-outline'}
                            label={unread > 0 ? `Inbox, ${unread} waiting` : 'Inbox'}
                            onPress={() => { lightFeedback(); router.push('/(root)/inbox'); }}
                            diameter={40} size={20} badge={unread} />

                        <IconButton icon="person-add" label="Add a friend" onPress={() => {
                                mediumFeedback();
                                setShowAddFriendModal(true);
                            }} diameter={40} size={20} />
                    </View>}
                </View>

                {gate ? (
                    <FriendsGate needsUsername={gate === 'needs_username'} onReady={() => loadData(true)} />
                ) : (<>
                {/* Friend Requests */}
                {friendRequests.length > 0 && (
                    <View style={{ marginBottom: 24 }}>
                        <SectionTitle first>Friend requests</SectionTitle>
                        <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[{ padding: 16 }]}>
                            {friendRequests.map(request => (
                                <View key={request.id} style={styles.requestRow}>
                                    <View style={[styles.avatar, { backgroundColor: colors.surfaceTertiary }]}>
                                        <Text style={{ fontSize: 16 }}>{(request.fromName ?? request.fromUsername)[0]?.toUpperCase()}</Text>
                                    </View>
                                    <Text style={[styles.username, { color: colors.textPrimary, flex: 1, marginLeft: 12 }]}>
                                        {request.fromName ?? request.fromUsername}
                                    </Text>
                                    <IconButton icon="checkmark" label="Accept request" onPress={() => handleAcceptRequest(request.id)} diameter={34} size={18} color={colors.success} />
                                    <IconButton icon="close" label="Decline request" onPress={() => handleDeclineRequest(request.id)} diameter={34} size={18} color={colors.error} style={{ marginLeft: 8 }} />
                                </View>
                            ))}
                        </VoidCard>
                    </View>
                )}

                {/* The day, as everyone finished it. This replaced a ranked
                    table: a leaderboard answers "who is winning", which rewards
                    whoever tracks the least demanding things and makes a bad
                    week public. */}
                <View
                    style={styles.feed}
                    onLayout={event => { feedTop.current = event.nativeEvent.layout.y; }}
                >
                    {/* Everybody at once, before the feed shows anybody in
                        detail. Tapping a face takes you to their card. */}
                    <Pulse people={pulse} onPick={goToCard} />

                    {/* Everybody's Marks: something to keep up with. */}
                    <MarksBoard people={marksPeople} onPick={goToCard} />

                    <View style={styles.feedHead}>
                        <SectionTitle first style={styles.feedTitle}>Today</SectionTitle>
                        {/* The line says what you can do about it when there is
                            something, and how the group is going when there is
                            not. Never who is winning. */}
                        <Text style={[styles.feedSummary, { color: waiting > 0 ? accentColor : colors.textTertiary }]}>
                            {waiting > 0
                                ? (waiting === 1 ? '1 person is waiting on you' : `${waiting} people are waiting on you`)
                                : summarise(dayFeed)}
                        </Text>
                    </View>
                    {dayFeed.map(card => (
                        <View
                            key={card.id}
                            onLayout={event => { cardTops.current[card.id] = event.nativeEvent.layout.y; }}
                        >
                            <DayCard
                                card={card}
                                reaction={sentReactions[card.id]}
                                onReact={value => void handleReaction(card.id, value)}
                                onOpen={() => {
                                    const found = friends.find(item => (item.id || item.userId) === card.id);
                                    if (found) handleFriendPress(found);
                                }}
                                together={together[card.id]}
                                tasks={todayTasks[card.id]}
                                notes={notes[card.id]}
                                onComment={text => void handleComment(card.id, text)}
                                onDeleteNote={id => void handleDeleteNote(card.id, id)}
                                marks={marksById.get(card.id)}
                            />
                        </View>
                    ))}
                </View>

                </>)}
            </ScrollView>

            {/* Friend Stats Modal */}
            <FriendStatsModal
                visible={showFriendStats}
                friend={selectedFriend}
                onClose={() => setShowFriendStats(false)}
                onNudge={handleNudge}
                // Their card has to go straight away, not at the next refresh.
                onBlocked={() => { void loadData(true); }}
            />


            {/* Add Friend Modal */}
            <AddFriendModal
                visible={showAddFriendModal}
                onClose={() => setShowAddFriendModal(false)}
                userCode={userCode}
                onFriendAdded={() => loadData(true)}
            />
        </VoidShell>
    );
}
