import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidShell } from '@/components/Layout/VoidShell';
import { VoidCard } from '@/components/Layout/VoidCard';
import { getHabits, getGoals, type Habit } from '@/lib/habitsSQLite';
import { describeRecurrence } from '@/lib/onboarding';

type Filter = 'active' | 'archived' | 'all';

const FILTERS: { id: Filter; label: string }[] = [
    { id: 'active', label: 'Active' },
    { id: 'archived', label: 'Archived' },
    { id: 'all', label: 'All' },
];

/** Recurrence in the habit's own terms, from the fields the scheduler uses. */
const scheduleOf = (habit: Habit): string =>
    describeRecurrence({
        step: 0,
        recurrence: habit.taskDays?.length ? 'custom' : 'daily',
        taskDays: habit.taskDays,
    });

const targetOf = (habit: Habit): string =>
    habit.trackingMethod === 'numeric'
        ? `${habit.goalValue ?? 1} ${habit.unit ?? ''}`.trim()
        : 'Done or not done';

/**
 * Every habit in one place.
 *
 * The roadmap shows what is scheduled; this shows what exists, archived
 * included, so nothing is invisible just because it is not running today.
 */
export default function AllHabitsScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback } = useHaptics();

    const [habits, setHabits] = useState<Habit[]>([]);
    const [goalNames, setGoalNames] = useState<Record<string, string>>({});
    const [filter, setFilter] = useState<Filter>('active');
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const [all, goals] = await Promise.all([getHabits(), getGoals()]);
            setHabits(all.filter(habit => !habit.isGoal));
            setGoalNames(Object.fromEntries(goals.map((goal: Habit) => [goal.id, goal.name])));
        } catch {
            setHabits([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const sub = DeviceEventEmitter.addListener('habit_updated', load);
        return () => sub.remove();
    }, [load]);

    const shown = habits.filter(habit =>
        filter === 'all' ? true : filter === 'archived' ? habit.isArchived : !habit.isArchived);

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back">
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>All habits</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.filters}>
                    {FILTERS.map(option => {
                        const on = filter === option.id;
                        const count = habits.filter(habit =>
                            option.id === 'all' ? true : option.id === 'archived' ? habit.isArchived : !habit.isArchived).length;
                        return (
                            <TouchableOpacity
                                key={option.id}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: on }}
                                onPress={() => { lightFeedback(); setFilter(option.id); }}
                                style={[styles.chip, {
                                    backgroundColor: on ? accent + '20' : (isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)'),
                                    borderColor: on ? accent : 'transparent',
                                }]}
                            >
                                <Text style={{ color: on ? accent : colors.textSecondary, fontSize: 13, fontFamily: 'Lexend_500Medium' }}>
                                    {option.label} {count}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {loading ? (
                    <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
                ) : (
                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                        {shown.length === 0 ? (
                            <Text style={[styles.empty, { color: colors.textTertiary }]}>
                                {filter === 'archived' ? 'Nothing archived.' : 'No habits yet.'}
                            </Text>
                        ) : shown.map(habit => (
                            <TouchableOpacity
                                key={habit.id}
                                activeOpacity={0.85}
                                accessibilityRole="button"
                                accessibilityLabel={`${habit.name}. ${targetOf(habit)}, ${scheduleOf(habit)}`}
                                onPress={() => { lightFeedback(); router.push({ pathname: '/habit-detail', params: { habitId: habit.id } }); }}
                            >
                                <VoidCard style={styles.row}>
                                    <View style={[styles.icon, { backgroundColor: (habit.color ?? accent) + '22' }]}>
                                        <Ionicons name={(habit.icon ?? 'ellipse-outline') as any} size={18} color={habit.color ?? accent} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.name, { color: habit.isArchived ? colors.textTertiary : colors.textPrimary }]} numberOfLines={1}>
                                            {habit.name}
                                        </Text>
                                        <Text style={[styles.meta, { color: colors.textTertiary }]} numberOfLines={1}>
                                            {[targetOf(habit), scheduleOf(habit), habit.goalId ? goalNames[habit.goalId] : null, habit.isArchived ? 'Archived' : null]
                                                .filter(Boolean).join(' · ')}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                                </VoidCard>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </SafeAreaView>
        </VoidShell>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12 },
    backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 18, fontWeight: '700', fontFamily: 'Lexend' },
    filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
    chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
    content: { paddingHorizontal: 20, paddingBottom: 40, gap: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
    icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    name: { fontSize: 15, fontFamily: 'Lexend_500Medium' },
    meta: { fontSize: 12, fontFamily: 'Lexend_400Regular', marginTop: 3 },
    empty: { fontSize: 14, fontFamily: 'Lexend_400Regular', textAlign: 'center', marginTop: 40 },
});
