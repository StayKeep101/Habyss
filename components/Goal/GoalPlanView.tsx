import React, { useState } from 'react';
import {ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import { ListItem } from '@/components/ui/Motion';
import { router } from 'expo-router';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { GoalHabitRow, SectionLabel, ValuePill } from '@/components/Goal/GoalRows';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { TaskItem } from '@/components/Roadmap/TaskItem';
import { HabitSheet } from '@/components/Create/HabitSheet';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useGoalInsights } from '@/hooks/useGoalInsights';
import { addDays } from '@/lib/goalInsights';
import { isTimedHabit, tapUnticks, toggleCompletion, type Habit } from '@/lib/habitsSQLite';
import { deleteTask, setTaskStatus, updateTask, type Task } from '@/lib/tasks';
import { emit } from '@/lib/appEvents';

/**
 * Every step between here and the goal, as one path.
 *
 * It opens on the goal's number and what each day now needs. Then the path:
 * for a project, each step in order with the tasks inside it, so you can see
 * what is finished, what is under way and what has not been touched; for a
 * number or time goal, the tasks laid out on the days they are due. The habits
 * that carry it every day sit beside the path, and the path ends at the flag.
 */
export const GoalPlanView: React.FC<{ goalId?: string; embedded?: boolean }> = ({ goalId, embedded = false }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, selectionFeedback } = useHaptics();
    const { goal, insights, loaded, today, setCompletion } = useGoalInsights(goalId);
    const [showDone, setShowDone] = useState(false);
    const Outer: any = embedded ? View : ScrollView;
    const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

    if (!goal || !insights) {
        return (
            <>
                {loaded ? (
                    <Text style={[styles.empty, { color: colors.textSecondary }]}>This goal is no longer here.</Text>
                ) : <ActivityIndicator color={accent} style={{ marginTop: 40 }} />}
            </>
        );
    }

    const color = goal.color || accent;
    const { tasks } = insights;

    const addTask = () => {
        lightFeedback();
        emit('show_task_form', { goalId: goal.id });
    };

    /**
     * The plan asks one question about a task: when.
     *
     * Tapping opens the sheet already on its Date row, rather than on a title
     * nobody came here to rewrite. Ticking it off, editing it and deleting it
     * all live where the task itself lives.
     */
    const openTask = (task?: Task) => {
        lightFeedback();
        emit('show_task_form', task ? { task, focus: 'due' } : { goalId: goal.id });
    };

    /** Moving a day at a time, from where the task is or from today. */
    const moveTask = async (task: Task, days: number) => {
        try {
            await updateTask(task.id, { dueDate: addDays(task.dueDate ?? today, days) });
            emit('tasks_changed');
        } catch { Alert.alert('Could not move the task', 'Please try again.'); }
    };
    const toggleTask = async (task: Task) => {
        selectionFeedback();
        try {
            await setTaskStatus(task.id, task.status === 'done' ? 'open' : 'done');
            emit('tasks_changed');
        } catch { Alert.alert('Could not save task', 'Please try again.'); }
    };
    const removeTask = (task: Task) => {
        Alert.alert('Delete task', `Delete "${task.title}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => {
                try { await deleteTask(task.id); emit('tasks_changed'); }
                catch { Alert.alert('Could not delete task', 'Your task is still saved. Please try again.'); }
            } },
        ]);
    };
    const toggleHabit = (habit: Habit, done: boolean) => {
        // A timed habit is done by running its timer: open it instead.
        if ((!done && isTimedHabit(habit)) || (done && !tapUnticks(habit))) {
            router.push({ pathname: '/habit-detail', params: { habitId: habit.id } });
            return;
        }
        selectionFeedback();
        setCompletion(habit.id, !done);
        toggleCompletion(habit.id, today).catch(() => {
            setCompletion(habit.id, done);
            Alert.alert('Could not save progress', 'Your check-in was not saved. Please try again.');
        });
    };

    // Upcoming tasks under one heading per day, in date order.
    const byDay: { date: string; tasks: Task[] }[] = [];
    for (const task of tasks.upcoming) {
        const last = byDay[byDay.length - 1];
        if (last && last.date === task.dueDate) last.tasks.push(task);
        else byDay.push({ date: task.dueDate!, tasks: [task] });
    }

    const renderTask = (task: Task) => (
        <ListItem key={task.id}><TaskItem
            key={task.id} task={task} today={today}
            // Inside a step the task is ticked off where it sits; on the dated
            // plan the only question is when.
            actions="reschedule"
            onMove={(moved, days) => void moveTask(moved, days)}
            onPress={() => openTask(task)}
            // Kept for the shape of the row; on the plan the swipes move days.
            onToggle={toggleTask} onEdit={() => openTask(task)} onDelete={removeTask}
        /></ListItem>
    );

    return (
        <>
            {/* Inside the goal page this is part of that page, so it must not
                be a second scroll view inside the first one. */}
            <Outer {...(embedded
                ? { style: styles.content }
                : { contentContainerStyle: styles.content, showsVerticalScrollIndicator: false })}>
                {/* The page above already shows the number and the days
                    left; this tab is only the plan. */}

                    <>
                        <SectionLabel first right={tasks.total ? <ValuePill value={`${tasks.done}/${tasks.total}`} /> : undefined}>Tasks</SectionLabel>
                        {/* One list, most urgent first: each row already says when it is due. */}
                        {[...tasks.overdue, ...tasks.upcoming, ...tasks.undated].map(renderTask)}

                        <View style={styles.addRow}>
                            <AddButton label="Task" onPress={addTask} />
                        </View>
                    </>

                {insights.habits.length ? <SectionLabel>Habits</SectionLabel> : null}
                {insights.habits.map(summary => {
                    return (
                        <GoalHabitRow
                            key={summary.habit.id}
                            summary={summary}
                            color={color}
                            detail={summary.schedule}
                            onToggle={() => toggleHabit(summary.habit, summary.doneToday)}
                            onPress={() => router.push({ pathname: '/habit-detail', params: { habitId: summary.habit.id } })}
                            onLongPress={() => setEditingHabit(summary.habit)}
                        />
                    );
                })}

                {tasks.completed.length ? (
                    <>
                        <TouchableOpacity accessibilityRole="button" onPress={() => { lightFeedback(); setShowDone(!showDone); }} style={styles.doneToggle}>
                            <Text style={[styles.doneToggleText, { color: colors.textSecondary }]}>
                                {showDone ? 'Hide' : 'Show'} {tasks.completed.length} done
                            </Text>
                            <Ionicons name={showDone ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                        {showDone ? tasks.completed.map(renderTask) : null}
                    </>
                ) : null}
            </Outer>

            {editingHabit ? (
                <HabitSheet visible habit={editingHabit} goalId={editingHabit.goalId} onClose={() => setEditingHabit(null)} />
            ) : null}
        </>
    );
}

/** A matte pill to add something to the plan. */
const AddButton: React.FC<{ label: string; onPress: () => void }> = ({ label, onPress }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Add ${label.toLowerCase()}`} onPress={onPress} activeOpacity={0.8} style={{ flex: 1 }}>
            <MatteSurface radius={999} level="control" style={styles.addButton}>
                <Ionicons name="add" size={18} color={colors.textPrimary} />
                <Text style={[styles.addButtonText, { color: colors.textPrimary }]}>{label}</Text>
            </MatteSurface>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    content: { paddingHorizontal: 20, paddingBottom: 48 },
    empty: { textAlign: 'center', marginTop: 40, fontFamily: FontFamily.regular },
    goalName: { fontSize: 22, fontFamily: FontFamily.bold, marginTop: 4 },
    range: { fontSize: 13, fontFamily: FontFamily.regular, marginTop: 4 },
    hint: { fontSize: 13, fontFamily: FontFamily.regular, paddingVertical: 6 },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    addText: { fontSize: 13, fontFamily: FontFamily.semibold },
    day: { marginBottom: 6 },
    dayLabel: { fontSize: 13, fontFamily: FontFamily.semibold, marginBottom: 8 },
    target: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1, marginTop: 10 },
    targetText: { flex: 1, fontSize: 14, fontFamily: FontFamily.semibold },
    targetDays: { fontSize: 12, fontFamily: FontFamily.regular },
    addRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
    addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13 },
    addButtonText: { fontSize: 14, fontFamily: FontFamily.semibold },
    doneToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
    doneToggleText: { fontSize: 13, fontFamily: FontFamily.medium },
});
