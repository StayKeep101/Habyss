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

// ============================================
// Focus Time Card
// Displays today's total focus time and active timer status.
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
        totalFocusToday,
        sessionsToday,
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

    const hasActiveTimer = isRunning || isPaused;

    return (
        <VoidCard style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Ionicons name="timer-outline" size={16} color={accentColor} />
                    <Text style={[styles.title, { color: colors.textSecondary }]}>TODAY'S FOCUS</Text>
                </View>
                <View style={styles.sessionBadge}>
                    <Text style={[styles.sessionCount, { color: colors.textTertiary }]}>
                        {sessionsToday} {sessionsToday === 1 ? 'session' : 'sessions'}
                    </Text>
                </View>
            </View>

            {/* Main Content */}
            <View style={styles.content}>
                {/* Total Focus Time */}
                <View style={styles.focusTimeContainer}>
                    <Text style={[styles.focusTime, { color: colors.textPrimary }]}>
                        {formatTime(totalFocusToday)}
                    </Text>
                    <Text style={[styles.focusLabel, { color: colors.textTertiary }]}>focused today</Text>
                </View>

                {/* Active Timer (if running/paused) */}
                {hasActiveTimer && (
                    <TouchableOpacity
                        onPress={handleActiveTimerPress}
                        activeOpacity={0.8}
                        style={styles.activeTimerContainer}
                    >
                        <LinearGradient
                            colors={accentColors}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.activeTimerGradient}
                        >
                            <View style={styles.activeTimerContent}>
                                <Ionicons
                                    name={isPaused ? 'pause' : 'play'}
                                    size={14}
                                    color="#fff"
                                />
                                <Text style={styles.activeTimerName} numberOfLines={1}>
                                    {activeHabitName || 'Focus'}
                                </Text>
                                <Text style={styles.activeTimerTime}>
                                    {formatCountdown(timeLeft)}
                                </Text>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                )}

                {/* Empty State when no activity */}
                {!hasActiveTimer && totalFocusToday === 0 && (
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
    activeTimerContainer: {
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
    },
    activeTimerGradient: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    activeTimerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    activeTimerName: {
        flex: 1,
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
        fontFamily: 'Lexend',
    },
    activeTimerTime: {
        fontSize: 16,
        fontWeight: '800',
        color: '#fff',
        fontFamily: 'Lexend',
        letterSpacing: -0.5,
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
});
