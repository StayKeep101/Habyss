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

interface PomodoroTimerProps {
    defaultMinutes?: number;
    onComplete?: () => void;
    habitName?: string;
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
    habitName
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';

    // Timer settings
    const [workDuration, setWorkDuration] = useState((defaultMinutes || DEFAULT_WORK) * 60);
    const [shortBreakDuration] = useState(DEFAULT_SHORT_BREAK * 60);
    const [longBreakDuration] = useState(DEFAULT_LONG_BREAK * 60);

    // Timer state
    const [state, setState] = useState<TimerState>('idle');
    const [timeLeft, setTimeLeft] = useState(workDuration);
    const [totalTime, setTotalTime] = useState(workDuration);
    const [completedSessions, setCompletedSessions] = useState(0);
    const [totalFocusTime, setTotalFocusTime] = useState(0);
    const [showSettings, setShowSettings] = useState(false);

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const focusStartRef = useRef<number | null>(null);

    const { successFeedback, mediumFeedback, lightFeedback } = useHaptics();

    // Animated pulse for running state
    const pulseAnim = useSharedValue(1);
    const progressAnim = useSharedValue(0);

    // Update work duration when defaultMinutes changes
    useEffect(() => {
        if (defaultMinutes && state === 'idle') {
            const newDuration = defaultMinutes * 60;
            setWorkDuration(newDuration);
            setTimeLeft(newDuration);
            setTotalTime(newDuration);
        }
    }, [defaultMinutes]);

    // Pulse animation
    useEffect(() => {
        if (state === 'running') {
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
    }, [state]);

    // Progress animation
    useEffect(() => {
        const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) : 0;
        progressAnim.value = withTiming(progress, { duration: 300 });
    }, [timeLeft, totalTime]);

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseAnim.value }],
    }));

    // Timer logic
    useEffect(() => {
        if (state === 'running' || state === 'break' || state === 'longBreak') {
            if (state === 'running' && !focusStartRef.current) {
                focusStartRef.current = Date.now();
            }

            intervalRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(intervalRef.current!);
                        handleTimerComplete();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [state]);

    const handleTimerComplete = useCallback(() => {
        successFeedback();
        Vibration.vibrate([0, 200, 100, 200]);

        if (state === 'running') {
            // Track focus time
            if (focusStartRef.current) {
                const elapsed = Math.floor((Date.now() - focusStartRef.current) / 1000);
                setTotalFocusTime(prev => prev + elapsed);
                focusStartRef.current = null;
            }

            const newSessionCount = completedSessions + 1;
            setCompletedSessions(newSessionCount);

            // Determine break type
            if (newSessionCount % SESSIONS_BEFORE_LONG_BREAK === 0) {
                setState('longBreak');
                setTimeLeft(longBreakDuration);
                setTotalTime(longBreakDuration);
            } else {
                setState('break');
                setTimeLeft(shortBreakDuration);
                setTotalTime(shortBreakDuration);
            }
        } else if (state === 'break' || state === 'longBreak') {
            setState('idle');
            setTimeLeft(workDuration);
            setTotalTime(workDuration);
            onComplete?.();
        }
    }, [state, completedSessions, workDuration, shortBreakDuration, longBreakDuration, onComplete, successFeedback]);

    const handleStart = () => {
        mediumFeedback();
        setState('running');
    };

    const handlePause = () => {
        lightFeedback();
        setState('paused');
        if (intervalRef.current) clearInterval(intervalRef.current);

        // Track partial focus time
        if (focusStartRef.current) {
            const elapsed = Math.floor((Date.now() - focusStartRef.current) / 1000);
            setTotalFocusTime(prev => prev + elapsed);
            focusStartRef.current = null;
        }
    };

    const handleResume = () => {
        lightFeedback();
        setState('running');
    };

    const handleReset = () => {
        lightFeedback();
        if (intervalRef.current) clearInterval(intervalRef.current);
        setState('idle');
        setTimeLeft(workDuration);
        setTotalTime(workDuration);
        focusStartRef.current = null;
    };

    const handleSkipBreak = () => {
        lightFeedback();
        if (intervalRef.current) clearInterval(intervalRef.current);
        setState('idle');
        setTimeLeft(workDuration);
        setTotalTime(workDuration);
    };

    const handleSelectPreset = (minutes: number) => {
        lightFeedback();
        const newDuration = minutes * 60;
        setWorkDuration(newDuration);
        setTimeLeft(newDuration);
        setTotalTime(newDuration);
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

    const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;
    const circumference = 2 * Math.PI * 52;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    const isBreak = state === 'break' || state === 'longBreak';
    const primaryColor = isBreak ? '#10B981' : colors.primary;
    const gradientColors: readonly [string, string] = isBreak
        ? ['#10B981', '#059669']
        : [colors.primary, colors.secondary || colors.primary];

    const getStateLabel = () => {
        switch (state) {
            case 'idle': return 'READY';
            case 'running': return 'FOCUSING';
            case 'paused': return 'PAUSED';
            case 'break': return 'SHORT BREAK';
            case 'longBreak': return 'LONG BREAK';
        }
    };

    return (
        <VoidCard style={[styles.container, isLight && { backgroundColor: colors.surface }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Ionicons name="timer-outline" size={18} color={primaryColor} />
                    <Text style={[styles.title, { color: colors.textSecondary }]}>
                        {habitName ? `FOCUS: ${habitName.toUpperCase()}` : 'POMODORO'}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => setShowSettings(!showSettings)}
                    style={styles.settingsBtn}
                >
                    <Ionicons
                        name={showSettings ? "close" : "settings-outline"}
                        size={18}
                        color={colors.textTertiary}
                    />
                </TouchableOpacity>
            </View>

            {/* Settings Panel */}
            {showSettings && (
                <View style={[styles.settingsPanel, { backgroundColor: isLight ? colors.surfaceSecondary : 'rgba(255,255,255,0.05)' }]}>
                    <Text style={[styles.settingsLabel, { color: colors.textSecondary }]}>Session Length</Text>
                    <View style={styles.presets}>
                        {WORK_PRESETS.map(mins => (
                            <TouchableOpacity
                                key={mins}
                                onPress={() => handleSelectPreset(mins)}
                                style={[
                                    styles.presetBtn,
                                    {
                                        backgroundColor: workDuration === mins * 60
                                            ? primaryColor
                                            : (isLight ? colors.surfaceTertiary : 'rgba(255,255,255,0.1)'),
                                    }
                                ]}
                            >
                                <Text style={[
                                    styles.presetText,
                                    { color: workDuration === mins * 60 ? '#fff' : colors.textSecondary }
                                ]}>
                                    {mins}m
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* Timer Display */}
            <Animated.View style={[styles.timerContainer, pulseStyle]}>
                <Svg width={140} height={140} style={styles.progressRing}>
                    {/* Background Circle */}
                    <Circle
                        cx={70}
                        cy={70}
                        r={52}
                        stroke={isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)'}
                        strokeWidth={10}
                        fill="none"
                    />
                    {/* Progress Circle */}
                    <Circle
                        cx={70}
                        cy={70}
                        r={52}
                        stroke={primaryColor}
                        strokeWidth={10}
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        rotation="-90"
                        origin="70, 70"
                    />
                </Svg>

                <View style={styles.timeDisplay}>
                    <Text style={[styles.timeText, { color: colors.textPrimary }]}>
                        {formatTime(timeLeft)}
                    </Text>
                    <Text style={[styles.stateText, { color: primaryColor }]}>
                        {getStateLabel()}
                    </Text>
                </View>
            </Animated.View>

            {/* Session Stats */}
            <View style={styles.stats}>
                <View style={styles.statItem}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{completedSessions}</Text>
                    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>sessions</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                    <Ionicons name="time" size={14} color={colors.primary} />
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                        {formatFocusTime(totalFocusTime + (state === 'running' && focusStartRef.current
                            ? Math.floor((Date.now() - focusStartRef.current) / 1000)
                            : 0))}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>focused</Text>
                </View>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                {state === 'idle' && (
                    <TouchableOpacity onPress={handleStart} activeOpacity={0.8}>
                        <LinearGradient colors={gradientColors} style={styles.mainButton}>
                            <Ionicons name="play" size={28} color="white" />
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {state === 'running' && (
                    <View style={styles.runningControls}>
                        <TouchableOpacity onPress={handleReset} style={[styles.secondaryButton, { borderColor: colors.border }]}>
                            <Ionicons name="refresh" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handlePause} activeOpacity={0.8}>
                            <LinearGradient colors={gradientColors} style={styles.mainButton}>
                                <Ionicons name="pause" size={28} color="white" />
                            </LinearGradient>
                        </TouchableOpacity>
                        <View style={styles.placeholderBtn} />
                    </View>
                )}

                {state === 'paused' && (
                    <View style={styles.runningControls}>
                        <TouchableOpacity onPress={handleReset} style={[styles.secondaryButton, { borderColor: colors.border }]}>
                            <Ionicons name="refresh" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleResume} activeOpacity={0.8}>
                            <LinearGradient colors={gradientColors} style={styles.mainButton}>
                                <Ionicons name="play" size={28} color="white" />
                            </LinearGradient>
                        </TouchableOpacity>
                        <View style={styles.placeholderBtn} />
                    </View>
                )}

                {(state === 'break' || state === 'longBreak') && (
                    <View style={styles.breakControls}>
                        <TouchableOpacity
                            onPress={handleSkipBreak}
                            style={[styles.skipButton, { borderColor: colors.border }]}
                        >
                            <Ionicons name="play-skip-forward" size={16} color={colors.textSecondary} />
                            <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip Break</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Progress Dots */}
            <View style={styles.progressDots}>
                {Array.from({ length: SESSIONS_BEFORE_LONG_BREAK }).map((_, i) => (
                    <View
                        key={i}
                        style={[
                            styles.dot,
                            {
                                backgroundColor: i < (completedSessions % SESSIONS_BEFORE_LONG_BREAK) ||
                                    (i === 0 && completedSessions > 0 && completedSessions % SESSIONS_BEFORE_LONG_BREAK === 0)
                                    ? colors.success
                                    : (isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)'),
                            }
                        ]}
                    />
                ))}
            </View>
        </VoidCard>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 16,
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
        width: 140,
        height: 140,
        justifyContent: 'center',
        alignItems: 'center',
    },
    progressRing: {
        position: 'absolute',
    },
    timeDisplay: {
        alignItems: 'center',
    },
    timeText: {
        fontSize: 36,
        fontWeight: '900',
        fontFamily: 'Lexend',
        letterSpacing: -1,
    },
    stateText: {
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.5,
        marginTop: 2,
        fontFamily: 'Lexend',
    },
    stats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
        gap: 16,
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
        height: 16,
    },
    controls: {
        marginTop: 20,
        alignItems: 'center',
    },
    mainButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    runningControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
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
        gap: 8,
        marginTop: 20,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});
