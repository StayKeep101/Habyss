import { FontFamily, Typography, UIStyles } from '@/constants/DesignSystem';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity, Alert, Share, ActivityIndicator} from 'react-native';
import { Colors } from '@/constants/Colors';
import { vs } from '@/constants/Layout';
import { useTheme } from '@/constants/themeContext';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useAccentGradient } from '@/constants/AccentContext';
import { FriendsService, Friend, FriendRequest, ReactionType, type DayComment, getMyUsername, inviteMessage } from '@/lib/friendsService';
import { onAccountChange } from '@/lib/account';
import { FriendsGate } from '@/components/Community/FriendsGate';
import { FriendStatsModal } from '@/components/FriendStatsModal';
import { AddFriendModal } from '@/components/Community/AddFriendModal';
import { useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from '@/lib/habitSchedule';
import { DayCard } from '@/components/Community/DayCard';
import { addNote, getNotes, mergeNotes, pendingNotes, removeNote, type DayNote } from '@/lib/dayNotes';
import { PactCard } from '@/components/Community/PactCard';
import { MakePactSheet } from '@/components/Community/MakePactSheet';
import { Embers } from '@/lib/embers';
import { formatEmbers } from '@/lib/ember';
import { isOver, type Pact } from '@/lib/pact';
import { buildFeed, summarise } from '@/lib/feed';
import { evidenceListToday } from '@/lib/evidence';
import type { Evidence } from '@/lib/proof';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { on } from '@/lib/appEvents';

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
    const { thud, lightFeedback, mediumFeedback, selectionFeedback, successFeedback } = useHaptics();
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
    const [balance, setBalance] = useState(0);
    const [pacts, setPacts] = useState<Pact[]>([]);
    const [pactBusy, setPactBusy] = useState<string | null>(null);
    const [showMakePact, setShowMakePact] = useState(false);
    // Friends need an account and a username; until then the tab says so.
    const [gate, setGate] = useState<'signed_out' | 'needs_username' | null>(null);

    const isLoadingRef = useRef(false);
    const refreshQueued = useRef(false);

    /**
     * The embers, and everything that has to happen before they can be counted.
     *
     * In this order on purpose: settle what is due, claim what today was worth,
     * then read the balance. Doing it the other way round shows a number that
     * is right for a moment that has already passed.
     */
    const loadEmbers = useCallback(async () => {
        try {
            await Embers.claimOpening();
            await Embers.settleDue();
            const day = localDateKey(new Date());
            const { getHabits, getCompletions } = require('@/lib/habitsSQLite') as typeof import('@/lib/habitsSQLite');
            const [habits, completions] = await Promise.all([getHabits(), getCompletions(day)]);
            const doneIds = Object.keys(completions).filter(id => completions[id]);
            const list = await evidenceListToday(habits, doneIds, day);
            await Embers.claimDay(day, list.map(evidence => ({ evidence })));
            const [found, mine] = await Promise.all([Embers.balance(), Embers.list()]);
            setBalance(found);
            setPacts(mine);
        } catch {
            // Embers are the least important thing on this screen; a tab that
            // failed to load because of them would be a poor trade.
        }
    }, []);

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
            // Anything whose day has gone is paid out before the balance is
            // read, so the number on screen is never one settlement behind.
            void loadEmbers();
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
        const success = await FriendsService.nudgeFriend(friend.id, friend.username);
        if (success) {
            Alert.alert('Nudged! 👋', `${friend.username} has been notified.`);
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
     * What is worth showing: anything still in play, and anything that settled
     * today — the outcome is the most interesting thing a pact ever says, and
     * hiding it the moment it happens wastes it.
     */
    const live = useMemo(() => {
        const today = localDateKey(new Date());
        return pacts.filter(pact =>
            pact.status === 'offered'
            || pact.status === 'live'
            || (pact.status === 'settled' && !isOver({ deadline: pact.deadline }, today)));
    }, [pacts]);

    const answerPact = async (pact: Pact, accept: boolean) => {
        if (pactBusy) return;
        setPactBusy(pact.id);
        const result = accept ? await Embers.accept(pact.id) : (await Embers.cancel(pact.id) ? 'cancelled' : 'gone');
        setPactBusy(null);

        if (result === 'short') { Alert.alert('Not enough embers', `You need ${pact.mine.stake} to take this on.`); return; }
        if (result === 'they_are_short') { Alert.alert('They cannot cover it', 'Their balance has dropped since they offered.'); return; }
        if (accept) successFeedback(); else lightFeedback();
        await loadEmbers();
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
    const [myEvidence, setMyEvidence] = useState<Record<string, Evidence[]>>({});
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
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>COMMUNITY</Text>
                        <Text style={[styles.headerSubtitle, { color: accentColor }]}>CREW STATUS</Text>
                    </View>
                    {!gate && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {/* What you have to put on the line. Beside the bell
                            rather than in a card of its own: it is a fact about
                            you, not a section of the page. */}
                        <View style={{
                            flexDirection: 'row', alignItems: 'center', gap: 5,
                            height: 40, paddingHorizontal: 12, borderRadius: 20,
                            backgroundColor: colors.surfaceSecondary,
                            borderWidth: 1, borderColor: colors.border,
                        }}>
                            <Ionicons name="flame" size={14} color="#FF9D23" />
                            <Text style={{ color: colors.textPrimary, fontSize: 13, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] }}>
                                {formatEmbers(balance)}
                            </Text>
                        </View>

                        {/* Where a friend request waits. Without somewhere to
                            put it, being asked was invisible unless you came
                            here and scrolled past the feed. */}
                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel={unread > 0 ? `Inbox, ${unread} waiting` : 'Inbox'}
                            onPress={() => { lightFeedback(); router.push('/(root)/inbox'); }}
                            style={{
                                width: 40, height: 40, borderRadius: 20,
                                backgroundColor: colors.surfaceSecondary,
                                alignItems: 'center', justifyContent: 'center',
                                borderWidth: 1, borderColor: colors.border,
                            }}
                        >
                            <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={20} color={unread > 0 ? accentColor : colors.textSecondary} />
                            {unread > 0 ? (
                                <View style={{
                                    position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8,
                                    paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: colors.error, borderWidth: 2, borderColor: colors.background,
                                }}>
                                    <Text style={{ color: '#fff', fontSize: 9, fontFamily: FontFamily.bold }}>
                                        {unread > 9 ? '9+' : unread}
                                    </Text>
                                </View>
                            ) : null}
                        </TouchableOpacity>

                        <TouchableOpacity
                            accessibilityRole="button"
                            accessibilityLabel="Add a friend"
                            onPress={() => {
                                mediumFeedback();
                                setShowAddFriendModal(true);
                            }}
                            style={{
                                width: 40, height: 40, borderRadius: 20,
                                backgroundColor: colors.surfaceSecondary,
                                alignItems: 'center', justifyContent: 'center',
                                borderWidth: 1, borderColor: colors.border
                            }}
                        >
                            <Ionicons name="person-add" size={20} color={accentColor} />
                        </TouchableOpacity>
                    </View>}
                </View>

                {gate ? (
                    <FriendsGate needsUsername={gate === 'needs_username'} onReady={() => loadData(true)} />
                ) : (<>
                {/* Friend Requests */}
                {friendRequests.length > 0 && (
                    <View style={{ marginBottom: 24 }}>
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PENDING REQUESTS</Text>
                        <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[{ padding: 16 }, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                            {friendRequests.map(request => (
                                <View key={request.id} style={styles.requestRow}>
                                    <View style={[styles.avatar, { backgroundColor: colors.surfaceTertiary }]}>
                                        <Text style={{ fontSize: 16 }}>{request.fromUsername[0]?.toUpperCase()}</Text>
                                    </View>
                                    <Text style={[styles.username, { color: colors.textPrimary, flex: 1, marginLeft: 12 }]}>
                                        {request.fromUsername}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => handleAcceptRequest(request.id)}
                                        style={[styles.actionBtn, { backgroundColor: colors.success }]}
                                    >
                                        <Ionicons name="checkmark" size={18} color="#fff" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleDeclineRequest(request.id)}
                                        style={[styles.actionBtn, { backgroundColor: colors.error, marginLeft: 8 }]}
                                    >
                                        <Ionicons name="close" size={18} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </VoidCard>
                    </View>
                )}

                {/* Pacts, before the feed. What somebody is waiting on you for
                    outranks what they happened to do this morning. */}
                <View style={styles.feed}>
                    <View style={styles.feedHead}>
                        <Text style={[styles.feedTitle, { color: colors.textPrimary }]}>PACTS</Text>
                        <TouchableOpacity
                            accessibilityRole="button" accessibilityLabel="Make a pact"
                            onPress={() => { mediumFeedback(); setShowMakePact(true); }}
                        >
                            <Text style={[styles.feedSummary, { color: accentColor, fontFamily: FontFamily.semibold }]}>Make one</Text>
                        </TouchableOpacity>
                    </View>

                    {live.length === 0 ? (
                        <VoidCard matte style={{ padding: 16, gap: 6 }}>
                            <Text style={{ color: colors.textPrimary, fontSize: 14, fontFamily: FontFamily.semibold }}>
                                Nothing on the line
                            </Text>
                            <Text style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 18, fontFamily: FontFamily.regular }}>
                                A streak is between you and yourself, and on a bad week that is very easy to
                                argue with. Put embers on a habit with a friend: neither of you has kept it
                                until both of you have.
                            </Text>
                        </VoidCard>
                    ) : (
                        <View style={{ gap: 10 }}>
                            {live.map(pact => (
                                <PactCard
                                    key={pact.id}
                                    pact={pact}
                                    today={localDateKey(new Date())}
                                    busy={pactBusy === pact.id}
                                    // Only the side that was offered it can take it on; the
                                    // side that offered gets Withdraw instead.
                                    onAccept={pact.status === 'offered' && !pact.offeredByMe
                                        ? () => void answerPact(pact, true) : undefined}
                                    onDecline={pact.status === 'offered' ? () => void answerPact(pact, false) : undefined}
                                />
                            ))}
                        </View>
                    )}
                </View>

                {/* The day, as everyone finished it. This replaced a ranked
                    table: a leaderboard answers "who is winning", which rewards
                    whoever tracks the least demanding things and makes a bad
                    week public. */}
                <View style={styles.feed}>
                    <View style={styles.feedHead}>
                        <Text style={[styles.feedTitle, { color: colors.textPrimary }]}>TODAY</Text>
                        <Text style={[styles.feedSummary, { color: colors.textTertiary }]}>{summarise(dayFeed)}</Text>
                    </View>
                    {dayFeed.map(card => (
                        <DayCard
                            key={card.id}
                            card={card}
                            reaction={sentReactions[card.id]}
                            onReact={value => void handleReaction(card.id, value)}
                            onOpen={() => {
                                const found = friends.find(item => (item.id || item.userId) === card.id);
                                if (found) handleFriendPress(found);
                            }}
                            notes={notes[card.id]}
                            onComment={text => void handleComment(card.id, text)}
                            onDeleteNote={id => void handleDeleteNote(card.id, id)}
                        />
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

            <MakePactSheet
                visible={showMakePact}
                friends={friends.filter(friend => !friend.isCurrentUser)}
                onClose={() => setShowMakePact(false)}
                onMade={() => { void loadEmbers(); }}
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

const styles = StyleSheet.create({
    headerTitle: Typography.screenTitle,
    headerSubtitle: Typography.label,
    sectionLabel: UIStyles.sectionTitle,
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        fontFamily: FontFamily.regular,
    },
    searchResult: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLarge: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarSmall: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    username: {
        fontSize: 13,
        fontFamily: FontFamily.semibold,
    },
    email: {
        fontSize: 11,
        fontFamily: FontFamily.regular,
    },
    addButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    requestRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    actionBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    friendName: {
        fontSize: 14,
        fontFamily: FontFamily.bold,
        marginBottom: 2,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 10,
        fontFamily: FontFamily.regular,
    },
    progressDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    nudgeButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
    },
    nudgeText: {
        fontSize: 9,
        letterSpacing: 1,
        fontFamily: FontFamily.bold,
    },
    emptyText: {
        fontSize: 14,
        marginTop: 12,
        fontFamily: FontFamily.semibold,
    },
    emptySubtext: {
        fontSize: 11,
        marginTop: 4,
        fontFamily: FontFamily.regular,
    },
    feed: { gap: 10, marginTop: 6 },
    feedHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 },
    feedTitle: { fontSize: 13, letterSpacing: 1.5, fontFamily: FontFamily.bold },
    feedSummary: { fontSize: 12, fontFamily: FontFamily.regular, flexShrink: 1, textAlign: 'right' },
    leaderboardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10, // Tighter
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    rankText: {
        fontSize: 14,
        width: 24,
        textAlign: 'center',
        fontFamily: FontFamily.bold,
    },
    leaderName: {
        flex: 1,
        fontSize: 13,
        marginLeft: 12,
        fontFamily: FontFamily.semibold,
    },
    leaderStreak: {
        fontSize: 13,
        marginLeft: 4,
        fontFamily: FontFamily.regular,
    },
});
