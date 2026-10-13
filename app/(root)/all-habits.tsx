import { SheetScreen } from '@/components/Layout/SheetScreen';
import { FontFamily, UIStyles } from '@/theme/designSystem';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { router } from 'expo-router';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidCard } from '@/components/Layout/VoidCard';
import { getHabits, getGoals, type Habit } from '@/lib/habitsSQLite';
import { describeRecurrence } from '@/lib/onboarding';
import { on } from '@/lib/appEvents';
import { styles } from '@/styles/screens/all-habits.styles';

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
        const sub = on('habit_updated', load);
        return () => sub.remove();
    }, [load]);

    const shown = habits.filter(habit =>
        filter === 'all' ? true : filter === 'archived' ? habit.isArchived : !habit.isArchived);

    return (
        <SheetScreen title="All habits" onBack={() => router.back()}>

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
                                <Text style={{ color: on ? accent : colors.textSecondary, fontSize: 13, fontFamily: FontFamily.medium }}>
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
            </SheetScreen>
    );
}
