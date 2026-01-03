import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { FriendsService, Friend, FriendRequest, FriendActivity, ReactionType } from '@/lib/friendsService';
import { FriendStatsModal } from '@/components/FriendStatsModal';
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
    const [sentReactions, setSentReactions] = useState<Record<string, ReactionType>>({});
    const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
    const [showFriendStats, setShowFriendStats] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [friendsList, requests, rankings, feed] = await Promise.all([
                FriendsService.getFriendsWithProgress(),
                FriendsService.getFriendRequests(),
                FriendsService.getLeaderboard(),
                FriendsService.getFriendsFeed(),
            ]);
            setFriends(friendsList);
            setFriendRequests(requests);
            setLeaderboard(rankings);
            setFriendsFeed(feed);
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
            Alert.alert('Success', 'Friend request sent!');
            setSearchResults(prev => prev.filter(u => u.id !== userId));
            setSearchQuery('');
        } else {
            Alert.alert('Error', 'Could not send friend request');
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
        // Don't show modal for "You" (current user)
        if (friend.username === 'You') return;
        lightFeedback();
        setSelectedFriend(friend);
        setShowFriendStats(true);
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
                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>COMMUNITY</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.primary }]}>CREW STATUS</Text>
                </View>

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

                {/* Search Friends */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ADD FRIENDS</Text>
                    <VoidCard style={{ padding: 16 }}>
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color={colors.textTertiary} />
                            <TextInput
                                placeholder="Search by email or username..."
                                placeholderTextColor={colors.textTertiary}
                                style={[styles.searchInput, { color: colors.textPrimary }]}
                                value={searchQuery}
                                onChangeText={handleSearch}
                                autoCapitalize="none"
                            />
                            {searching && <ActivityIndicator size="small" color={colors.primary} />}
                        </View>

                        {/* Search Results */}
                        {searchResults.length > 0 && (
                            <View style={{ marginTop: 16 }}>
                                {searchResults.map(user => (
                                    <View key={user.id} style={styles.searchResult}>
                                        <View style={[styles.avatar, { backgroundColor: colors.surfaceTertiary }]}>
                                            <Text style={{ fontSize: 16 }}>{user.username[0]?.toUpperCase()}</Text>
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 12 }}>
                                            <Text style={[styles.username, { color: colors.textPrimary }]}>{user.username}</Text>
                                            <Text style={[styles.email, { color: colors.textTertiary }]}>{user.email}</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => handleSendRequest(user.id)}
                                            style={[styles.addButton, { backgroundColor: colors.primary }]}
                                        >
                                            <Ionicons name="person-add" size={16} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </VoidCard>
                </View>

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
                        friends.map(friend => (
                            <TouchableOpacity key={friend.id} onPress={() => handleFriendPress(friend)} activeOpacity={0.7}>
                                <VoidCard style={{ padding: 16, marginBottom: 12 }}>
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
                                </VoidCard>
                            </TouchableOpacity>
                        ))
                    )}
                </View>

                {/* Leaderboard */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>WEEKLY LEADERBOARD</Text>
                    <VoidCard glass style={{ padding: 16 }}>
                        {leaderboard.length === 0 ? (
                            <Text style={[styles.emptyText, { color: colors.textSecondary, textAlign: 'center', paddingVertical: 24 }]}>
                                Add friends to see rankings!
                            </Text>
                        ) : (
                            leaderboard.slice(0, 5).map(({ rank, friend }) => (
                                <TouchableOpacity
                                    key={friend.id}
                                    onPress={() => handleFriendPress(friend)}
                                    activeOpacity={friend.username === 'You' ? 1 : 0.7}
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
        </VoidShell>
    );
}

const styles = StyleSheet.create({
    headerTitle: {
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -1,
        fontFamily: 'SpaceGrotesk-Bold',
    },
    headerSubtitle: {
        marginTop: 4,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 2,
        opacity: 0.8,
        fontFamily: 'SpaceMono-Regular',
    },
    sectionLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 12,
        fontFamily: 'SpaceMono-Regular',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'SpaceMono-Regular',
    },
    searchResult: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarLarge: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatarSmall: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    username: {
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'SpaceMono-Regular',
    },
    email: {
        fontSize: 11,
        fontFamily: 'SpaceMono-Regular',
    },
    addButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    requestRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    actionBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    friendRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    friendName: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'SpaceGrotesk-Bold',
        marginBottom: 4,
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
        fontSize: 11,
        fontFamily: 'SpaceMono-Regular',
    },
    progressDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    nudgeButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
    },
    nudgeText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        fontFamily: 'SpaceMono-Regular',
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 12,
        marginTop: 4,
        fontFamily: 'SpaceMono-Regular',
    },
    leaderboardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    rankText: {
        fontSize: 16,
        width: 28,
        textAlign: 'center',
    },
    leaderName: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        marginLeft: 12,
        fontFamily: 'SpaceMono-Regular',
    },
    leaderStreak: {
        fontSize: 14,
        marginLeft: 4,
        fontFamily: 'SpaceMono-Regular',
    },
});
