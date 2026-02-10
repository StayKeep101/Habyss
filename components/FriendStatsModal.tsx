import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Friend, FriendsService } from '@/lib/friendsService';
import Svg, { Circle } from 'react-native-svg';
import { VoidModal } from '@/components/Layout/VoidModal';

interface FriendStatsModalProps {
    visible: boolean;
    friend: Friend | null;
    onClose: () => void;
    onNudge: (friend: Friend) => void;
}

interface FriendDetailedStats {
    totalHabits: number;
    completedToday: number;
    totalGoals: number;
    weeklyActivity: boolean[]; // Last 7 days
    longestStreak: number;
}

export const FriendStatsModal: React.FC<FriendStatsModalProps> = ({
    visible,
    friend,
    onClose,
    onNudge,
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const [detailedStats, setDetailedStats] = useState<FriendDetailedStats | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (visible && friend) {
            loadDetailedStats(friend.id);
        }
    }, [visible, friend]);

    const loadDetailedStats = async (friendId: string) => {
        setLoading(true);
        try {
            // Fetch real stats from the database
            const realStats = await FriendsService.getFriendDetailedStats(friendId);

            if (realStats) {
                setDetailedStats(realStats);
            } else {
                // Fallback to friend's basic data if detailed stats unavailable
                setDetailedStats({
                    totalHabits: 0,
                    completedToday: Math.floor((friend?.todayCompletion || 0) / 100 * 5),
                    totalGoals: 0,
                    weeklyActivity: friend?.weeklyActivity?.map(p => p >= 50) || Array(7).fill(false),
                    longestStreak: friend?.bestStreak || friend?.currentStreak || 0,
                });
            }
        } catch (e) {
            console.error('Error loading friend stats:', e);
        } finally {
            setLoading(false);
        }
    };

    if (!friend) return null;

    const progressPercent = friend.todayCompletion || 0;
    const streak = friend.currentStreak || 0;

    // Circle progress calculations
    const size = 140;
    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

    return (
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.90}>
            <View style={{ flex: 1 }}>
                {/* Header - styled like StreakModal */}
                <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={onClose} style={[styles.iconButton, { backgroundColor: colors.surfaceSecondary }]}>
                        <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginLeft: 16 }}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>PROFILE</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.primary }]}>FRIEND STATS</Text>
                    </View>
                </View>

                <ScrollView
                    contentContainerStyle={styles.content}
                    showsVerticalScrollIndicator={false}
                >
                    {/* Avatar Section */}
                    <View style={styles.header}>
                        <View style={[styles.avatarLarge, { borderColor: colors.primary, backgroundColor: colors.surfaceSecondary }]}>
                            {friend.avatarUrl ? (
                                <Image source={{ uri: friend.avatarUrl }} style={styles.avatarImage} />
                            ) : (
                                <Text style={[styles.avatarText, { color: colors.textSecondary }]}>
                                    {friend.username[0]?.toUpperCase()}
                                </Text>
                            )}
                        </View>
                        <Text style={[styles.username, { color: colors.text }]}>{friend.username}</Text>
                    </View>

                    {/* Stats Grid */}
                    <View style={styles.statsRow}>
                        {/* Today's Progress Ring */}
                        <VoidCard glass style={styles.progressCard}>
                            <Svg width={size} height={size}>
                                {/* Background Circle */}
                                <Circle
                                    stroke={colors.surfaceSecondary}
                                    fill="none"
                                    cx={size / 2}
                                    cy={size / 2}
                                    r={radius}
                                    strokeWidth={strokeWidth}
                                />
                                {/* Progress Circle */}
                                <Circle
                                    stroke={progressPercent >= 100 ? '#22C55E' : colors.primary}
                                    fill="none"
                                    cx={size / 2}
                                    cy={size / 2}
                                    r={radius}
                                    strokeWidth={strokeWidth}
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                    rotation="-90"
                                    origin={`${size / 2}, ${size / 2}`}
                                />
                            </Svg>
                            <View style={styles.progressCenter}>
                                <Text style={[styles.progressValue, { color: colors.text }]}>{progressPercent}%</Text>
                                <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>TODAY</Text>
                            </View>
                        </VoidCard>

                        {/* Quick Stats */}
                        <View style={styles.quickStats}>
                            <VoidCard glass style={styles.statCard}>
                                <Ionicons name="flame" size={28} color="#FFD93D" />
                                <Text style={[styles.statValue, { color: colors.text }]}>{streak}</Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>DAY STREAK</Text>
                            </VoidCard>
                            <VoidCard glass style={styles.statCard}>
                                <Ionicons name="trophy" size={28} color="#F97316" />
                                <Text style={[styles.statValue, { color: colors.text }]}>{detailedStats?.longestStreak || streak}</Text>
                                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>BEST STREAK</Text>
                            </VoidCard>
                        </View>
                    </View>

                    {/* Weekly Activity */}
                    <VoidCard glass style={styles.weeklyCard}>
                        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>THIS WEEK'S ACTIVITY</Text>
                        <View style={styles.weekDays}>
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                                const isActive = detailedStats?.weeklyActivity?.[i] ?? false;
                                const todayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; // Convert to M=0, T=1, ... S=6
                                const isToday = i === todayIndex;
                                return (
                                    <View key={i} style={styles.dayColumn}>
                                        <View
                                            style={[
                                                styles.dayDot,
                                                {
                                                    backgroundColor: isActive
                                                        ? isToday ? colors.primary : '#22C55E'
                                                        : colors.surfaceSecondary,
                                                    borderWidth: isToday ? 2 : 0,
                                                    borderColor: colors.primary,
                                                },
                                            ]}
                                        >
                                            {isActive && <Ionicons name="checkmark" size={16} color="#fff" />}
                                        </View>
                                        <Text style={[styles.dayLabel, { color: isToday ? colors.primary : colors.textTertiary }]}>
                                            {day}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </VoidCard>

                    {/* Actions */}
                    <View style={styles.actions}>
                        {friend.username === 'You' ? (
                            <Text style={[styles.previewText, { color: colors.textTertiary }]}>This is how your profile appears to friends</Text>
                        ) : (
                            <>
                                <TouchableOpacity
                                    style={[styles.nudgeButton, { backgroundColor: colors.primary, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
                                    onPress={() => {
                                        onNudge(friend);
                                        onClose();
                                    }}
                                >
                                    <Text style={styles.nudgeText}>👋 Send Nudge</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.nudgeButton, { backgroundColor: colors.surfaceSecondary, flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 12 }]}
                                    onPress={() => {
                                        Alert.alert(
                                            'Remove Friend',
                                            `Are you sure you want to remove ${friend.username} from your friends?`,
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                {
                                                    text: 'Remove',
                                                    style: 'destructive',
                                                    onPress: async () => {
                                                        const success = await FriendsService.removeFriend(friend.id);
                                                        if (success) {
                                                            onClose();
                                                        }
                                                    }
                                                }
                                            ]
                                        );
                                    }}
                                >
                                    <Ionicons name="person-remove-outline" size={18} color={colors.textSecondary} />
                                    <Text style={[styles.nudgeText, { color: colors.textSecondary }]}>Remove Friend</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </ScrollView>
            </View>
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 16,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 1,
        fontFamily: 'Lexend',
    },
    modalSubtitle: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1.5,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2,
    },
    content: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderWidth: 3,
        marginBottom: 16,
        overflow: 'hidden',
    },
    avatarImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
    },
    avatarText: {
        fontSize: 40,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.5)',
    },
    username: {
        fontSize: 28,
        fontWeight: '800',
        fontFamily: 'Lexend',
    },
    email: {
        fontSize: 14,
        marginTop: 4,
        fontFamily: 'Lexend_400Regular',
    },
    bio: {
        fontSize: 13,
        marginTop: 8,
        textAlign: 'center',
        fontStyle: 'italic',
        fontFamily: 'Lexend_400Regular',
    },
    profileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
    },
    infoText: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 20,
    },
    progressCard: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        position: 'relative',
    },
    progressCenter: {
        position: 'absolute',
        alignItems: 'center',
    },
    progressValue: {
        fontSize: 32,
        fontWeight: '900',
        fontFamily: 'Lexend',
    },
    progressLabel: {
        fontSize: 10,
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
    },
    quickStats: {
        flex: 1,
        gap: 12,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '800',
        marginTop: 4,
        fontFamily: 'Lexend',
    },
    statLabel: {
        fontSize: 9,
        letterSpacing: 0.5,
        marginTop: 2,
        fontFamily: 'Lexend_400Regular',
    },
    weeklyCard: {
        padding: 20,
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 11,
        letterSpacing: 1,
        marginBottom: 16,
        fontFamily: 'Lexend_400Regular',
    },
    weekDays: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    dayColumn: {
        alignItems: 'center',
        gap: 8,
    },
    dayDot: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayLabel: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
    },
    actions: {
        marginTop: 24,
        paddingBottom: 20,
    },
    nudgeButton: {
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
    },
    nudgeText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    previewText: {
        fontSize: 13,
        fontStyle: 'italic',
        textAlign: 'center',
        fontFamily: 'Lexend_400Regular',
    },
});
