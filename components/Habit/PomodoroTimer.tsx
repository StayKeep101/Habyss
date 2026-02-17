import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, useWindowDimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { VoidCard } from '@/components/Layout/VoidCard';
import { useHaptics } from '@/hooks/useHaptics';
import { useTheme } from '@/constants/themeContext';
import { Colors } from '@/constants/Colors';
import { useFocusTime, FocusMode } from '@/constants/FocusTimeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
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
    fullSizeRunning?: boolean;
}

// Mode Configuration
interface ModeConfig {
    id: FocusMode;
    label: string;
    duration: number; // minutes, 0 for flow
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
}

const FOCUS_MODES: ModeConfig[] = [
    { id: 'pomodoro', label: 'Pomodoro', duration: 25, icon: 'timer-outline', color: '#3B82F6' },
    { id: 'deep_focus', label: 'Deep Work', duration: 90, icon: 'hardware-chip-outline', color: '#6366F1' },
    { id: 'flow', label: 'Flow State', duration: 0, icon: 'infinite-outline', color: '#10B981' },
    { id: 'sprint', label: 'Sprint', duration: 10, icon: 'flash-outline', color: '#F59E0B' },
    { id: 'check_in', label: 'Check-in', duration: 5, icon: 'checkmark-circle-outline', color: '#A855F7' },
];

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
    defaultMinutes,
    onComplete,
    habitName,
    habitId,
    noCard,
    fullSizeRunning = false
}) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { colors: accentColors, primary: accentColor } = useAccentGradient();

    // Global focus time context - THIS IS THE SINGLE SOURCE OF TRUTH
    const {
        isRunning: globalIsRunning,
        isPaused: globalIsPaused,
        activeHabitId,
        activeHabitName,
        activeMode: globalActiveMode,
        timeLeft: globalTimeLeft,
        totalDuration: globalTotalDuration,
        startTimer: globalStartTimer,
        pauseTimer: globalPauseTimer,
        resumeTimer: globalResumeTimer,
        stopTimer: globalStopTimer,
        sessionsToday,
        weeklyFocusTotal,
        monthlyFocusTotal,
        yearlyFocusTotal
    } = useFocusTime();

    // Local UI state
    const [selectedMode, setSelectedMode] = useState<FocusMode>('pomodoro');
    const [showSettings, setShowSettings] = useState(false);

    const { successFeedback, mediumFeedback, lightFeedback } = useHaptics();

    // Determine if THIS timer is the active one
    const isThisTimerActive = activeHabitId === habitId;
    const isRunning = isThisTimerActive && globalIsRunning;
    const isPaused = isThisTimerActive && globalIsPaused;

    // Derived state based on global or local selection
    const activeModeConfig = FOCUS_MODES.find(m => m.id === (isThisTimerActive ? globalActiveMode : selectedMode)) || FOCUS_MODES[0];

    // For Flow mode, we might want to show elapsed time, but context handles timeLeft. 
    // If flow mode in context (timeLeft starts at 0 and goes up?), we need to handle that display. 
    // Context currently returning 'timeLeft'. In flow mode, that might be elapsed.

    const displayTime = isThisTimerActive ? globalTimeLeft : (activeModeConfig.duration * 60);
    const totalTime = isThisTimerActive ? globalTotalDuration : (activeModeConfig.duration * 60);

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
            const success = globalStartTimer(habitId, habitName, activeModeConfig.duration * 60, selectedMode);
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

    const handleSelectMode = (mode: FocusMode) => {
        lightFeedback();
        setSelectedMode(mode);
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

    // Progress calculation
    // Flow mode (duration 0) - maybe just spin or fixed ring?
    const progress = activeModeConfig.id === 'flow'
        ? 100 // Always full ring for flow? Or maybe pulse? 
        : (totalTime > 0 ? ((totalTime - displayTime) / totalTime) * 100 : 0);

    const primaryColor = activeModeConfig.color; // Use mode color
    const gradientColors: readonly [string, string] = [activeModeConfig.color, isLight ? '#000' : '#fff']; // Simple gradient for now or predefined

    const getStateLabel = () => {
        switch (state) {
            case 'idle': return 'READY';
            case 'running': return 'FOCUSING';
            case 'paused': return 'PAUSED';
        }
    };

    const { width, height } = useWindowDimensions();
    const isSmallScreen = width < 380 || height < 700;

    // Responsive Base Sizes
    const BASE_SIZE = isSmallScreen ? 140 : 180;
    const BIG_SIZE = Math.min(width * 0.7, 260);

    const timerSize = fullSizeRunning ? BIG_SIZE : BASE_SIZE;
    const strokeWidth = fullSizeRunning ? 15 : 10;
    const radius = (timerSize / 2) - strokeWidth;
    const circumference = 2 * Math.PI * radius;

    const Wrapper = noCard ? View : VoidCard;
    const noCardStyle = { alignItems: 'center' as const, width: '100%' as `${number}%` };
    const wrapperProps = noCard ? { style: noCardStyle } : { style: styles.container };

    return (
        <Wrapper {...wrapperProps}>
            {/* Active Timer Display (Replaces Idle Settings & Big Timer) */}
            {/* Show ActiveSessionDisplay ONLY if NOT fullSizeRunning */}
            {((state === 'running' || state === 'paused') && !fullSizeRunning) ? (
                <View style={{ width: '100%', alignItems: 'center' }}>
                    <ActiveSessionDisplay
                        timeLeft={displayTime}
                        totalDuration={totalTime}
                        habitName={habitName || 'Focus'}
                        isPaused={state === 'paused'}
                        isRunning={state === 'running'}
                        onPause={handlePause}
                        onResume={handleResume}
                        onStop={handleStop}
                        colors={colors}
                        isLight={isLight}
                        dailyAverage={Math.floor(weeklyFocusTotal / 7)}
                        monthlyAverage={Math.floor(monthlyFocusTotal / 30)}
                        yearlyAverage={Math.floor(yearlyFocusTotal / 365)}
                    />
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={{ alignItems: 'center', paddingBottom: 20 }}
                    showsVerticalScrollIndicator={false}
                    scrollEnabled={isSmallScreen}
                    style={{ maxHeight: fullSizeRunning ? undefined : 450 }}
                >
                    {/* Header - Fixed */}
                    {!noCard && (
                        <View style={styles.header}>
                            <View style={styles.headerLeft}>
                                <Ionicons name={activeModeConfig.icon} size={18} color={primaryColor} />
                                <Text style={[styles.title, { color: colors.textSecondary }]}>
                                    {habitName ? `FOCUS: ${habitName.toUpperCase()}` : activeModeConfig.label.toUpperCase()}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowSettings(!showSettings)}
                                style={styles.settingsBtn}
                                disabled={state !== 'idle'}
                            >
                                <Ionicons
                                    name={showSettings ? "close" : "options-outline"}
                                    size={18}
                                    color={state === 'idle' ? colors.textTertiary : colors.border}
                                />
                            </TouchableOpacity>
                        </View>
                    )}

                    {noCard && (
                        <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name={activeModeConfig.icon} size={18} color={primaryColor} />
                                <Text style={[styles.title, { color: colors.textSecondary }]}>{activeModeConfig.label.toUpperCase()}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowSettings(!showSettings)} disabled={state !== 'idle'}>
                                <Ionicons name="options-outline" size={20} color={state === 'idle' ? colors.textSecondary : colors.border} />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Settings Panel - Mode Selection */}
                    {showSettings && state === 'idle' && (
                        <View style={[styles.settingsPanel, { backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)' }]}>
                            <Text style={[styles.settingsLabel, { color: colors.textSecondary }]}>SELECT MODE</Text>
                            <View style={styles.modesGrid}>
                                {FOCUS_MODES.map(mode => (
                                    <TouchableOpacity
                                        key={mode.id}
                                        onPress={() => handleSelectMode(mode.id)}
                                        style={[
                                            styles.modeBtn,
                                            {
                                                backgroundColor: selectedMode === mode.id
                                                    ? mode.color
                                                    : (isLight ? colors.surfaceTertiary : 'rgba(255,255,255,0.1)'),
                                                borderColor: selectedMode === mode.id ? mode.color : colors.border,
                                                opacity: selectedMode === mode.id ? 1 : 0.7
                                            }
                                        ]}
                                    >
                                        <Ionicons name={mode.icon} size={20} color={selectedMode === mode.id ? '#fff' : colors.textPrimary} />
                                        <Text style={[
                                            styles.modeText,
                                            { color: selectedMode === mode.id ? '#fff' : colors.textPrimary }
                                        ]}>
                                            {mode.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* "CRAZY" LARGE TIMER DISPLAY */}
                    <Animated.View style={[
                        styles.timerContainer,
                        pulseStyle,
                        {
                            width: timerSize,
                            height: timerSize,
                            marginVertical: fullSizeRunning ? (isSmallScreen ? 20 : 40) : 0
                        }
                    ]}>
                        <Svg width="100%" height="100%" viewBox={`0 0 ${timerSize} ${timerSize}`} style={styles.progressRing}>
                            <Defs>
                                <SvgGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <Stop offset="0%" stopColor={primaryColor} />
                                    <Stop offset="100%" stopColor={primaryColor} stopOpacity={0.6} />
                                </SvgGradient>
                            </Defs>

                            {/* Outer Glow / Track */}
                            <Circle
                                cx={timerSize / 2}
                                cy={timerSize / 2}
                                r={radius}
                                stroke={isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)'}
                                strokeWidth={strokeWidth}
                                fill="transparent"
                            />

                            {/* Gradient Progress Arc */}
                            <Circle
                                cx={timerSize / 2}
                                cy={timerSize / 2}
                                r={radius}
                                stroke="url(#grad)"
                                strokeWidth={strokeWidth}
                                fill="transparent"
                                strokeDasharray={circumference}
                                strokeDashoffset={activeModeConfig.id === 'flow' ? 0 : circumference - (progress / 100) * circumference}
                                strokeLinecap="round"
                                transform={`rotate(-90 ${timerSize / 2} ${timerSize / 2})`}
                            />

                            {/* Dot Indicator */}
                            {state !== 'idle' && activeModeConfig.id !== 'flow' && (
                                <Circle
                                    cx={timerSize / 2}
                                    cy={strokeWidth / 2}
                                    r={fullSizeRunning ? 8 : 6}
                                    fill={primaryColor}
                                    transform={`rotate(${(progress / 100) * 360} ${timerSize / 2} ${timerSize / 2})`}
                                    stroke={isLight ? '#fff' : '#000'}
                                    strokeWidth="2"
                                />
                            )}
                        </Svg>

                        <View style={styles.timeDisplay}>
                            <Text style={[
                                styles.timeText,
                                {
                                    color: colors.textPrimary,
                                    fontSize: fullSizeRunning ? (isSmallScreen ? 48 : 64) : 42,
                                    fontWeight: '900'
                                }
                            ]}>
                                {activeModeConfig.id === 'flow' && state === 'idle' ? 'OPEN' : formatTime(displayTime)}
                            </Text>
                            <Text style={[
                                styles.stateText,
                                {
                                    color: state === 'running' ? primaryColor : colors.textTertiary,
                                    fontSize: fullSizeRunning ? 14 : 10,
                                    letterSpacing: 3
                                }
                            ]}>
                                {getStateLabel()}
                            </Text>
                        </View>
                    </Animated.View>

                    {/* Controls */}
                    <View style={styles.controls}>
                        {state === 'idle' ? (
                            <TouchableOpacity onPress={handleStart} activeOpacity={0.8}>
                                <LinearGradient
                                    colors={[primaryColor, primaryColor]} // Can add gradient here
                                    style={[styles.mainButton, { transform: [{ scale: 1.1 }] }]}
                                >
                                    <Ionicons name="play" size={36} color="white" style={{ marginLeft: 6 }} />
                                </LinearGradient>
                            </TouchableOpacity>
                        ) : fullSizeRunning ? (
                            <View style={{ flexDirection: 'row', gap: 40, alignItems: 'center', marginTop: 20 }}>
                                <TouchableOpacity
                                    onPress={handleStop}
                                    style={[styles.secondaryButton, { width: 64, height: 64, borderRadius: 32 }]}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="stop" size={26} color={colors.textSecondary} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={state === 'running' ? handlePause : handleResume}
                                    activeOpacity={0.8}
                                    style={{
                                        shadowColor: primaryColor,
                                        shadowOffset: { width: 0, height: 8 },
                                        shadowOpacity: 0.4,
                                        shadowRadius: 12,
                                        elevation: 10
                                    }}
                                >
                                    <LinearGradient
                                        colors={[primaryColor, primaryColor]}
                                        style={[styles.mainButton, { width: 88, height: 88, borderRadius: 44 }]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    >
                                        <Ionicons
                                            name={state === 'running' ? "pause" : "play"}
                                            size={42}
                                            color="white"
                                            style={state !== 'running' ? { marginLeft: 6 } : {}}
                                        />
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        ) : null}
                    </View>
                </ScrollView>
            )}

            {/* Session Stats */}
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
                        {formatFocusTime(weeklyFocusTotal)}
                    </Text>
                    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>this week</Text>
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
    modesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    modeBtn: {
        flexGrow: 1,
        width: '45%',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'center',
        borderWidth: 1,
    },
    modeText: {
        fontSize: 12,
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
    secondaryButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
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
