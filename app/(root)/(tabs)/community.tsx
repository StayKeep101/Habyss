import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, Share } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useAccentGradient } from '@/constants/AccentContext';
import { FriendsService, Friend, FriendRequest, FriendActivity, ReactionType } from '@/lib/friendsService';
import { addHabit } from '@/lib/habitsSQLite';
import { FriendStatsModal } from '@/components/FriendStatsModal';
import { AddFriendModal } from '@/components/Community/AddFriendModal';
import { useRouter } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';

export default function CommunityScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { primary: accentColor } = useAccentGradient();
    const { thud, lightFeedback, mediumFeedback } = useHaptics();
    const router = useRouter();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const hasLoadedOnce = useRef(false);

    // State
    const [friends, setFriends] = useState<Friend[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [leaderboard, setLeaderboard] = useState<{ rank: number; friend: Friend }[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Friend[]>([]);
    const [searching, setSearching] = useState(false);
    const [friendsFeed, setFriendsFeed] = useState<FriendActivity[]>([]);
    const [sharedHabits, setSharedHabits] = useState<any[]>([]);
    const [sharedGoals, setSharedGoals] = useState<any[]>([]);
    const [sentReactions, setSentReactions] = useState<Record<string, ReactionType>>({});
    const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
    const [showFriendStats, setShowFriendStats] = useState(false);
    const [showAddFriendModal, setShowAddFriendModal] = useState(false);
    const [userCode, setUserCode] = useState('');
    const [leaderboardPeriod, setLeaderboardPeriod] = useState<'week' | 'month' | 'year' | 'all'>('week');

    const loadData = useCallback(async (forceRefresh = false) => {
        // Skip if already loaded and not forcing refresh
        if (!forceRefresh && hasLoadedOnce.current && !loading) {
            return;
        }

        setLoading(true);
        try {
            const user = await FriendsService.getCurrentUser();
            if (user) {
                // Friend Code is first 8 chars of ID
                setUserCode(user.id.substring(0, 8).toUpperCase());
            }

            // Auto-repair: sync accepted requests to friendships table
            await FriendsService.repairFriendshipsFromAcceptedRequests();

            const [friendsList, requests, rankings, feed, shared, sharedGoalsData] = await Promise.all([
                FriendsService.getFriendsWithProgress(),
                FriendsService.getFriendRequests(),
                FriendsService.getLeaderboard(leaderboardPeriod),
                FriendsService.getFriendsFeed(),
                FriendsService.getHabitsSharedWithMe(),
                FriendsService.getGoalsSharedWithMe(),
            ]);
            setFriends(friendsList);
            setFriendRequests(requests);
            setLeaderboard(rankings);
            setFriendsFeed(feed);
            setSharedHabits(shared);
            setSharedGoals(sharedGoalsData);
            hasLoadedOnce.current = true;
        } catch (error) {
            console.error('Error loading community data:', error);
        } finally {
            setLoading(false);
        }
    }, [leaderboardPeriod]);

    // Only load data once on initial mount
    useEffect(() => {
        if (!hasLoadedOnce.current) {
            loadData();
        }
    }, []);

    // Reload leaderboard when period changes
    useEffect(() => {
        const loadLeaderboard = async () => {
            const rankings = await FriendsService.getLeaderboard(leaderboardPeriod);
            setLeaderboard(rankings);
        };
        loadLeaderboard();
    }, [leaderboardPeriod]);

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
            await loadData(); // Refresh to show new friend if auto-accepted
        } else {
            Alert.alert('Already Connected', 'You may already be friends or have a pending request with this user.');
        }
    };

    const handleAcceptRequest = async (requestId: string) => {
        lightFeedback();
        const success = await FriendsService.acceptFriendRequest(requestId);
        if (success) {
            await loadData();
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

    const getRankIcon = (rank: number) => {
        if (rank === 1) return '🥇';
        if (rank === 2) return '🥈';
        if (rank === 3) return '🥉';
        return `#${rank}`;
    };

    const handleReaction = async (activityId: string, reaction: ReactionType) => {
        mediumFeedback();
        setSentReactions(prev => ({ ...prev, [activityId]: reaction }));
        await FriendsService.sendReaction(activityId, reaction);
    };

    const getTimeAgo = (dateStr: string) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        return 'Today';
    };

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
                message: `Join my crew on Habyss! Add me with my Friend Code: ${userCode}`,
            });
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <VoidShell>
            {/* Full-Page Loading Overlay (Initial Load Only) */}
            {loading && !refreshing && (
                <View style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    justifyContent: 'center',
                    alignItems: 'center',
                    backgroundColor: colors.background,
                    zIndex: 100,
                }}>
                    {(() => {
                        const { SpinningLogo } = require('@/components/SpinningLogo');
                        return <SpinningLogo />;
                    })()}
                    <Text style={{ color: colors.textSecondary, marginTop: 16, fontFamily: 'Lexend_400Regular' }}>Getting crew data...</Text>
                </View>
            )}

            <ScrollView
                contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 140 }}
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
                {/* Custom Refresh Spinner */}
                {refreshing && (
                    <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                        {(() => {
                            const { SpinningLogo } = require('@/components/SpinningLogo');
                            return <SpinningLogo />;
                        })()}
                    </View>
                )}
                {/* Header */}
                <View style={{ marginBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>COMMUNITY</Text>
                        <Text style={[styles.headerSubtitle, { color: accentColor }]}>CREW STATUS</Text>
                    </View>
                    <TouchableOpacity
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
                </View>

                {/* Shared Habits */}
                {sharedHabits.length > 0 && (
                    <View style={{ marginBottom: 24 }}>
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>SHARED WITH YOU</Text>
                        <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[{ padding: 16 }, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                            {sharedHabits.map((item, index) => (
                                <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index < sharedHabits.length - 1 ? 12 : 0 }}>
                                    <View style={[styles.avatar, { backgroundColor: colors.surfaceTertiary }]}>
                                        <Text>{item.habit.icon ? item.habit.icon : '📝'}</Text>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[styles.username, { color: colors.textPrimary }]}>{item.habit.name}</Text>
                                        <Text style={[styles.email, { color: colors.textTertiary }]}>Shared by {item.owner.username}</Text>
                                    </View>
                                    {/* Clone Habit Button */}
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: accentColor }]}
                                        onPress={() => {
                                            mediumFeedback();
                                            Alert.alert(
                                                'Add Habit',
                                                `Add "${item.habit.name}" to your habits?`,
                                                [
                                                    { text: 'Cancel', style: 'cancel' },
                                                    {
                                                        text: 'Add',
                                                        onPress: async () => {
                                                            const newHabit = await addHabit({
                                                                name: item.habit.name,
                                                                icon: item.habit.icon,
                                                                category: item.habit.category,
                                                                taskDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                                                            });
                                                            if (newHabit) {
                                                                Alert.alert('Success', 'Habit added!');
                                                                loadData(); // Refresh
                                                            }
                                                        }
                                                    }
                                                ]
                                            );
                                        }}
                                    >
                                        <Ionicons name="add" size={18} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </VoidCard>
                    </View>
                )}

                {/* Shared Goals - Primary Content */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>GOALS SHARED WITH YOU</Text>
                    {sharedGoals.length === 0 ? (
                        <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[{ padding: 32, alignItems: 'center' }, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                            <Ionicons name="flag-outline" size={48} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No shared goals yet</Text>
                            <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                                When friends share goals with you, they'll appear here
                            </Text>
                        </VoidCard>
                    ) : (
                        <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[{ padding: 16 }, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                            {sharedGoals.map((item, index) => (
                                <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index < sharedGoals.length - 1 ? 12 : 0 }}>
                                    {/* Owner Avatar */}
                                    <View style={[styles.avatarLarge, { backgroundColor: colors.surfaceTertiary }]}>
                                        {item.owner?.avatarUrl ? (
                                            <Image source={{ uri: item.owner.avatarUrl }} style={styles.avatarImage} />
                                        ) : (
                                            <Text style={{ fontSize: 16, color: colors.textSecondary }}>
                                                {item.owner?.username?.[0]?.toUpperCase() || '?'}
                                            </Text>
                                        )}
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[styles.friendName, { color: colors.textPrimary }]}>{item.goal.name}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                            <Text style={{ fontSize: 16 }}>{item.goal.icon || '🎯'}</Text>
                                            <Text style={[styles.email, { color: colors.textTertiary }]}>
                                                {item.owner?.username || 'Unknown'}
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: accentColor }]}
                                        onPress={() => {
                                            mediumFeedback();
                                            router.push({
                                                pathname: '/goal-detail',
                                                params: { goalId: item.goal.id }
                                            });
                                        }}
                                    >
                                        <Ionicons name="eye" size={18} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </VoidCard>
                    )}
                </View>


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

                {/* Leaderboard */}
                <View style={{ marginBottom: 24 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 0 }]}>LEADERBOARD</Text>
                    </View>
                    {/* Time Period Filter */}
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        {[
                            { id: 'week', label: 'Week' },
                            { id: 'month', label: 'Month' },
                            { id: 'year', label: 'Year' },
                            { id: 'all', label: 'All Time' },
                        ].map(period => (
                            <TouchableOpacity
                                key={period.id}
                                onPress={() => { lightFeedback(); setLeaderboardPeriod(period.id as any); }}
                                style={{
                                    flex: 1,
                                    paddingVertical: 8,
                                    borderRadius: 8,
                                    backgroundColor: leaderboardPeriod === period.id ? accentColor : colors.surfaceSecondary,
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ color: leaderboardPeriod === period.id ? '#fff' : colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                                    {period.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[{ padding: 16 }, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                        {leaderboard.length === 0 ? (
                            <Text style={[styles.emptyText, { color: colors.textSecondary, textAlign: 'center', paddingVertical: 24 }]}>
                                Add friends to see rankings!
                            </Text>
                        ) : (
                            leaderboard.map(({ rank, friend }) => (
                                <TouchableOpacity
                                    key={`leaderboard_${friend.id}`}
                                    onPress={() => handleFriendPress(friend)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.leaderboardRow, rank <= 3 && { opacity: 1 }]}>
                                        <Text style={[styles.rankText, { color: rank <= 3 ? '#FFD93D' : colors.textTertiary }]}>
                                            {getRankIcon(rank)}
                                        </Text>
                                        <View style={[styles.avatarSmall, { backgroundColor: colors.surfaceTertiary, marginLeft: 12 }]}>
                                            <Text style={{ fontSize: 12 }}>{friend.username[0]?.toUpperCase()}</Text>
                                        </View>
                                        <Text style={[styles.leaderName, { color: friend.isCurrentUser ? accentColor : colors.textPrimary }]}>
                                            {friend.username}{friend.isCurrentUser ? ' (You)' : ''}
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="checkmark-circle" size={14} color="#22C55E" />
                                            <Text style={[styles.leaderStreak, { color: colors.textSecondary }]}>
                                                {friend.currentStreak}
                                            </Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </VoidCard>
                </View>

            </ScrollView>

            {/* Friend Stats Modal */}
            <FriendStatsModal
                visible={showFriendStats}
                friend={selectedFriend}
                onClose={() => setShowFriendStats(false)}
                onNudge={handleNudge}
            />

            {/* Add Friend Modal */}
            <AddFriendModal
                visible={showAddFriendModal}
                onClose={() => setShowAddFriendModal(false)}
                userCode={userCode}
                onFriendAdded={loadData}
            />
        </VoidShell>
    );
}

const styles = StyleSheet.create({
    headerTitle: {
        fontSize: 24, // Smaller
        fontWeight: '900',
        letterSpacing: -1,
        fontFamily: 'Lexend',
    },
    headerSubtitle: {
        marginTop: 2,
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 2,
        opacity: 0.8,
        fontFamily: 'Lexend_400Regular',
    },
    sectionLabel: {
        fontSize: 10, // Consistent
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
        fontFamily: 'Lexend_400Regular',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        fontFamily: 'Lexend_400Regular',
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
        fontWeight: '600',
        fontFamily: 'Lexend_400Regular',
    },
    email: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
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
        fontWeight: '700',
        fontFamily: 'Lexend',
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
        fontFamily: 'Lexend_400Regular',
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
        fontWeight: '700',
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
    emptyText: {
        fontSize: 14,
        fontWeight: '600',
        marginTop: 12,
        fontFamily: 'Lexend',
    },
    emptySubtext: {
        fontSize: 11,
        marginTop: 4,
        fontFamily: 'Lexend_400Regular',
    },
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
        fontFamily: 'Lexend',
    },
    leaderName: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 12,
        fontFamily: 'Lexend_400Regular',
    },
    leaderStreak: {
        fontSize: 13,
        marginLeft: 4,
        fontFamily: 'Lexend_400Regular',
    },
});
