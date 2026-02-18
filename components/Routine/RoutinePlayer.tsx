import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    SafeAreaView, Dimensions, Vibration,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useRoutines, RoutineHabit } from '@/constants/RoutineContext';
import { useFocusTime } from '@/constants/FocusTimeContext';
import { SessionRatingCard } from '@/components/Timer/SessionRatingCard';
import { supabase } from '@/lib/supabase';
import Animated, {
    FadeIn, FadeInDown, FadeInUp, FadeOut,
    useSharedValue, useAnimatedStyle, withSpring, withTiming,
    withRepeat, withSequence, Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { VoidShell } from '@/components/Layout/VoidShell';

// ============================================
// Routine Player — Full-Screen Execution View
// Chains habits sequentially with timers
// ============================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const RING_SIZE = 220;
const STROKE_WIDTH = 10;

export const RoutinePlayer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const {
        activeRoutine, activeRoutineSession, currentHabitIndex,
        completeCurrentHabit, skipCurrentHabit, endRoutine,
        isRoutineRunning,
    } = useRoutines();
    const focusTime = useFocusTime();

    const [showRating, setShowRating] = useState(false);
    const [routineComplete, setRoutineComplete] = useState(false);

    // Animation values
    const pulseScale = useSharedValue(1);
    const celebrationOpacity = useSharedValue(0);

    useEffect(() => {
        // Subtle pulse animation
        pulseScale.value = withRepeat(
            withSequence(
                withTiming(1.02, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
            ), -1, true
        );
    }, []);

    // Watch for timer completion to trigger rating
    useEffect(() => {
        if (activeRoutine && !focusTime.isRunning && !focusTime.isPaused && focusTime.timeLeft === 0 && currentHabitIndex >= 0) {
            // Timer finished naturally — show rating
            const currentHabit = activeRoutine.habits[currentHabitIndex];
            if (currentHabit && !showRating && !routineComplete) {
                setShowRating(true);
                Vibration.vibrate([0, 100, 50, 100, 50, 200]); // Session complete haptic
            }
        }
    }, [focusTime.isRunning, focusTime.timeLeft, focusTime.isPaused]);

    // Detect routine completion
    useEffect(() => {
        if (activeRoutineSession && !isRoutineRunning && activeRoutineSession.completedHabits > 0) {
            setRoutineComplete(true);
            celebrationOpacity.value = withTiming(1, { duration: 500 });
        }
    }, [isRoutineRunning]);

    const currentHabit = activeRoutine?.habits?.[currentHabitIndex];

    const handleRate = async (rating: number) => {
        // Save rating to current focus session
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && currentHabit) {
                // Update the most recent focus session
                const { data: sessions } = await supabase
                    .from('focus_sessions')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('habit_id', currentHabit.habitId)
                    .order('started_at', { ascending: false })
                    .limit(1);

                if (sessions?.[0]) {
                    await supabase
                        .from('focus_sessions')
                        .update({ quality_rating: rating })
                        .eq('id', sessions[0].id);
                }
            }
        } catch (err) {
            console.error('[RoutinePlayer] Rate error:', err);
        }

        setShowRating(false);
        // Advance to next habit
        completeCurrentHabit();
    };

    const handleSkipRating = () => {
        setShowRating(false);
        completeCurrentHabit();
    };

    const handleEndRoutine = () => {
        endRoutine();
        onClose();
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    // Progress ring calculations
    const progress = focusTime.totalDuration > 0
        ? 1 - (focusTime.timeLeft / focusTime.totalDuration)
        : 0;
    const circumference = Math.PI * 2 * ((RING_SIZE - STROKE_WIDTH) / 2);
    const strokeDashoffset = circumference * (1 - progress);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
    }));

    const celebrationStyle = useAnimatedStyle(() => ({
        opacity: celebrationOpacity.value,
    }));

    if (!activeRoutine) return null;

    // ============================================
    // Routine Complete Celebration
    // ============================================
    if (routineComplete) {
        return (
            <VoidShell>
                <SafeAreaView style={styles.fullScreen}>
                    <Animated.View style={[styles.celebrationContainer, celebrationStyle]}>
                        <Animated.Text
                            entering={FadeInDown.delay(200).springify()}
                            style={styles.celebrationEmoji}
                        >
                            🎉
                        </Animated.Text>
                        <Animated.Text
                            entering={FadeInDown.delay(400).springify()}
                            style={[styles.celebrationTitle, { color: colors.textPrimary }]}
                        >
                            Routine Complete!
                        </Animated.Text>
                        <Animated.Text
                            entering={FadeInDown.delay(600).springify()}
                            style={[styles.celebrationSubtitle, { color: colors.textSecondary }]}
                        >
                            {activeRoutine.emoji} {activeRoutine.name}
                        </Animated.Text>

                        <Animated.View
                            entering={FadeInUp.delay(800).springify()}
                            style={styles.celebrationStats}
                        >
                            <View style={[styles.statPill, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                                <Text style={[styles.statValue, { color: colors.primary }]}>
                                    {activeRoutineSession?.completedHabits || 0}
                                </Text>
                                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                                    Habits
                                </Text>
                            </View>
                            <View style={[styles.statPill, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                                <Text style={[styles.statValue, { color: colors.primary }]}>
                                    {Math.round((activeRoutineSession?.totalFocusTime || 0) / 60)}m
                                </Text>
                                <Text style={[styles.statLabel, { color: colors.textTertiary }]}>
                                    Focus
                                </Text>
                            </View>
                        </Animated.View>

                        <Animated.View entering={FadeInUp.delay(1000).springify()}>
                            <TouchableOpacity
                                onPress={handleEndRoutine}
                                style={[styles.doneButton, { backgroundColor: colors.primary }]}
                            >
                                <Text style={styles.doneButtonText}>Done</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </Animated.View>
                </SafeAreaView>
            </VoidShell>
        );
    }

    // ============================================
    // Active Session View
    // ============================================
    return (
        <VoidShell>
            <SafeAreaView style={styles.fullScreen}>
                {/* Header */}
                <View style={styles.playerHeader}>
                    <TouchableOpacity onPress={handleEndRoutine} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                        <Ionicons name="close" size={24} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center' }}>
                        <Text style={[styles.routineTitle, { color: colors.textPrimary }]}>
                            {activeRoutine.emoji} {activeRoutine.name}
                        </Text>
                        <Text style={[styles.routineProgress, { color: colors.textTertiary }]}>
                            {currentHabitIndex + 1} of {activeRoutine.habits.length}
                        </Text>
                    </View>
                    <View style={{ width: 24 }} />
                </View>

                {/* Progress Dots */}
                <View style={styles.progressDots}>
                    {activeRoutine.habits.map((h, i) => (
                        <View
                            key={h.id}
                            style={[
                                styles.dot,
                                {
                                    backgroundColor: i < currentHabitIndex
                                        ? '#22C55E'
                                        : i === currentHabitIndex
                                            ? colors.primary
                                            : 'rgba(255,255,255,0.15)',
                                    width: i === currentHabitIndex ? 24 : 8,
                                },
                            ]}
                        />
                    ))}
                </View>

                {/* Rating Overlay */}
                {showRating && currentHabit && (
                    <View style={styles.ratingOverlay}>
                        <SessionRatingCard
                            habitName={currentHabit.habitName}
                            duration={currentHabit.focusDuration}
                            onRate={handleRate}
                            onSkip={handleSkipRating}
                            visible={showRating}
                        />
                    </View>
                )}

                {/* Timer Ring */}
                {!showRating && currentHabit && (
                    <Animated.View style={[styles.timerContainer, pulseStyle]}>
                        {/* Current habit info */}
                        <Text style={styles.habitEmoji}>{currentHabit.habitEmoji}</Text>
                        <Text style={[styles.habitName, { color: colors.textPrimary }]}>
                            {currentHabit.habitName}
                        </Text>

                        {/* Ring */}
                        <View style={styles.ringContainer}>
                            <Svg width={RING_SIZE} height={RING_SIZE}>
                                <Defs>
                                    <LinearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
                                        <Stop offset="0" stopColor={colors.primary} stopOpacity="1" />
                                        <Stop offset="1" stopColor={currentHabit.habitColor || '#6366F1'} stopOpacity="1" />
                                    </LinearGradient>
                                </Defs>
                                {/* Background ring */}
                                <Circle
                                    cx={RING_SIZE / 2}
                                    cy={RING_SIZE / 2}
                                    r={(RING_SIZE - STROKE_WIDTH) / 2}
                                    fill="none"
                                    stroke="rgba(255,255,255,0.06)"
                                    strokeWidth={STROKE_WIDTH}
                                />
                                {/* Progress ring */}
                                <Circle
                                    cx={RING_SIZE / 2}
                                    cy={RING_SIZE / 2}
                                    r={(RING_SIZE - STROKE_WIDTH) / 2}
                                    fill="none"
                                    stroke="url(#ringGrad)"
                                    strokeWidth={STROKE_WIDTH}
                                    strokeLinecap="round"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    rotation="-90"
                                    origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                                />
                            </Svg>

                            {/* Timer text inside ring */}
                            <View style={styles.ringCenter}>
                                <Text style={[styles.timerText, { color: colors.textPrimary }]}>
                                    {formatTime(focusTime.timeLeft)}
                                </Text>
                                <Text style={[styles.modeLabel, { color: colors.textTertiary }]}>
                                    {currentHabit.timerMode.replace('_', ' ').toUpperCase()}
                                </Text>
                            </View>
                        </View>

                        {/* Controls */}
                        <View style={styles.controls}>
                            <TouchableOpacity
                                onPress={skipCurrentHabit}
                                style={[styles.controlBtn, { backgroundColor: 'rgba(255,255,255,0.05)' }]}
                            >
                                <Ionicons name="play-skip-forward" size={20} color={colors.textSecondary} />
                                <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>Skip</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={focusTime.isPaused ? focusTime.resumeTimer : focusTime.pauseTimer}
                                style={[styles.mainControlBtn, { backgroundColor: colors.primary }]}
                            >
                                <Ionicons
                                    name={focusTime.isPaused ? 'play' : 'pause'}
                                    size={28}
                                    color="#000"
                                />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    focusTime.stopTimer();
                                    setShowRating(true);
                                }}
                                style={[styles.controlBtn, { backgroundColor: 'rgba(255,255,255,0.05)' }]}
                            >
                                <Ionicons name="stop" size={20} color={colors.textSecondary} />
                                <Text style={[styles.controlLabel, { color: colors.textSecondary }]}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </Animated.View>
                )}

                {/* Upcoming habits */}
                {!showRating && !routineComplete && (
                    <Animated.View entering={FadeIn.delay(300)} style={styles.upcomingContainer}>
                        <Text style={[styles.upcomingLabel, { color: colors.textTertiary }]}>
                            COMING UP
                        </Text>
                        {activeRoutine.habits.slice(currentHabitIndex + 1, currentHabitIndex + 4).map((h) => (
                            <View key={h.id} style={styles.upcomingRow}>
                                <Text style={{ fontSize: 16 }}>{h.habitEmoji}</Text>
                                <Text style={[styles.upcomingName, { color: colors.textSecondary }]} numberOfLines={1}>
                                    {h.habitName}
                                </Text>
                                <Text style={[styles.upcomingDuration, { color: colors.textTertiary }]}>
                                    {Math.round(h.focusDuration / 60)}m
                                </Text>
                            </View>
                        ))}
                    </Animated.View>
                )}
            </SafeAreaView>
        </VoidShell>
    );
};

const styles = StyleSheet.create({
    fullScreen: {
        flex: 1,
    },
    playerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
    },
    routineTitle: {
        fontSize: 15,
        fontFamily: 'Lexend',
        fontWeight: '600',
    },
    routineProgress: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2,
    },
    progressDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        marginBottom: 20,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    ratingOverlay: {
        flex: 1,
        justifyContent: 'center',
    },
    timerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 20,
    },
    habitEmoji: {
        fontSize: 40,
        marginBottom: 8,
    },
    habitName: {
        fontSize: 18,
        fontFamily: 'Lexend',
        fontWeight: '700',
        marginBottom: 24,
    },
    ringContainer: {
        width: RING_SIZE,
        height: RING_SIZE,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
    },
    ringCenter: {
        position: 'absolute',
        alignItems: 'center',
    },
    timerText: {
        fontSize: 42,
        fontFamily: 'Lexend',
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    modeLabel: {
        fontSize: 9,
        fontFamily: 'Lexend_400Regular',
        letterSpacing: 2,
        marginTop: 4,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
    },
    controlBtn: {
        alignItems: 'center',
        padding: 14,
        borderRadius: 16,
        minWidth: 64,
    },
    controlLabel: {
        fontSize: 10,
        fontFamily: 'Lexend_400Regular',
        marginTop: 4,
    },
    mainControlBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    upcomingContainer: {
        paddingHorizontal: 24,
        paddingBottom: 20,
    },
    upcomingLabel: {
        fontSize: 10,
        fontFamily: 'Lexend_400Regular',
        letterSpacing: 2,
        marginBottom: 10,
    },
    upcomingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        gap: 10,
    },
    upcomingName: {
        flex: 1,
        fontSize: 13,
        fontFamily: 'Lexend_400Regular',
    },
    upcomingDuration: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
    },
    // Celebration
    celebrationContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    celebrationEmoji: {
        fontSize: 72,
        marginBottom: 16,
    },
    celebrationTitle: {
        fontSize: 28,
        fontFamily: 'Lexend',
        fontWeight: '800',
        marginBottom: 8,
    },
    celebrationSubtitle: {
        fontSize: 16,
        fontFamily: 'Lexend_400Regular',
        marginBottom: 32,
    },
    celebrationStats: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 40,
    },
    statPill: {
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 28,
        borderRadius: 16,
    },
    statValue: {
        fontSize: 24,
        fontFamily: 'Lexend',
        fontWeight: '700',
    },
    statLabel: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
        marginTop: 4,
    },
    doneButton: {
        paddingVertical: 16,
        paddingHorizontal: 48,
        borderRadius: 16,
    },
    doneButtonText: {
        color: '#000',
        fontSize: 16,
        fontFamily: 'Lexend',
        fontWeight: '700',
    },
});
