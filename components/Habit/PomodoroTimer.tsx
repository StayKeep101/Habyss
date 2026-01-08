import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    Easing,
    cancelAnimation,
    interpolate,
} from 'react-native-reanimated';
import { useTimer } from '@/contexts/TimerContext';

interface PomodoroTimerProps {
    defaultMinutes?: number;
    onComplete?: () => void;
    habitName?: string;
    noCard?: boolean;
    habitId?: string; // Optional for generic timer
}

type TimerState = 'idle' | 'running' | 'paused' | 'break' | 'longBreak';

// Default intervals (in minutes)
const DEFAULT_WORK = 25;
const DEFAULT_SHORT_BREAK = 5;
const DEFAULT_LONG_BREAK = 15;
const SESSIONS_BEFORE_LONG_BREAK = 4;

// Preset durations for quick selection
const WORK_PRESETS = [15, 25, 30, 45, 60];

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
    defaultMinutes,
    onComplete,
    habitName,
    noCard,
    habitId // Added prop to link to specific habit
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const {
        timerState,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        skipBreak,
        isTimerActiveFor
    } = useTimer();

    const { successFeedback, mediumFeedback, lightFeedback } = useHaptics();

    // Local UI state for settings (work duration)
    // Note: Global context has duration, but we might want to default to prop if idle
    const [localWorkDuration, setLocalWorkDuration] = useState((defaultMinutes || 25) * 60);
    const [showSettings, setShowSettings] = useState(false);

    // Animated pulse for running state
    const pulseAnim = useSharedValue(1);
    const progressAnim = useSharedValue(0);

    // Determine if THIS specific timer component is active or if we are idle (and can start)
    // If habitId is provided, we check if global timer matches.
    // If global timer is running for ANOTHER habit, this one should probably show "Start" which would replace it?
    // Or simpler: We always show the GLOBAL state if it matches this habitId. 
    // If it doesn't match, we show "Start" (Idle state).

    // Derived state from context
    const isActive = habitId ? isTimerActiveFor(habitId) : false;
    // If no habitId passed (generic timer?), we might just show global state?
    // User flow: "When a timer is on you cannot start another one."
    // So if global timer is running for Habit A, and we are viewing Habit B:
    // We should probably show "Timer Active: Habit A" or disable start?
    // Or just let startTimer override it (as implemented in context).

    // For rendering, if this is THE active habit, use global state.
    // If not active (idle or another habit is running), show IDLE state for THIS habit.

    // What if habitId is undefined? (Generic usage?)
    // Let's assume habitId is required for proper "Global" behavior as per requirements.
    // If not provided, we might fall back to local behavior or just global?
    // Let's enforce habitId usage where possible.

    const displayState = isActive ? timerState.status : 'idle';
    const displayTimeLeft = isActive ? timerState.timeLeft : localWorkDuration;
    const displayTotalTime = isActive ? timerState.totalTime : localWorkDuration;
    const displayCompletedSessions = isActive ? timerState.completedSessions : 0;
    const displayFocusTime = isActive ? timerState.accumulatedFocusTime : 0;

    // Pulse animation
    useEffect(() => {
        if (displayState === 'running') {
            pulseAnim.value = withRepeat(
                withSequence(
                    withTiming(1.02, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
                    withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
                ),
                -1,
                true
            );
        } else {
            cancelAnimation(pulseAnim);
            pulseAnim.value = withTiming(1, { duration: 200 });
        }
        return () => cancelAnimation(pulseAnim);
    }, [displayState]);

    // Progress animation
    useEffect(() => {
        const progress = displayTotalTime > 0 ? ((displayTotalTime - displayTimeLeft) / displayTotalTime) : 0;
        progressAnim.value = withTiming(progress, { duration: 300 });
    }, [displayTimeLeft, displayTotalTime]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseAnim.value }],
    }));

    const handleStart = () => {
        if (!habitId) {
            Alert.alert("Error", "No habit associated with this timer.");
            return;
        }
        // Check if another timer is running
        if (timerState.status !== 'idle' && timerState.habitId !== habitId) {
            Alert.alert(
                "Timer Running",
                `A timer is already running for ${timerState.habitName || 'another habit'}. Start new timer?`,
                [
                    { text: "Cancel", style: "cancel" },
                    {
                        text: "Start New",
                        style: "destructive",
                        onPress: () => startTimer(habitId, habitName || 'Habit', localWorkDuration / 60)
                    }
                ]
            );
        } else {
            startTimer(habitId, habitName || 'Habit', localWorkDuration / 60);
        }
    };

    const handleSelectPreset = (minutes: number) => {
        lightFeedback();
        const newDuration = minutes * 60;
        setLocalWorkDuration(newDuration);
        setShowSettings(false);
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatFocusTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    const progress = displayTotalTime > 0 ? ((displayTotalTime - displayTimeLeft) / displayTotalTime) * 100 : 0;
    const circumference = 2 * Math.PI * 52;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    const isBreak = displayState === 'break' || displayState === 'longBreak';
    const primaryColor = isBreak ? '#10B981' : colors.primary;
    const gradientColors: readonly [string, string] = isBreak
        ? ['#10B981', '#059669']
        : [colors.primary, colors.secondary || colors.primary];

    const getStateLabel = () => {
        switch (displayState) {
            case 'idle': return 'READY';
            case 'running': return 'FOCUSING';
            case 'paused': return 'PAUSED';
            case 'break': return 'SHORT BREAK';
            case 'longBreak': return 'LONG BREAK';
        }
    };

    const Wrapper = noCard ? View : VoidCard;
    const wrapperProps: any = noCard
        ? { style: { alignItems: 'center', width: '100%' } }
        : { style: styles.container };

    return (
        <Wrapper {...wrapperProps}>
            {/* Header */}
            {!noCard && (
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Ionicons name="timer-outline" size={18} color={primaryColor} />
                        <Text style={[styles.title, { color: colors.textSecondary }]}>
                            {habitName && !isActive ? `FOCUS: ${habitName.toUpperCase()}` :
                                isActive ? `FOCUS: ${timerState.habitName?.toUpperCase()}` : 'POMODORO'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setShowSettings(!showSettings)}
                        style={styles.settingsBtn}
                        disabled={displayState !== 'idle'} // Disable settings while running
                    >
                        <Ionicons
                            name={showSettings ? "close" : "settings-outline"}
                            size={18}
                            color={displayState !== 'idle' ? colors.textTertiary + '50' : colors.textTertiary}
                        />
                    </TouchableOpacity>
                </View>
            )}

            {/* Plain Header for noCard */}
            {noCard && (
                <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="timer-outline" size={18} color={colors.textSecondary} />
                        <Text style={[styles.title, { color: colors.textSecondary }]}>POMODORO</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowSettings(!showSettings)} disabled={displayState !== 'idle'}>
                        <Ionicons
                            name="settings-outline"
                            size={20}
                            color={displayState !== 'idle' ? colors.textSecondary + '50' : colors.textSecondary}
                        />
                    </TouchableOpacity>
                </View>
            )}

            {/* Settings Panel */}
            {showSettings && (
                <View style={[styles.settingsPanel, { backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}>
                    <Text style={[styles.settingsLabel, { color: colors.textSecondary }]}>WORK DURATION (MIN)</Text>
                    <View style={styles.presets}>
                        {WORK_PRESETS.map(mins => (
                            <TouchableOpacity
                                key={mins}
                                onPress={() => handleSelectPreset(mins)}
                                style={[
                                    styles.presetBtn,
                                    {
                                        backgroundColor: localWorkDuration === mins * 60
                                            ? primaryColor
                                            : (isLight ? colors.surfaceTertiary : 'rgba(255,255,255,0.1)'),
                                        borderWidth: 1,
                                        borderColor: localWorkDuration === mins * 60 ? primaryColor : colors.border
                                    }
                                ]}
                            >
                                <Text style={[
                                    styles.presetText,
                                    { color: localWorkDuration === mins * 60 ? '#fff' : colors.textPrimary }
                                ]}>
                                    {mins}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* Timer Display */}
            <View style={[styles.timerContainer, pulseStyle]}>
                <Svg width={160} height={160} style={styles.progressRing}>
                    <Circle
                        cx={80}
                        cy={80}
                        r={70}
                        stroke={isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}
                        strokeWidth="8"
                        fill="transparent"
                    />
                    <Circle
                        cx={80}
                        cy={80}
                        r={70}
                        stroke={primaryColor}
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        rotation="-90"
                        origin="80, 80"
                    />
                </Svg>

                <View style={styles.timeDisplay}>
                    <Text style={[styles.timeText, { color: colors.textPrimary }]}>
                        {formatTime(displayTimeLeft)}
                    </Text>
                    <Text style={[styles.stateText, { color: displayState === 'running' ? primaryColor : colors.textTertiary }]}>
                        {getStateLabel()}
                    </Text>
                </View>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                {displayState === 'idle' && (
                    <TouchableOpacity onPress={handleStart} activeOpacity={0.8}>
                        <LinearGradient colors={gradientColors} style={styles.mainButton}>
                            <Ionicons name="play" size={32} color="white" style={{ marginLeft: 4 }} />
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {displayState === 'running' && (
                    <View style={styles.runningControls}>
                        <TouchableOpacity onPress={stopTimer} style={[styles.secondaryButton, { borderColor: colors.border }]}>
                            <Ionicons name="stop" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={pauseTimer} activeOpacity={0.8}>
                            <LinearGradient colors={gradientColors} style={styles.mainButton}>
                                <Ionicons name="pause" size={28} color="white" />
                            </LinearGradient>
                        </TouchableOpacity>
                        <View style={styles.placeholderBtn} />
                    </View>
                )}

                {displayState === 'paused' && (
                    <View style={styles.runningControls}>
                        <TouchableOpacity onPress={stopTimer} style={[styles.secondaryButton, { borderColor: colors.border }]}>
                            <Ionicons name="stop" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={resumeTimer} activeOpacity={0.8}>
                            <LinearGradient colors={gradientColors} style={styles.mainButton}>
                                <Ionicons name="play" size={32} color="white" style={{ marginLeft: 4 }} />
                            </LinearGradient>
                        </TouchableOpacity>
                        <View style={styles.placeholderBtn} />
                    </View>
                )}

                {(displayState === 'break' || displayState === 'longBreak') && (
                    <View style={styles.breakControls}>
                        <TouchableOpacity
                            onPress={skipBreak}
                            style={[styles.skipButton, { borderColor: colors.border }]}
                        >
                            <Ionicons name="play-skip-forward" size={16} color={colors.textSecondary} />
                            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip Break</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Session Stats */}
            <View style={styles.stats}>
                <View style={styles.statItem}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{displayCompletedSessions}</Text>
                    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>sessions</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                    <Ionicons name="time" size={14} color={colors.primary} />
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                        {formatFocusTime(displayFocusTime)}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>focused</Text>
                </View>
            </View>
        </Wrapper>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 24,
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 20,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1.5,
        fontFamily: 'Lexend',
    },
    settingsBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingsPanel: {
        width: '100%',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
    },
    settingsLabel: {
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 8,
        fontFamily: 'Lexend_400Regular',
    },
    presets: {
        flexDirection: 'row',
        gap: 8,
    },
    presetBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    presetText: {
        fontSize: 13,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
    timerContainer: {
        width: 160,
        height: 160,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
    },
    progressRing: {
        position: 'absolute',
    },
    timeDisplay: {
        alignItems: 'center',
    },
    timeText: {
        fontSize: 42,
        fontWeight: '900',
        fontFamily: 'Lexend',
        letterSpacing: -1,
    },
    stateText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.5,
        marginTop: 4,
        fontFamily: 'Lexend',
    },
    stats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 16,
        gap: 20,
        opacity: 0.8,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    statLabel: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
    },
    statDivider: {
        width: 1,
        height: 12,
    },
    controls: {
        marginTop: 24,
        alignItems: 'center',
        zIndex: 10,
    },
    mainButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.30,
        shadowRadius: 4.65,
        elevation: 8,
    },
    runningControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 24,
    },
    secondaryButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    placeholderBtn: {
        width: 44,
    },
    breakControls: {
        alignItems: 'center',
    },
    skipButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        borderWidth: 1,
    },
    skipText: {
        fontSize: 13,
        fontWeight: '600',
        fontFamily: 'Lexend',
    },
    progressDots: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 16,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
});
