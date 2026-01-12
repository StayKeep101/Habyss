import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { useFocusTime } from '@/constants/FocusTimeContext';
import Svg, { Circle } from 'react-native-svg';
import { ActiveSessionDisplay } from '@/components/Timer/ActiveSessionDisplay';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withRepeat,
    withSequence,
    Easing,
    cancelAnimation,
} from 'react-native-reanimated';

interface PomodoroTimerProps {
    defaultMinutes?: number;
    onComplete?: () => void;
    habitName?: string;
    habitId?: string;
    noCard?: boolean;
}

// Default intervals (in minutes)
const DEFAULT_WORK = 25;

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

    // Global focus time context - THIS IS THE SINGLE SOURCE OF TRUTH
    const {
        isRunning: globalIsRunning,
        isPaused: globalIsPaused,
        activeHabitId,
        activeHabitName,
        timeLeft: globalTimeLeft,
        totalDuration: globalTotalDuration,
        startTimer: globalStartTimer,
        pauseTimer: globalPauseTimer,
        resumeTimer: globalResumeTimer,
        stopTimer: globalStopTimer,
        totalFocusToday,
        sessionsToday,
    } = useFocusTime();

    // Local UI state only
    const [workDuration, setWorkDuration] = useState((defaultMinutes || DEFAULT_WORK) * 60);
    const [showSettings, setShowSettings] = useState(false);

    const { successFeedback, mediumFeedback, lightFeedback } = useHaptics();

    // Determine if THIS timer is the active one
    const isThisTimerActive = activeHabitId === habitId;
    const isRunning = isThisTimerActive && globalIsRunning;
    const isPaused = isThisTimerActive && globalIsPaused;
    const timeLeft = isThisTimerActive ? globalTimeLeft : workDuration;
    const totalTime = isThisTimerActive ? globalTotalDuration : workDuration;

    // Timer state for display
    const state = isRunning ? 'running' : isPaused ? 'paused' : 'idle';

    // Pulse animation
    const pulseAnim = useSharedValue(1);

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

    const pulseStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseAnim.value }],
    }));

    // Update work duration when defaultMinutes changes (only if idle)
    useEffect(() => {
        if (defaultMinutes && state === 'idle') {
            setWorkDuration(defaultMinutes * 60);
        }
    }, [defaultMinutes, state]);

    const handleStart = () => {
        // Check if another timer is running globally
        if ((globalIsRunning || globalIsPaused) && activeHabitId !== habitId) {
            Alert.alert(
                'Timer Already Active',
                `A timer is already running for "${activeHabitName || 'another habit'}". Please stop it first.`,
                [{ text: 'OK' }]
            );
            return;
        }

        mediumFeedback();

        // Start global timer
        if (habitId && habitName) {
            const success = globalStartTimer(habitId, habitName, workDuration);
            if (!success) {
                Alert.alert('Error', 'Failed to start timer. Please try again.');
                return;
            }
        }
    };

    const handlePause = () => {
        lightFeedback();
        globalPauseTimer();
    };

    const handleResume = () => {
        lightFeedback();
        globalResumeTimer();
    };

    const handleStop = () => {
        lightFeedback();
        globalStopTimer();
        onComplete?.();
    };

    const handleSelectPreset = (minutes: number) => {
        lightFeedback();
        setWorkDuration(minutes * 60);
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

    const primaryColor = colors.primary;
    const gradientColors: readonly [string, string] = [colors.primary, colors.secondary || colors.primary];

    const getStateLabel = () => {
        switch (state) {
            case 'idle': return 'READY';
            case 'running': return 'FOCUSING';
            case 'paused': return 'PAUSED';
        }
    };

    const Wrapper = noCard ? View : VoidCard;
    const noCardStyle = { alignItems: 'center' as const, width: '100%' as `${number}%` };
    const wrapperProps = noCard ? { style: noCardStyle } : { style: styles.container };

    return (
        <Wrapper {...wrapperProps}>
            {/* Active Timer Display (Replaces Idle Settings & Big Timer) */}
            {(state === 'running' || state === 'paused') ? (
                <View style={{ width: '100%', alignItems: 'center' }}>
                    <ActiveSessionDisplay
                        timeLeft={timeLeft}
                        totalDuration={totalDuration}
                        habitName={habitName || 'Focus'}
                        isPaused={state === 'paused'}
                        isRunning={state === 'running'}
                        onPause={handlePause}
                        onResume={handleResume}
                        onStop={handleStop}
                        colors={colors}
                        isLight={isLight}
                        // Optional: Pass stats if you want them here too, or omit for cleaner look in detail view
                        dailyAverage={Math.floor(totalFocusToday / (sessionsToday || 1))} // Just rough estimate or omit
                    />
                </View>
            ) : (
                <>
                    {/* Header - Fixed */}
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
                                disabled={state !== 'idle'}
                            >
                                <Ionicons
                                    name={showSettings ? "close" : "settings-outline"}
                                    size={18}
                                    color={state === 'idle' ? colors.textTertiary : colors.border}
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
                            <TouchableOpacity onPress={() => setShowSettings(!showSettings)} disabled={state !== 'idle'}>
                                <Ionicons name="settings-outline" size={20} color={state === 'idle' ? colors.textSecondary : colors.border} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Settings Panel - Only in idle state */}
                    {showSettings && state === 'idle' && (
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

                    {/* Idle Timer Display */}
                    <Animated.View style={[styles.timerContainer, pulseStyle]}>
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
                                transform="rotate(-90 80 80)"
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
                    </Animated.View>

                    {/* Controls - Only Start for Idle */}
                    <View style={styles.controls}>
                        {state === 'idle' && (
                            <TouchableOpacity onPress={handleStart} activeOpacity={0.8}>
                                <LinearGradient colors={gradientColors} style={styles.mainButton}>
                                    <Ionicons name="play" size={32} color="white" style={{ marginLeft: 4 }} />
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </View>
                </>
            )}

            {/* Session Stats (Always Visible or maybe hide when running if ActiveSessionDisplay shows logic?) 
                Actually keeping them below is fine for history context
            */}
            <View style={styles.stats}>
                <View style={styles.statItem}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>{sessionsToday}</Text>
                    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>sessions</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                    <Ionicons name="time" size={14} color={colors.primary} />
                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                        {formatFocusTime(totalFocusToday)}
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
});
