import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useFocusTime } from '@/constants/FocusTimeContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { ActiveSessionDisplay } from '@/components/Timer/ActiveSessionDisplay';

// ============================================
// Focus Time Card
// Displays today's total focus time with embedded timer controls.
// ============================================

export const FocusTimeCard: React.FC = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { colors: accentColors, primary: accentColor } = useAccentGradient();
    const router = useRouter();

    const {
        isRunning,
        isPaused,
        activeHabitId,
        activeHabitName,
        timeLeft,
        totalDuration,
        totalFocusToday,
        sessionsToday,
        weeklyFocusTotal,
        monthlyFocusTotal,
        yearlyFocusTotal,
        // Industry-standard metrics
        dailyAverageAccurate,
        productivityEfficiency,
        activeDaysThisWeek,
        pauseTimer,
        resumeTimer,
        stopTimer,
    } = useFocusTime();

    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
            return `${hours}h ${mins}m`;
        }
        if (mins > 0) {
            return `${mins}m`;
        }
        return `${secs}s`;
    };

    const formatCountdown = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleActiveTimerPress = () => {
        if (activeHabitId) {
            router.push({ pathname: '/habit-detail', params: { habitId: activeHabitId } });
        }
    };

    const handlePlayPause = () => {
        if (isRunning) {
            pauseTimer();
        } else if (isPaused) {
            resumeTimer();
        }
    };

    const handleStop = () => {
        stopTimer();
    };

    const hasActiveTimer = isRunning || isPaused;

    // Timer progress calculation - starts at 12 o'clock
    const progress = totalDuration > 0 ? ((totalDuration - timeLeft) / totalDuration) * 100 : 0;
    const circumference = 2 * Math.PI * 38; // radius = 38
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    // Use industry-standard daily average (based on actual active days, not fixed 7)
    const dailyAverage = dailyAverageAccurate;

    return (
        <VoidCard glass intensity={isLight ? 20 : 80} style={[styles.container, isLight && { backgroundColor: colors.surfaceSecondary }]}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Ionicons name="timer-outline" size={16} color={accentColor} />
                    <Text style={[styles.title, { color: colors.textSecondary }]}>TODAY'S FOCUS</Text>
                </View>
            </View>

            {/* Main Content */}
            <View style={styles.content}>
                {/* Active Timer with Controls */}
                {hasActiveTimer ? (
                    <TouchableOpacity
                        onPress={handleActiveTimerPress}
                        activeOpacity={0.9}
                    >
                        <ActiveSessionDisplay
                            timeLeft={timeLeft}
                            totalDuration={totalDuration}
                            habitName={activeHabitName}
                            isPaused={isPaused}
                            isRunning={isRunning}
                            onPause={pauseTimer}
                            onResume={resumeTimer}
                            onStop={handleStop}
                            colors={colors}
                            isLight={isLight}
                            dailyAverage={dailyAverage}
                            monthlyAverage={Math.floor(monthlyFocusTotal / 30)}
                            yearlyAverage={Math.floor(yearlyFocusTotal / 365)}
                        />
                    </TouchableOpacity>
                ) : (
                    /* Idle State - Show Total Focus Time + Stats */
                    <View style={styles.idleContainer}>
                        <View style={styles.focusTimeContainer}>
                            <Text style={[styles.focusTime, { color: colors.textPrimary }]}>
                                {formatTime(totalFocusToday)}
                            </Text>
                            <Text style={[styles.focusLabel, { color: colors.textTertiary }]}>focused today</Text>
                            {/* Productivity Efficiency Badge */}
                            {productivityEfficiency > 0 && (
                                <View style={[styles.efficiencyBadge, { backgroundColor: isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)' }]}>
                                    <Ionicons name="checkmark-circle" size={12} color={productivityEfficiency >= 80 ? '#22C55E' : productivityEfficiency >= 50 ? '#F59E0B' : colors.textTertiary} />
                                    <Text style={[styles.efficiencyText, { color: productivityEfficiency >= 80 ? '#22C55E' : productivityEfficiency >= 50 ? '#F59E0B' : colors.textTertiary }]}>
                                        {productivityEfficiency}% efficiency
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Stats Row - only when idle and has data */}
                        {(weeklyFocusTotal > 0 || monthlyFocusTotal > 0 || yearlyFocusTotal > 0) && (
                            <View style={styles.statsRow}>
                                <View style={styles.statItem}>
                                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                                        {formatTime(weeklyFocusTotal)}
                                    </Text>
                                    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>This Week</Text>
                                </View>
                                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                                <View style={styles.statItem}>
                                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                                        {formatTime(monthlyFocusTotal)}
                                    </Text>
                                    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>This Month</Text>
                                </View>
                                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                                <View style={styles.statItem}>
                                    <Text style={[styles.statValue, { color: colors.textPrimary }]}>
                                        {formatTime(yearlyFocusTotal)}
                                    </Text>
                                    <Text style={[styles.statLabel, { color: colors.textTertiary }]}>This Year</Text>
                                </View>
                            </View>
                        )}
                    </View>
                )}

                {/* Empty State when no activity */}
                {!hasActiveTimer && totalFocusToday === 0 && weeklyFocusTotal === 0 && (
                    <View style={styles.emptyState}>
                        <Ionicons name="hourglass-outline" size={24} color={colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                            Start a timer on any habit to track focus time
                        </Text>
                    </View>
                )}
            </View>
        </VoidCard>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
    sessionBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(128,128,128,0.1)',
    },
    sessionCount: {
        fontSize: 10,
        fontWeight: '600',
        fontFamily: 'Lexend_400Regular',
    },
    content: {
        alignItems: 'center',
        gap: 16,
    },
    focusTimeContainer: {
        alignItems: 'center',
    },
    focusTime: {
        fontSize: 36,
        fontWeight: '800',
        fontFamily: 'Lexend',
        letterSpacing: -1,
    },
    focusLabel: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
        marginTop: 4,
    },
    activeTimerSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 20,
        width: '100%',
    },
    timerRingContainer: {
        width: 100,
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerRing: {
        position: 'absolute',
    },
    timerContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    countdownText: {
        fontSize: 18,
        fontWeight: '800',
        fontFamily: 'Lexend',
        letterSpacing: -0.5,
    },
    timerInfo: {
        flex: 1,
        gap: 12,
    },
    habitName: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 1,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2,
    },
    controlButtons: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    controlBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    playPauseBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 12,
        gap: 8,
    },
    emptyText: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
        textAlign: 'center',
        maxWidth: 200,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        width: '100%',
        paddingTop: 16,
        marginTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(128,128,128,0.1)',
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statValue: {
        fontSize: 14,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    statLabel: {
        fontSize: 9,
        fontFamily: 'Lexend_400Regular',
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statDivider: {
        width: 1,
        height: 24,
    },
    // New styles for column layout
    statsColumn: {
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 4,
        paddingLeft: 16,
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(128,128,128,0.1)',
    },
    statItemVertical: {
        alignItems: 'flex-end',
    },
    statValueSmall: {
        fontSize: 12,
        fontWeight: '700',
        fontFamily: 'Lexend',
    },
    statLabelSmall: {
        fontSize: 8,
        fontFamily: 'Lexend_400Regular',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        opacity: 0.7,
    },
    statDividerH: {
        width: 32,
        height: 1,
        marginVertical: 2,
        opacity: 0.3,
    },
    idleContainer: {
        alignItems: 'center',
        width: '100%',
    },
    efficiencyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginTop: 8,
    },
    efficiencyText: {
        fontSize: 10,
        fontWeight: '600',
        fontFamily: 'Lexend_400Regular',
    },
});
