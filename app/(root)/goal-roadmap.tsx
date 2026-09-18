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
import { getTasks, todayKey, type Task } from '@/lib/tasks';
import { combinedGoalProgress, goalTaskProgress } from '@/lib/taskStats';
import { TASK_COLOR } from '@/components/Roadmap/TaskItem';

interface GoalPlan {
    goal: Habit;
    habits: Habit[];
    tasks: Task[];
    progress: number | null;
}

const targetOf = (goal: Habit): string => {
    const parts: string[] = [];
    if (goal.goalValue) parts.push(`${goal.goalValue} ${goal.unit ?? ''}`.trim());
    if (goal.targetDate) {
        parts.push(`by ${new Date(`${goal.targetDate}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`);
    }
    return parts.join(' · ');
};

/**
 * The whole plan behind each goal.
 *
 * The roadmap tab shows today; this shows the shape of the thing: every habit
 * and task attached to a goal, and how far along it is counting both. Anything
 * here opens its own editor, so looking at the big picture and changing it are
 * the same screen.
 */
export default function GoalRoadmapScreen() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback } = useHaptics();

    const [plans, setPlans] = useState<GoalPlan[]>([]);
    const [unassigned, setUnassigned] = useState<{ habits: Habit[]; tasks: Task[] }>({ habits: [], tasks: [] });
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        try {
            const [goals, habits, tasks] = await Promise.all([
                getGoals(),
                getHabits(),
                getTasks({ includeDone: true }),
            ]);
            const liveHabits = habits.filter((habit: Habit) => !habit.isGoal && !habit.isArchived);
            const liveTasks = tasks.filter(task => task.status !== 'cancelled');

            setPlans(goals.map((goal: Habit) => {
                const goalHabits = liveHabits.filter((habit: Habit) => habit.goalId === goal.id);
                const goalTasks = liveTasks.filter(task => task.goalId === goal.id);
                const taskProgress = goalTaskProgress(liveTasks, goal.id);
                // Habits count as "attached and running"; the honest habit-side
                // number lives on the goal itself, so this stays about coverage.
                const habitProgress = { done: 0, total: goalHabits.length };
                return {
                    goal,
                    habits: goalHabits,
                    tasks: goalTasks,
                    progress: combinedGoalProgress(habitProgress, taskProgress),
                };
            }));

            setUnassigned({
                habits: liveHabits.filter((habit: Habit) => !habit.goalId),
                tasks: liveTasks.filter(task => !task.goalId),
            });
        } catch {
            setPlans([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const subs = [
            DeviceEventEmitter.addListener('tasks_changed', load),
            DeviceEventEmitter.addListener('habit_updated', load),
        ];
        return () => subs.forEach(sub => sub.remove());
    }, [load]);

    const today = todayKey();

    const HabitRow = ({ habit }: { habit: Habit }) => (
        <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={`Habit: ${habit.name}`}
            onPress={() => { lightFeedback(); router.push({ pathname: '/habit-detail', params: { habitId: habit.id } }); }}
            style={styles.leaf}
        >
            <Ionicons name="repeat" size={15} color="#10B981" />
            <Text style={[styles.leafText, { color: colors.textPrimary }]} numberOfLines={1}>{habit.name}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
        </TouchableOpacity>
    );

    const TaskRow = ({ task }: { task: Task }) => {
        const done = task.status === 'done';
        const overdue = !done && !!task.dueDate && task.dueDate < today;
        return (
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Task: ${task.title}`}
                onPress={() => { lightFeedback(); DeviceEventEmitter.emit('show_task_form', { task }); }}
                style={styles.leaf}
            >
                <Ionicons name={done ? 'checkbox' : 'square-outline'} size={15} color={done ? colors.textTertiary : TASK_COLOR} />
                <Text
                    numberOfLines={1}
                    style={[styles.leafText, {
                        color: done ? colors.textTertiary : colors.textPrimary,
                        textDecorationLine: done ? 'line-through' : 'none',
                    }]}
                >
                    {task.title}
                </Text>
                {overdue ? <Text style={styles.overdue}>Overdue</Text> : null}
                <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
        );
    };

    return (
        <VoidShell>
            <SafeAreaView style={{ flex: 1 }} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Back">
                        <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Full roadmap</Text>
                    <View style={{ width: 40 }} />
                </View>

                {loading ? (
                    <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
                ) : (
                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                        {plans.length === 0 && unassigned.habits.length === 0 && unassigned.tasks.length === 0 ? (
                            <Text style={[styles.empty, { color: colors.textTertiary }]}>Nothing planned yet.</Text>
                        ) : null}

                        {plans.map(plan => (
                            <VoidCard key={plan.goal.id} style={styles.card}>
                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel={`Goal: ${plan.goal.name}`}
                                    onPress={() => { lightFeedback(); router.push({ pathname: '/goal-detail', params: { goalId: plan.goal.id } }); }}
                                    style={styles.goalRow}
                                >
                                    <View style={[styles.icon, { backgroundColor: accent + '22' }]}>
                                        <Ionicons name="flag-outline" size={18} color={accent} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.goalName, { color: colors.textPrimary }]} numberOfLines={2}>{plan.goal.name}</Text>
                                        {targetOf(plan.goal) ? (
                                            <Text style={[styles.meta, { color: colors.textTertiary }]}>{targetOf(plan.goal)}</Text>
                                        ) : null}
                                    </View>
                                    {plan.progress !== null ? (
                                        <Text style={[styles.progress, { color: accent }]}>{plan.progress}%</Text>
                                    ) : null}
                                </TouchableOpacity>

                                <View style={[styles.branch, { borderLeftColor: isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.12)' }]}>
                                    {plan.habits.map(habit => <HabitRow key={habit.id} habit={habit} />)}
                                    {plan.tasks.map(task => <TaskRow key={task.id} task={task} />)}
                                    {plan.habits.length === 0 && plan.tasks.length === 0 ? (
                                        <Text style={[styles.meta, { color: colors.textTertiary, paddingVertical: 6 }]}>
                                            Nothing attached yet.
                                        </Text>
                                    ) : null}
                                </View>
                            </VoidCard>
                        ))}

                        {unassigned.habits.length > 0 || unassigned.tasks.length > 0 ? (
                            <VoidCard style={styles.card}>
                                <Text style={[styles.section, { color: colors.textSecondary }]}>NOT PART OF A GOAL</Text>
                                <View style={[styles.branch, { borderLeftColor: isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.12)' }]}>
                                    {unassigned.habits.map(habit => <HabitRow key={habit.id} habit={habit} />)}
                                    {unassigned.tasks.map(task => <TaskRow key={task.id} task={task} />)}
                                </View>
                            </VoidCard>
                        ) : null}
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
    content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
    card: { padding: 14, gap: 8 },
    goalRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    goalName: { fontSize: 15, fontFamily: 'Lexend_600SemiBold' },
    meta: { fontSize: 12, fontFamily: 'Lexend_400Regular', marginTop: 2 },
    progress: { fontSize: 14, fontFamily: 'Lexend_600SemiBold' },
    section: { fontSize: 10, letterSpacing: 1.2, fontFamily: 'Lexend_500Medium' },
    branch: { marginLeft: 16, paddingLeft: 14, borderLeftWidth: 2, gap: 2 },
    leaf: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
    leafText: { flex: 1, fontSize: 13, fontFamily: 'Lexend_400Regular' },
    overdue: { fontSize: 11, color: '#EF4444', fontFamily: 'Lexend_500Medium' },
    empty: { fontSize: 14, fontFamily: 'Lexend_400Regular', textAlign: 'center', marginTop: 40 },
});
