import { SheetScreen } from '@/components/ui/SheetScreen';
import { FontFamily, UIStyles } from '@/theme/designSystem';
import { useMemo } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { IconTile } from '@/components/ui/IconTile';
import { CountUp, ListItem } from '@/components/ui/Motion';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { router } from 'expo-router';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidCard } from '@/components/ui/VoidCard';
import { type Habit } from '@/lib/habitsSQLite';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { isLate, todayKey, type Task } from '@/lib/tasks';
import { TASK_COLOR } from '@/components/Roadmap/TaskItem';
import { emit } from '@/lib/appEvents';
import { styles } from '@/styles/screens/goal-roadmap.styles';

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

    // The shared goal data: the same habits, tasks and progress every other
    // goal screen shows, already in memory, so this page opens instantly.
    const { habits, tasks, insightsById, loaded } = useGoalsInsights();
    const loading = !loaded;
    const { plans, unassigned } = useMemo(() => {
        const liveHabits = habits.filter(habit => !habit.isGoal && !habit.isArchived);
        const liveTasks = tasks.filter(task => task.status !== 'cancelled');
        return {
            plans: habits.filter(habit => habit.isGoal).map((goal): GoalPlan => {
                const goalHabits = liveHabits.filter(habit => habit.goalId === goal.id);
                const goalTasks = liveTasks.filter(task => task.goalId === goal.id);
                return {
                    goal,
                    habits: goalHabits,
                    tasks: goalTasks,
                    progress: goalHabits.length + goalTasks.length > 0 ? insightsById[goal.id]?.progress ?? null : null,
                };
            }),
            unassigned: {
                habits: liveHabits.filter(habit => !habit.goalId),
                tasks: liveTasks.filter(task => !task.goalId),
            },
        };
    }, [habits, tasks, insightsById]);

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
        const overdue = !done && isLate(task, today);
        return (
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`Task: ${task.title}`}
                onPress={() => { lightFeedback(); emit('show_task_form', { task }); }}
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
        <SheetScreen title="Full roadmap" onBack={() => router.back()}>

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
                                    <IconTile icon={plan.goal.icon || 'flag'} color={plan.goal.color || accent} size={36} shape="square" />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.goalName, { color: colors.textPrimary }]} numberOfLines={2}>{plan.goal.name}</Text>
                                        {targetOf(plan.goal) ? (
                                            <Text style={[styles.meta, { color: colors.textTertiary }]}>{targetOf(plan.goal)}</Text>
                                        ) : null}
                                    </View>
                                    {plan.progress !== null ? (
                                        <CountUp style={[styles.progress, { color: accent }]} value={`${plan.progress}%`} />
                                    ) : null}
                                </TouchableOpacity>

                                <View style={[styles.branch, { borderLeftColor: isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.12)' }]}>
                                    {plan.habits.map(habit => <ListItem key={habit.id}><HabitRow habit={habit} /></ListItem>)}
                                    {plan.tasks.map(task => <ListItem key={task.id}><TaskRow task={task} /></ListItem>)}
                                </View>
                            </VoidCard>
                        ))}

                        {unassigned.habits.length > 0 || unassigned.tasks.length > 0 ? (
                            <VoidCard style={styles.card}>
                                <Text style={[styles.section, { color: colors.textPrimary }]}>Not part of a goal</Text>
                                <View style={[styles.branch, { borderLeftColor: isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.12)' }]}>
                                    {unassigned.habits.map(habit => <ListItem key={habit.id}><HabitRow habit={habit} /></ListItem>)}
                                    {unassigned.tasks.map(task => <ListItem key={task.id}><TaskRow task={task} /></ListItem>)}
                                </View>
                            </VoidCard>
                        ) : null}
                    </ScrollView>
                )}
            </SheetScreen>
    );
}
