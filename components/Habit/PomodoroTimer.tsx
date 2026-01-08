import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { useFocusTime } from '@/constants/FocusTimeContext';
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
    habitId?: string; // Required for global context
    noCard?: boolean;
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
    habitId,
    noCard
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';

    // Global focus time context
    const {
        isRunning: globalIsRunning,
        isPaused: globalIsPaused,
        activeHabitId,
        activeHabitName,
        startTimer: globalStartTimer,
        pauseTimer: globalPauseTimer,
        resumeTimer: globalResumeTimer,
        stopTimer: globalStopTimer,
        addFocusTime,
        totalFocusToday,
        sessionsToday,
    } = useFocusTime();

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
        // Check if another timer is running globally
        if ((globalIsRunning || globalIsPaused) && activeHabitId !== habitId) {
            Alert.alert(
                'Timer Already Active',
                `A timer is already running for "${activeHabitName || 'another habit'}". Please stop it first before starting a new one.`,
                [{ text: 'OK' }]
            );
            return;
        }

        mediumFeedback();

        // Start global timer tracking
        if (habitId && habitName) {
            const success = globalStartTimer(habitId, habitName, workDuration);
            if (!success) {
                Alert.alert('Error', 'Failed to start timer. Please try again.');
                return;
            }
        }

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
            addFocusTime(elapsed); // Add to global context
            focusStartRef.current = null;
        }

        globalPauseTimer();
    };

    const handleResume = () => {
        lightFeedback();
        setState('running');
        globalResumeTimer();
    };

    const handleReset = () => {
        lightFeedback();
        if (intervalRef.current) clearInterval(intervalRef.current);
        setState('idle');
        setTimeLeft(workDuration);
        setTotalTime(workDuration);
        focusStartRef.current = null;
        globalStopTimer(); // Stop global tracking
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

    const Wrapper = noCard ? View : VoidCard;
    const noCardStyle = { alignItems: 'center' as const, width: '100%' as `${number}%` };
    const wrapperProps = noCard ? { style: noCardStyle } : { style: styles.container };

    return (
        <Wrapper {...wrapperProps}>
            {/* Header - Hidden if noCard to simplify UI or keep it? User says remove card. */}
            {!noCard && (
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
            )}

            {noCard && (
                <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="timer-outline" size={18} color={colors.textSecondary} />
                        <Text style={[styles.title, { color: colors.textSecondary }]}>POMODORO</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowSettings(!showSettings)}>
                        <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
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
                                onPress={() => {
                                    setWorkDuration(mins * 60);
                                    setTimeLeft(mins * 60);
                                    setShowSettings(false);
                                }}
                                style={[
                                    styles.presetBtn,
                                    {
                                        backgroundColor: workDuration === mins * 60
                                            ? primaryColor
                                            : (isLight ? colors.surfaceTertiary : 'rgba(255,255,255,0.1)'),
                                        borderWidth: 1,
                                        borderColor: workDuration === mins * 60 ? primaryColor : colors.border
                                    }
                                ]}
                            >
                                <Text style={[
                                    styles.presetText,
                                    { color: workDuration === mins * 60 ? '#fff' : colors.textPrimary }
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
                    {/* Background Circle */}
                    <Circle
                        cx={80}
                        cy={80}
                        r={70}
                        stroke={isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'}
                        strokeWidth="8"
                        fill="transparent"
                    />
                    {/* Progress Circle */}
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
                        {formatTime(timeLeft)}
                    </Text>
                    <Text style={[styles.stateText, { color: state === 'running' ? primaryColor : colors.textTertiary }]}>
                        {getStateLabel()}
                    </Text>
                </View>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
                {state === 'idle' && (
                    <TouchableOpacity onPress={handleStart} activeOpacity={0.8}>
                        <LinearGradient colors={gradientColors} style={styles.mainButton}>
                            <Ionicons name="play" size={32} color="white" style={{ marginLeft: 4 }} />
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {state === 'running' && (
                    <View style={styles.runningControls}>
                        <TouchableOpacity onPress={handleReset} style={[styles.secondaryButton, { borderColor: colors.border }]}>
                            <Ionicons name="stop" size={20} color={colors.textSecondary} />
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
                            <Ionicons name="stop" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleResume} activeOpacity={0.8}>
                            <LinearGradient colors={gradientColors} style={styles.mainButton}>
                                <Ionicons name="play" size={32} color="white" style={{ marginLeft: 4 }} />
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
            {/* Removed Progress Dots as requested */}
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
