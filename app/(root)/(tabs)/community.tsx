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
    const [mySharedGoals, setMySharedGoals] = useState<any[]>([]);
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

            const [friendsList, requests, rankings, feed, shared, sharedGoalsData, goalsIShared] = await Promise.all([
                FriendsService.getFriendsWithProgress(),
                FriendsService.getFriendRequests(),
                FriendsService.getLeaderboard(leaderboardPeriod),
                FriendsService.getFriendsFeed(),
                FriendsService.getHabitsSharedWithMe(),
                FriendsService.getGoalsSharedWithMe(),
                FriendsService.getGoalsIShared(),
            ]);
            setFriends(friendsList);
            setFriendRequests(requests);
            setLeaderboard(rankings);
            setFriendsFeed(feed);
            setSharedHabits(shared);
            setSharedGoals(sharedGoalsData);
            setMySharedGoals(goalsIShared);
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

                {/* Goals I've Shared */}
                {mySharedGoals.length > 0 && (
                    <View style={{ marginBottom: 24 }}>
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>GOALS YOU'VE SHARED</Text>
                        <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[{ padding: 16 }, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                            {mySharedGoals.map((item, index) => (
                                <View key={`my-shared-${index}`} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index < mySharedGoals.length - 1 ? 12 : 0 }}>
                                    {/* Goal Icon */}
                                    <View style={[styles.avatarLarge, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                                        <Text style={{ fontSize: 20 }}>{item.goal.icon || '🎯'}</Text>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[styles.friendName, { color: colors.textPrimary }]}>{item.goal.name}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                            <Text style={[styles.email, { color: colors.textTertiary }]}>
                                                Shared with {item.sharedWith.map((f: any) => f.username).join(', ')}
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
                    </View>
                )}


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
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <View>
                            <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginBottom: 2 }]}>LEADERBOARD</Text>
                            <Text style={{ fontSize: 10, color: colors.textTertiary, fontFamily: 'Lexend_400Regular' }}>
                                Based on streak consistency
                            </Text>
                        </View>
                    </View>

                    {/* Time Period Filter - Pill Style */}
                    <View style={{
                        flexDirection: 'row',
                        backgroundColor: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                        borderRadius: 12,
                        padding: 4,
                        marginBottom: 16,
                    }}>
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
                                    paddingVertical: 10,
                                    borderRadius: 10,
                                    backgroundColor: leaderboardPeriod === period.id ? accentColor : 'transparent',
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{
                                    color: leaderboardPeriod === period.id ? '#fff' : colors.textSecondary,
                                    fontSize: 12,
                                    fontWeight: leaderboardPeriod === period.id ? '700' : '500',
                                    fontFamily: 'Lexend',
                                }}>
                                    {period.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {leaderboard.length === 0 ? (
                        <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[{ padding: 32, alignItems: 'center' }, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                            <Ionicons name="trophy-outline" size={40} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 12 }]}>No rankings yet</Text>
                            <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>Add friends to compete!</Text>
                        </VoidCard>
                    ) : (
                        <>
                            {/* Top 3 Podium */}
                            {leaderboard.length >= 1 && (
                                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                                    {/* 2nd Place */}
                                    {leaderboard.length >= 2 ? (
                                        <TouchableOpacity
                                            style={{ flex: 1 }}
                                            onPress={() => handleFriendPress(leaderboard[1].friend)}
                                            activeOpacity={0.7}
                                        >
                                            <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[{
                                                padding: 16,
                                                alignItems: 'center',
                                                marginTop: 24,
                                            }, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                                                <Text style={{ fontSize: 24, marginBottom: 8 }}>🥈</Text>
                                                <View style={[styles.avatarSmall, { backgroundColor: colors.surfaceTertiary, width: 40, height: 40, borderRadius: 20 }]}>
                                                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>{leaderboard[1].friend.username[0]?.toUpperCase()}</Text>
                                                </View>
                                                <Text style={{
                                                    color: leaderboard[1].friend.isCurrentUser ? accentColor : colors.textPrimary,
                                                    fontSize: 11,
                                                    fontWeight: '600',
                                                    marginTop: 8,
                                                    textAlign: 'center',
                                                    fontFamily: 'Lexend',
                                                }} numberOfLines={1}>
                                                    {leaderboard[1].friend.isCurrentUser ? 'You' : leaderboard[1].friend.username}
                                                </Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                    <Ionicons name="flame" size={12} color="#C0C0C0" />
                                                    <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '700', marginLeft: 4, fontFamily: 'Lexend' }}>
                                                        {leaderboard[1].friend.currentStreak}
                                                    </Text>
                                                </View>
                                            </VoidCard>
                                        </TouchableOpacity>
                                    ) : <View style={{ flex: 1 }} />}

                                    {/* 1st Place - Slightly elevated */}
                                    <TouchableOpacity
                                        style={{ flex: 1 }}
                                        onPress={() => handleFriendPress(leaderboard[0].friend)}
                                        activeOpacity={0.7}
                                    >
                                        <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[{
                                            padding: 16,
                                            alignItems: 'center',
                                            borderWidth: 1,
                                            borderColor: accentColor + '40',
                                        }, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                                            <Text style={{ fontSize: 28, marginBottom: 8 }}>🥇</Text>
                                            <View style={[styles.avatarSmall, {
                                                backgroundColor: accentColor + '20',
                                                width: 48,
                                                height: 48,
                                                borderRadius: 24,
                                                borderWidth: 2,
                                                borderColor: accentColor,
                                            }]}>
                                                <Text style={{ fontSize: 16, color: accentColor }}>{leaderboard[0].friend.username[0]?.toUpperCase()}</Text>
                                            </View>
                                            <Text style={{
                                                color: leaderboard[0].friend.isCurrentUser ? accentColor : colors.textPrimary,
                                                fontSize: 12,
                                                fontWeight: '700',
                                                marginTop: 8,
                                                textAlign: 'center',
                                                fontFamily: 'Lexend',
                                            }} numberOfLines={1}>
                                                {leaderboard[0].friend.isCurrentUser ? 'You' : leaderboard[0].friend.username}
                                            </Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                <Ionicons name="flame" size={14} color="#FFD93D" />
                                                <Text style={{ color: '#FFD93D', fontSize: 14, fontWeight: '800', marginLeft: 4, fontFamily: 'Lexend' }}>
                                                    {leaderboard[0].friend.currentStreak}
                                                </Text>
                                            </View>
                                        </VoidCard>
                                    </TouchableOpacity>

                                    {/* 3rd Place */}
                                    {leaderboard.length >= 3 ? (
                                        <TouchableOpacity
                                            style={{ flex: 1 }}
                                            onPress={() => handleFriendPress(leaderboard[2].friend)}
                                            activeOpacity={0.7}
                                        >
                                            <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[{
                                                padding: 16,
                                                alignItems: 'center',
                                                marginTop: 32,
                                            }, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                                                <Text style={{ fontSize: 22, marginBottom: 8 }}>🥉</Text>
                                                <View style={[styles.avatarSmall, { backgroundColor: colors.surfaceTertiary, width: 36, height: 36, borderRadius: 18 }]}>
                                                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>{leaderboard[2].friend.username[0]?.toUpperCase()}</Text>
                                                </View>
                                                <Text style={{
                                                    color: leaderboard[2].friend.isCurrentUser ? accentColor : colors.textPrimary,
                                                    fontSize: 10,
                                                    fontWeight: '600',
                                                    marginTop: 8,
                                                    textAlign: 'center',
                                                    fontFamily: 'Lexend',
                                                }} numberOfLines={1}>
                                                    {leaderboard[2].friend.isCurrentUser ? 'You' : leaderboard[2].friend.username}
                                                </Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                                    <Ionicons name="flame" size={11} color="#CD7F32" />
                                                    <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '700', marginLeft: 4, fontFamily: 'Lexend' }}>
                                                        {leaderboard[2].friend.currentStreak}
                                                    </Text>
                                                </View>
                                            </VoidCard>
                                        </TouchableOpacity>
                                    ) : <View style={{ flex: 1 }} />}
                                </View>
                            )}

                            {/* Rest of rankings (4th onward) */}
                            {leaderboard.length > 3 && (
                                <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[{ padding: 12 }, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                                    {leaderboard.slice(3).map(({ rank, friend }) => (
                                        <TouchableOpacity
                                            key={`leaderboard_${friend.id}`}
                                            onPress={() => handleFriendPress(friend)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[styles.leaderboardRow]}>
                                                <View style={{
                                                    width: 28,
                                                    height: 28,
                                                    borderRadius: 8,
                                                    backgroundColor: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}>
                                                    <Text style={{ color: colors.textTertiary, fontSize: 12, fontWeight: '700', fontFamily: 'Lexend' }}>
                                                        {rank}
                                                    </Text>
                                                </View>
                                                <View style={[styles.avatarSmall, { backgroundColor: colors.surfaceTertiary, marginLeft: 12 }]}>
                                                    <Text style={{ fontSize: 12, color: colors.textSecondary }}>{friend.username[0]?.toUpperCase()}</Text>
                                                </View>
                                                <Text style={[styles.leaderName, { color: friend.isCurrentUser ? accentColor : colors.textPrimary }]}>
                                                    {friend.username}{friend.isCurrentUser ? ' (You)' : ''}
                                                </Text>
                                                <View style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    backgroundColor: theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)',
                                                    paddingHorizontal: 10,
                                                    paddingVertical: 4,
                                                    borderRadius: 12,
                                                }}>
                                                    <Ionicons name="flame" size={12} color={colors.textTertiary} />
                                                    <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginLeft: 4, fontFamily: 'Lexend' }}>
                                                        {friend.currentStreak}
                                                    </Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                </VoidCard>
                            )}
                        </>
                    )}
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
