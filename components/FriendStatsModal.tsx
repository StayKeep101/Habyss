import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Modal, Dimensions, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    Easing,
    runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Friend, FriendsService } from '@/lib/friendsService';
import Svg, { Circle } from 'react-native-svg';

const { height, width } = Dimensions.get('window');
const SHEET_HEIGHT = height * 0.75;
const DRAG_THRESHOLD = 100;

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
    const [isOpen, setIsOpen] = useState(false);
    const [detailedStats, setDetailedStats] = useState<FriendDetailedStats | null>(null);
    const [loading, setLoading] = useState(false);

    const translateY = useSharedValue(SHEET_HEIGHT);
    const backdropOpacity = useSharedValue(0);
    const contentOpacity = useSharedValue(0);

    const openModal = useCallback(() => {
        setIsOpen(true);
        translateY.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) });
        backdropOpacity.value = withTiming(1, { duration: 300 });
        contentOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    }, []);

    const closeModal = useCallback(() => {
        contentOpacity.value = withTiming(0, { duration: 150 });
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 300, easing: Easing.in(Easing.cubic) });
        backdropOpacity.value = withTiming(0, { duration: 250 });
        setTimeout(() => { setIsOpen(false); onClose(); }, 300);
    }, [onClose]);

    useEffect(() => {
        if (visible && !isOpen) {
            openModal();
            // Load detailed stats when modal opens
            if (friend) {
                loadDetailedStats(friend.id);
            }
        } else if (!visible && isOpen) {
            closeModal();
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

    const backdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const sheetStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const contentStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
    }));

    const panGesture = Gesture.Pan()
        .onUpdate((e) => {
            if (e.translationY > 0) {
                translateY.value = e.translationY;
            }
        })
        .onEnd((e) => {
            if (e.translationY > DRAG_THRESHOLD) {
                runOnJS(closeModal)();
            } else {
                translateY.value = withTiming(0, { duration: 200 });
            }
        });

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
        <Modal visible={isOpen || visible} transparent animationType="none" onRequestClose={closeModal}>
            <View style={styles.container}>
                {/* Backdrop */}
                <Animated.View style={[styles.backdrop, backdropStyle]}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeModal} activeOpacity={1} />
                </Animated.View>

                {/* Sheet */}
                <GestureDetector gesture={panGesture}>
                    <Animated.View style={[styles.sheet, sheetStyle]}>
                        <LinearGradient
                            colors={['#0f1218', '#080a0e']}
                            style={styles.sheetGradient}
                        >
                            {/* Drag Handle */}
                            <View style={styles.handleContainer}>
                                <View style={[styles.handle, { backgroundColor: colors.surfaceSecondary }]} />
                            </View>

                            <Animated.View style={[styles.content, contentStyle]}>
                                {/* Header with Avatar */}
                                <View style={styles.header}>
                                    <View style={[styles.avatarLarge, { borderColor: colors.primary, backgroundColor: colors.surfaceSecondary }]}>
                                        {friend.avatarUrl ? (
                                            <Image source={{ uri: friend.avatarUrl }} style={styles.avatarImage} />
                                        ) : (
                                            <Text style={[styles.avatarText, { color: 'rgba(255,255,255,0.5)' }]}>
                                                {friend.username[0]?.toUpperCase()}
                                            </Text>
                                        )}
                                    </View>
                                    <Text style={[styles.username, { color: '#fff' }]}>{friend.username}</Text>
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
                                            <Text style={[styles.statValue, { color: '#fff' }]}>{streak}</Text>
                                            <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.7)' }]}>DAY STREAK</Text>
                                        </VoidCard>
                                        <VoidCard glass style={styles.statCard}>
                                            <Ionicons name="trophy" size={28} color="#F97316" />
                                            <Text style={[styles.statValue, { color: '#fff' }]}>{detailedStats?.longestStreak || streak}</Text>
                                            <Text style={[styles.statLabel, { color: 'rgba(255,255,255,0.7)' }]}>BEST STREAK</Text>
                                        </VoidCard>
                                    </View>
                                </View>

                                {/* Weekly Activity */}
                                <VoidCard glass style={styles.weeklyCard}>
                                    <Text style={[styles.sectionTitle, { color: 'rgba(255,255,255,0.7)' }]}>THIS WEEK'S ACTIVITY</Text>
                                    <View style={styles.weekDays}>
                                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => {
                                            const isActive = detailedStats?.weeklyActivity[i] ?? Math.random() > 0.3;
                                            const isToday = i === new Date().getDay() - 1 || (i === 6 && new Date().getDay() === 0);
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
                                                    <Text style={[styles.dayLabel, { color: isToday ? colors.primary : 'rgba(255,255,255,0.5)' }]}>
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
                                        <TouchableOpacity
                                            style={[styles.nudgeButton, { backgroundColor: colors.primary, flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
                                            onPress={() => {
                                                onNudge(friend);
                                                closeModal();
                                            }}
                                        >
                                            <Text style={styles.nudgeText}>👋 Send Nudge</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </Animated.View>
                        </LinearGradient>
                    </Animated.View>
                </GestureDetector>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: SHEET_HEIGHT,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        overflow: 'hidden',
    },
    sheetGradient: {
        flex: 1,
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
    },
    handleContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
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
        marginTop: 'auto',
        paddingBottom: 40,
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
