import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions, ScrollView, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Friend, FriendsService } from '@/lib/friendsService';
import Svg, { Circle } from 'react-native-svg';
import { VoidModal } from '@/components/Layout/VoidModal';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing, withSpring } from 'react-native-reanimated';

import { useAccentGradient } from '@/constants/AccentContext';

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
    const isLight = theme === 'light';
    const { primary: accentColor, colors: accentColors } = useAccentGradient();

    const [detailedStats, setDetailedStats] = useState<FriendDetailedStats | null>(null);
    const [loading, setLoading] = useState(false);

    // Animations
    const pulseScale = useSharedValue(1);
    const avatarGlow = useSharedValue(0.5);

    useEffect(() => {
        if (visible) {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.05, { duration: 1000 }),
                    withTiming(1, { duration: 1000 })
                ),
                -1,
                true
            );

            avatarGlow.value = withRepeat(
                withSequence(
                    withTiming(0.8, { duration: 2000 }),
                    withTiming(0.4, { duration: 2000 })
                ),
                -1,
                true
            );
        }
    }, [visible]);

    const animatedPulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }]
    }));

    const animatedGlowStyle = useAnimatedStyle(() => ({
        opacity: avatarGlow.value
    }));

    useEffect(() => {
        if (visible && friend) {
            loadDetailedStats(friend.id);
        }
    }, [visible, friend]);

    const loadDetailedStats = async (friendId: string) => {
        setLoading(true);
        try {
            const realStats = await FriendsService.getFriendDetailedStats(friendId);
            if (realStats) {
                setDetailedStats(realStats);
            } else {
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
    const size = 120; // Slightly smaller for better fit
    const strokeWidth = 10;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference - (progressPercent / 100) * circumference;

    return (
        <VoidModal visible={visible} onClose={onClose} heightPercentage={0.88}>
            <View style={{ flex: 1 }}>
                {/* Background Atmosphere */}
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                    <LinearGradient
                        colors={[accentColor, 'transparent']}
                        style={{ width: '100%', height: 300, opacity: 0.1 }}
                        start={{ x: 0.5, y: 0 }}
                        end={{ x: 0.5, y: 1 }}
                    />
                </View>

                {/* Header with Menu */}
                <View style={styles.modalHeader}>
                    <TouchableOpacity onPress={onClose} style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                        <Ionicons name="close" size={20} color={colors.textPrimary} />
                    </TouchableOpacity>

                    {/* More Menu (Remove Friend) */}
                    {friend.username !== 'You' && (
                        <TouchableOpacity
                            style={[styles.iconButton, { backgroundColor: 'rgba(255,255,255,0.05)' }]}
                            onPress={() => {
                                Alert.alert(
                                    'Manage Friendship',
                                    `Options for ${friend.username}`,
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Remove Friend',
                                            style: 'destructive',
                                            onPress: async () => {
                                                const success = await FriendsService.removeFriend(friend.id);
                                                if (success) onClose();
                                            }
                                        }
                                    ]
                                );
                            }}
                        >
                            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textPrimary} />
                        </TouchableOpacity>
                    )}
                </View>

                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    {/* Immersive Profile Header */}
                    <View style={styles.profileHeader}>
                        {/* Animated Glow Ring */}
                        <Animated.View style={[styles.glowRing, { borderColor: accentColor }, animatedGlowStyle]} />

                        <View style={[styles.avatarContainer, { borderColor: accentColor }]}>
                            {friend.avatarUrl ? (
                                <Image source={{ uri: friend.avatarUrl }} style={styles.avatarImage} />
                            ) : (
                                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Text style={[styles.avatarText, { color: colors.textSecondary }]}>
                                        {friend.username[0]?.toUpperCase()}
                                    </Text>
                                </View>
                            )}
                        </View>

                        <Text style={[styles.username, { color: colors.textPrimary }]}>{friend.username}</Text>

                        {/* Level / Status Badge */}
                        <View style={[styles.statusBadge, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                            <Ionicons name="shield-checkmark" size={12} color={accentColor} />
                            <Text style={[styles.statusText, { color: colors.textSecondary }]}>Level {Math.floor((friend.currentStreak || 0) / 7) + 1} Explorer</Text>
                        </View>
                    </View>

                    {/* Stats HUD */}
                    <View style={styles.hudContainer}>
                        {/* Left: Focus Circle */}
                        <View style={styles.hudItem}>
                            <Svg width={size} height={size}>
                                <Circle
                                    stroke="rgba(255,255,255,0.1)"
                                    fill="none"
                                    cx={size / 2}
                                    cy={size / 2}
                                    r={radius}
                                    strokeWidth={strokeWidth}
                                />
                                <Circle
                                    stroke={accentColor}
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
                                <Text style={[styles.hudValue, { color: colors.textPrimary }]}>{progressPercent}%</Text>
                                <Text style={[styles.hudLabel, { color: colors.textTertiary }]}>DAILY</Text>
                            </View>
                        </View>

                        {/* Right: Streak & Best */}
                        <View style={styles.hudStats}>
                            <VoidCard glass intensity={30} style={styles.statBox}>
                                <Ionicons name="flame" size={24} color="#FFD700" />
                                <View>
                                    <Text style={[styles.boxValue, { color: colors.textPrimary }]}>{streak}</Text>
                                    <Text style={[styles.boxLabel, { color: colors.textTertiary }]}>CURR. STREAK</Text>
                                </View>
                            </VoidCard>

                            <VoidCard glass intensity={30} style={styles.statBox}>
                                <Ionicons name="trophy" size={24} color="#C0C0C0" />
                                <View>
                                    <Text style={[styles.boxValue, { color: colors.textPrimary }]}>{detailedStats?.longestStreak || streak}</Text>
                                    <Text style={[styles.boxLabel, { color: colors.textTertiary }]}>BEST STREAK</Text>
                                </View>
                            </VoidCard>
                        </View>
                    </View>

                    {/* Weekly Heatmap Strip */}
                    <View style={styles.activitySection}>
                        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>RECENT ACTIVITY</Text>
                        <View style={styles.heatmapStrip}>
                            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                                const isActive = detailedStats?.weeklyActivity?.[i] ?? false;
                                return (
                                    <View key={i} style={styles.heatmapColumn}>
                                        <View style={[
                                            styles.heatmapBlock,
                                            {
                                                backgroundColor: isActive ? accentColor : 'rgba(255,255,255,0.05)',
                                                opacity: isActive ? 1 : 0.3
                                            }
                                        ]} />
                                        <Text style={[styles.heatmapLabel, { color: colors.textTertiary }]}>{day}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>

                    {/* Nudge Action */}
                    {friend.username !== 'You' && (
                        <Animated.View style={[styles.actionContainer, animatedPulseStyle]}>
                            <TouchableOpacity
                                onPress={() => {
                                    onNudge(friend);
                                    // Could show a success animation here before closing
                                    onClose();
                                }}
                            >
                                <LinearGradient
                                    colors={accentColors}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.nudgeBtn}
                                >
                                    <Ionicons name="hand-right" size={24} color="#FFF" />
                                    <Text style={styles.nudgeText}>SEND NUDGE</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </Animated.View>
                    )}
                </ScrollView>
            </View>
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        zIndex: 10,
    },
    iconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingBottom: 40,
    },
    profileHeader: {
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 30,
    },
    glowRing: {
        position: 'absolute',
        width: 140,
        height: 140,
        borderRadius: 70,
        borderWidth: 2,
        top: -10,
    },
    avatarContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 2,
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 60,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 48,
        fontWeight: 'bold',
    },
    username: {
        fontSize: 28,
        fontWeight: '900',
        fontFamily: 'Lexend',
        marginTop: 16,
        letterSpacing: -1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 8,
        gap: 6,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        fontFamily: 'Lexend_400Regular',
    },
    hudContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        gap: 20,
        marginBottom: 30,
    },
    hudItem: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressCenter: {
        position: 'absolute',
        alignItems: 'center',
    },
    hudValue: {
        fontSize: 24,
        fontWeight: '900',
        fontFamily: 'Lexend',
    },
    hudLabel: {
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 1,
    },
    hudStats: {
        flex: 1,
        gap: 12,
    },
    statBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 12,
        borderRadius: 16,
    },
    boxValue: {
        fontSize: 18,
        fontWeight: '800',
        fontFamily: 'Lexend',
    },
    boxLabel: {
        fontSize: 9,
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    activitySection: {
        paddingHorizontal: 24,
        marginBottom: 40,
    },
    sectionTitle: {
        fontSize: 10,
        fontWeight: 'bold',
        letterSpacing: 1.5,
        marginBottom: 12,
        fontFamily: 'Lexend_400Regular',
    },
    heatmapStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        height: 60,
        alignItems: 'flex-end',
    },
    heatmapColumn: {
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    heatmapBlock: {
        width: '80%',
        height: 40,
        borderRadius: 6,
    },
    heatmapLabel: {
        fontSize: 10,
        fontWeight: '600',
        fontFamily: 'Lexend_400Regular',
    },
    actionContainer: {
        paddingHorizontal: 40,
        alignItems: 'center',
    },
    nudgeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 30,
        gap: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    nudgeText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 1,
        fontFamily: 'Lexend',
    }
});
