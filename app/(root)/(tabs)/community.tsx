import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator, Share } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { FriendsService, Friend, FriendRequest, FriendActivity, ReactionType } from '@/lib/friendsService';
import { FriendStatsModal } from '@/components/FriendStatsModal';
import { AddFriendModal } from '@/components/Community/AddFriendModal';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence } from 'react-native-reanimated';

export default function CommunityScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { thud, lightFeedback, mediumFeedback } = useHaptics();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    // State
    const [friends, setFriends] = useState<Friend[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [leaderboard, setLeaderboard] = useState<{ rank: number; friend: Friend }[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Friend[]>([]);
    const [searching, setSearching] = useState(false);
    const [friendsFeed, setFriendsFeed] = useState<FriendActivity[]>([]);
    const [sharedHabits, setSharedHabits] = useState<any[]>([]);
    const [sentReactions, setSentReactions] = useState<Record<string, ReactionType>>({});
    const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
    const [showFriendStats, setShowFriendStats] = useState(false);
    const [showAddFriendModal, setShowAddFriendModal] = useState(false);
    const [userCode, setUserCode] = useState('');

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const user = await FriendsService.getCurrentUser();
            if (user) {
                // Friend Code is first 8 chars of ID
                setUserCode(user.id.substring(0, 8).toUpperCase());
            }

            const [friendsList, requests, rankings, feed, shared] = await Promise.all([
                FriendsService.getFriendsWithProgress(),
                FriendsService.getFriendRequests(),
                FriendsService.getLeaderboard(),
                FriendsService.getFriendsFeed(),
                FriendsService.getHabitsSharedWithMe(),
            ]);
            setFriends(friendsList);
            setFriendRequests(requests);
            setLeaderboard(rankings);
            setFriendsFeed(feed);
            setSharedHabits(shared);
        } catch (error) {
            console.error('Error loading community data:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = async () => {
        thud();
        setRefreshing(true);
        await loadData();
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
            <ScrollView
                contentContainerStyle={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 140 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Header */}
                <View style={{ marginBottom: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>COMMUNITY</Text>
                        <Text style={[styles.headerSubtitle, { color: colors.primary }]}>CREW STATUS</Text>
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
                        <Ionicons name="person-add" size={20} color={colors.primary} />
                    </TouchableOpacity>
                </View>

                {/* Shared Habits */}
                {sharedHabits.length > 0 && (
                    <View style={{ marginBottom: 24 }}>
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>SHARED WITH YOU</Text>
                        <VoidCard style={{ padding: 16 }}>
                            {sharedHabits.map((item, index) => (
                                <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: index < sharedHabits.length - 1 ? 12 : 0 }}>
                                    <View style={[styles.avatar, { backgroundColor: colors.surfaceTertiary }]}>
                                        <Text>{item.habit.icon ? item.habit.icon : '📝'}</Text>
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[styles.username, { color: colors.textPrimary }]}>{item.habit.name}</Text>
                                        <Text style={[styles.email, { color: colors.textTertiary }]}>Shared by {item.owner.username}</Text>
                                    </View>
                                    {/* Action Button (e.g. Accept/Clone - For now just visual) */}
                                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]}>
                                        <Ionicons name="add" size={18} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </VoidCard>
                    </View>
                )}

                {/* Friends Feed */}
                {friendsFeed.length > 0 && (
                    <View style={{ marginBottom: 24 }}>
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>RECENT ACTIVITY</Text>
                        {friendsFeed.map(activity => (
                            <VoidCard key={activity.id} style={{ padding: 16, marginBottom: 12 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    {/* Avatar */}
                                    <View style={[styles.avatar, { backgroundColor: colors.surfaceTertiary }]}>
                                        {activity.friendAvatarUrl ? (
                                            <Image source={{ uri: activity.friendAvatarUrl }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                                        ) : (
                                            <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                                                {activity.friendUsername[0]?.toUpperCase()}
                                            </Text>
                                        )}
                                    </View>

                                    {/* Info */}
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={[styles.username, { color: colors.textPrimary }]}>
                                            {activity.friendUsername}
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                            <Ionicons name={activity.habitIcon as any} size={12} color={colors.success} />
                                            <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 4 }}>
                                                Completed {activity.habitName}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Time */}
                                    <Text style={{ color: colors.textTertiary, fontSize: 10 }}>
                                        {getTimeAgo(activity.completedAt)}
                                    </Text>
                                </View>

                                {/* Reaction Bar */}
                                <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
                                    {(['🔥', '👏', '💪'] as ReactionType[]).map(reaction => {
                                        const isSelected = sentReactions[activity.id] === reaction;
                                        const existingCount = activity.reactions.find(r => r.type === reaction)?.count || 0;
                                        return (
                                            <TouchableOpacity
                                                key={reaction}
                                                onPress={() => handleReaction(activity.id, reaction)}
                                                style={{
                                                    paddingHorizontal: 12,
                                                    paddingVertical: 6,
                                                    borderRadius: 16,
                                                    backgroundColor: isSelected ? colors.primary + '30' : 'rgba(255,255,255,0.05)',
                                                    borderWidth: 1,
                                                    borderColor: isSelected ? colors.primary : 'transparent',
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                }}
                                            >
                                                <Text style={{ fontSize: 16 }}>{reaction}</Text>
                                                {(existingCount > 0 || isSelected) && (
                                                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                                                        {isSelected ? existingCount + 1 : existingCount}
                                                    </Text>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </VoidCard>
                        ))}
                    </View>
                )}



                {/* Friend Requests */}
                {friendRequests.length > 0 && (
                    <View style={{ marginBottom: 24 }}>
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PENDING REQUESTS</Text>
                        <VoidCard style={{ padding: 16 }}>
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

                {/* Friends List */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>YOUR CREW ({friends.length})</Text>
                    {friends.length === 0 ? (
                        <VoidCard style={{ padding: 32, alignItems: 'center' }}>
                            <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No friends yet</Text>
                            <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                                Search to add friends and compete!
                            </Text>
                        </VoidCard>
                    ) : (
                        <VoidCard style={{ padding: 0 }}>
                            {friends.map((friend, index) => (
                                <TouchableOpacity
                                    key={`crew_${friend.id}`}
                                    onPress={() => handleFriendPress(friend)}
                                    activeOpacity={0.7}
                                    style={{
                                        padding: 16,
                                        borderBottomWidth: index < friends.length - 1 ? 1 : 0,
                                        borderBottomColor: 'rgba(255,255,255,0.05)'
                                    }}
                                >
                                    <View style={styles.friendRow}>
                                        {/* Avatar */}
                                        <View style={[styles.avatarLarge, { backgroundColor: colors.surfaceTertiary }]}>
                                            {friend.avatarUrl ? (
                                                <Image source={{ uri: friend.avatarUrl }} style={styles.avatarImage} />
                                            ) : (
                                                <Text style={{ fontSize: 20, color: colors.textSecondary }}>
                                                    {friend.username[0]?.toUpperCase()}
                                                </Text>
                                            )}
                                        </View>

                                        {/* Info */}
                                        <View style={{ flex: 1, marginLeft: 16 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <Text style={[styles.friendName, { color: colors.textPrimary }]}>{friend.username}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Ionicons name="flame" size={14} color="#FFD93D" />
                                                    <Text style={{ color: '#FFD93D', fontSize: 12, fontWeight: '700', marginLeft: 2 }}>
                                                        {friend.currentStreak}
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Progress Bar */}
                                            <View style={{ marginTop: 8 }}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                    <Text style={{ color: colors.textTertiary, fontSize: 10 }}>Today's Progress</Text>
                                                    <Text style={{ color: colors.success, fontSize: 10, fontWeight: '600' }}>{friend.todayCompletion}%</Text>
                                                </View>
                                                <View style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                                                    <View style={{
                                                        height: '100%',
                                                        width: `${Math.min(friend.todayCompletion, 100)}%`,
                                                        backgroundColor: friend.todayCompletion >= 100 ? colors.success : colors.primary,
                                                        borderRadius: 3,
                                                    }} />
                                                </View>
                                            </View>
                                        </View>

                                        {/* Nudge Button */}
                                        <TouchableOpacity
                                            onPress={(e) => { e.stopPropagation(); handleNudge(friend); }}
                                            style={[styles.nudgeButton, { borderColor: colors.primary, marginLeft: 12 }]}
                                        >
                                            <Text style={[styles.nudgeText, { color: colors.primary }]}>👋</Text>
                                        </TouchableOpacity>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </VoidCard>
                    )}
                </View>

                {/* Leaderboard */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>FRIEND LEADERBOARD</Text>
                    <VoidCard glass style={{ padding: 16 }}>
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
                                        <Text style={[styles.leaderName, { color: friend.username === 'You' ? colors.primary : colors.textPrimary }]}>
                                            {friend.username}
                                        </Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Ionicons name="flame" size={14} color="#FFD93D" />
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
