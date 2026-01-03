import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet, TextInput, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { Ionicons } from '@expo/vector-icons';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { FriendsService, Friend, FriendRequest } from '@/lib/friendsService';
import * as Haptics from 'expo-haptics';

export default function CommunityScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { thud, lightFeedback } = useHaptics();
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    // State
    const [friends, setFriends] = useState<Friend[]>([]);
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [leaderboard, setLeaderboard] = useState<{ rank: number; friend: Friend }[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Friend[]>([]);
    const [searching, setSearching] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [friendsList, requests, rankings] = await Promise.all([
                FriendsService.getFriends(),
                FriendsService.getFriendRequests(),
                FriendsService.getLeaderboard(),
            ]);
            setFriends(friendsList);
            setFriendRequests(requests);
            setLeaderboard(rankings);
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
        if (query.length >= 3) {
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
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

    return (
        <VoidShell>
            <ScrollView
                contentContainerStyle={{ paddingTop: 80, paddingHorizontal: 20, paddingBottom: 140 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
                }
            >
                {/* Header */}
                <View style={{ marginBottom: 32 }}>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>COMMUNITY</Text>
                    <Text style={[styles.headerSubtitle, { color: colors.primary }]}>CREW STATUS</Text>
                </View>

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
                            <VoidCard key={friend.id} style={{ padding: 16, marginBottom: 12 }}>
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
                                        <Text style={[styles.friendName, { color: colors.textPrimary }]}>{friend.username}</Text>
                                        <View style={styles.statsRow}>
                                            <View style={styles.statBadge}>
                                                <Ionicons name="flame" size={12} color="#FFD93D" />
                                                <Text style={[styles.statText, { color: colors.textSecondary }]}>
                                                    {friend.currentStreak} days
                                                </Text>
                                            </View>
                                            <View style={[styles.statBadge, { marginLeft: 12 }]}>
                                                <View style={[styles.progressDot, { backgroundColor: colors.success }]} />
                                                <Text style={[styles.statText, { color: colors.textSecondary }]}>
                                                    {friend.todayCompletion}% today
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Nudge Button */}
                                    <TouchableOpacity
                                        onPress={() => handleNudge(friend)}
                                        style={[styles.nudgeButton, { borderColor: colors.primary }]}
                                    >
                                        <Text style={[styles.nudgeText, { color: colors.primary }]}>NUDGE</Text>
                                    </TouchableOpacity>
                                </View>
                            </VoidCard>
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
                                <View key={friend.id} style={[styles.leaderboardRow, rank <= 3 && { opacity: 1 }]}>
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
                            ))
                        )}
                    </VoidCard>
                </View>

            </ScrollView>
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
