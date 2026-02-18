import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VoidCard } from '@/components/Layout/VoidCard';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useRoutines, Routine } from '@/constants/RoutineContext';
import { router } from 'expo-router';

// ============================================
// Routine Card — Home Screen Widget
// Shows today's routines with quick-start action
// ============================================

const TIME_OF_DAY_CONFIG: Record<string, { label: string; icon: string; emoji: string }> = {
    morning: { label: 'Morning', icon: 'sunny-outline', emoji: '☀️' },
    afternoon: { label: 'Afternoon', icon: 'partly-sunny-outline', emoji: '🌤️' },
    evening: { label: 'Evening', icon: 'moon-outline', emoji: '🌙' },
    anytime: { label: 'Anytime', icon: 'time-outline', emoji: '⏰' },
};

function getCurrentTimeOfDay(): string {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
}

export const RoutineCard: React.FC = () => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { routines, loading, startRoutine, isRoutineRunning } = useRoutines();
    const [todaySessions, setTodaySessions] = useState<{ routineId: string; completed: boolean }[]>([]);
    const { getTodayRoutineSessions } = useRoutines();

    const currentTime = getCurrentTimeOfDay();

    // Load today's completed routine sessions
    useEffect(() => {
        getTodayRoutineSessions().then(setTodaySessions);
    }, []);

    // Group routines by time of day, prioritize current time
    const relevantRoutines = routines.filter(
        r => r.timeOfDay === currentTime || r.timeOfDay === 'anytime'
    );

    const otherRoutines = routines.filter(
        r => r.timeOfDay !== currentTime && r.timeOfDay !== 'anytime'
    );

    const isRoutineCompleted = (routineId: string) =>
        todaySessions.some(s => s.routineId === routineId && s.completed);

    if (routines.length === 0 && !loading) {
        return (
            <VoidCard glass style={styles.emptyCard}>
                <View style={styles.emptyContent}>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>🌅</Text>
                    <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                        Create Your First Routine
                    </Text>
                    <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
                        Chain habits together for powerful morning and evening rituals
                    </Text>
                    <TouchableOpacity
                        onPress={() => router.push('/(root)/routine-detail?mode=create')}
                        style={[styles.createButton, { backgroundColor: colors.primary }]}
                    >
                        <Ionicons name="add" size={18} color="#000" />
                        <Text style={styles.createButtonText}>New Routine</Text>
                    </TouchableOpacity>
                </View>
            </VoidCard>
        );
    }

    return (
        <View>
            {/* Section Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={{ fontSize: 18, marginRight: 6 }}>
                        {TIME_OF_DAY_CONFIG[currentTime]?.emoji}
                    </Text>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
                        Routines
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => router.push('/(root)/routine-detail?mode=create')}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="add-circle-outline" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Relevant routines (current time of day) */}
            {relevantRoutines.map((routine) => (
                <RoutineRow
                    key={routine.id}
                    routine={routine}
                    completed={isRoutineCompleted(routine.id)}
                    onStart={() => startRoutine(routine)}
                    onPress={() => router.push(`/(root)/routine-detail?id=${routine.id}`)}
                    disabled={isRoutineRunning}
                    colors={colors}
                />
            ))}

            {/* Other routines (collapsed) */}
            {otherRoutines.length > 0 && (
                <View style={{ marginTop: 8 }}>
                    {otherRoutines.map((routine) => (
                        <RoutineRow
                            key={routine.id}
                            routine={routine}
                            completed={isRoutineCompleted(routine.id)}
                            onStart={() => startRoutine(routine)}
                            onPress={() => router.push(`/(root)/routine-detail?id=${routine.id}`)}
                            disabled={isRoutineRunning}
                            colors={colors}
                            dimmed
                        />
                    ))}
                </View>
            )}
        </View>
    );
};

// Individual routine row
const RoutineRow: React.FC<{
    routine: Routine;
    completed: boolean;
    onStart: () => void;
    onPress: () => void;
    disabled: boolean;
    colors: any;
    dimmed?: boolean;
}> = ({ routine, completed, onStart, onPress, disabled, colors, dimmed }) => {
    const totalMinutes = Math.round(
        routine.habits.reduce((sum, h) => sum + h.focusDuration, 0) / 60
    );

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
            <VoidCard glass style={[styles.routineRow, dimmed && { opacity: 0.6 }]}>
                <View style={styles.routineLeft}>
                    <Text style={styles.routineEmoji}>{routine.emoji}</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.routineName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {routine.name}
                        </Text>
                        <Text style={[styles.routineMeta, { color: colors.textTertiary }]}>
                            {routine.habits.length} habits · {totalMinutes} min
                        </Text>
                    </View>
                </View>

                {completed ? (
                    <View style={[styles.completedBadge, { backgroundColor: 'rgba(34,197,94,0.15)' }]}>
                        <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                        <Text style={[styles.completedText, { color: '#22C55E' }]}>Done</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        onPress={(e) => {
                            e.stopPropagation?.();
                            onStart();
                        }}
                        disabled={disabled}
                        style={[styles.startButton, {
                            backgroundColor: colors.primary,
                            opacity: disabled ? 0.5 : 1,
                        }]}
                    >
                        <Ionicons name="play" size={14} color="#000" />
                        <Text style={styles.startButtonText}>Start</Text>
                    </TouchableOpacity>
                )}
            </VoidCard>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        paddingHorizontal: 4,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontFamily: 'Lexend',
        fontWeight: '600',
    },
    emptyCard: {
        padding: 24,
        marginBottom: 12,
    },
    emptyContent: {
        alignItems: 'center',
    },
    emptyTitle: {
        fontSize: 16,
        fontFamily: 'Lexend',
        fontWeight: '600',
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: 12,
        fontFamily: 'Lexend_400Regular',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 18,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 12,
        gap: 6,
    },
    createButtonText: {
        color: '#000',
        fontSize: 13,
        fontFamily: 'Lexend',
        fontWeight: '600',
    },
    routineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        marginBottom: 8,
    },
    routineLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    routineEmoji: {
        fontSize: 28,
        marginRight: 12,
    },
    routineName: {
        fontSize: 14,
        fontFamily: 'Lexend',
        fontWeight: '600',
        marginBottom: 2,
    },
    routineMeta: {
        fontSize: 11,
        fontFamily: 'Lexend_400Regular',
    },
    completedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
        gap: 4,
    },
    completedText: {
        fontSize: 11,
        fontFamily: 'Lexend',
        fontWeight: '600',
    },
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 10,
        gap: 4,
    },
    startButtonText: {
        color: '#000',
        fontSize: 12,
        fontFamily: 'Lexend',
        fontWeight: '700',
    },
});
