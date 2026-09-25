import React, { useState } from 'react';
import {ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import { router } from 'expo-router';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { GoalHabitRow, SectionLabel } from '@/components/Goal/GoalRows';
import { TaskItem, TASK_COLOR } from '@/components/Roadmap/TaskItem';
import { HabitSheet } from '@/components/Create/HabitSheet';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useGoalInsights } from '@/hooks/useGoalInsights';
import { dateAt, daysBetween, friendlyDate } from '@/lib/goalInsights';
import { toggleCompletion, type Habit } from '@/lib/habitsSQLite';
import { deleteTask, setTaskStatus, type Task } from '@/lib/tasks';
import { emit } from '@/lib/appEvents';

/**
 * Everything it takes to reach one goal: the habits that repeat, and the
 * tasks laid out on the dates they are due, ending at the target.
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

    const openTask = (task?: Task) => {
        lightFeedback();
        emit('show_task_form', task ? { task } : { goalId: goal.id });
    };
    const addHabit = () => {
        lightFeedback();
        emit('show_habit_modal', { goalId: goal.id });
    };
    const toggleTask = async (task: Task) => {
        selectionFeedback();
        await setTaskStatus(task.id, task.status === 'done' ? 'open' : 'done');
        emit('tasks_changed');
    };
    const removeTask = (task: Task) => {
        Alert.alert('Delete task', `Delete "${task.title}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTask(task.id); emit('tasks_changed'); } },
        ]);
    };
    const toggleHabit = (habit: Habit, done: boolean) => {
        selectionFeedback();
        setCompletion(habit.id, !done);
        toggleCompletion(habit.id, today).catch(console.error);
    };

    // Upcoming tasks under one heading per day, in date order.
    const byDay: { date: string; tasks: Task[] }[] = [];
    for (const task of tasks.upcoming) {
        const last = byDay[byDay.length - 1];
        if (last && last.date === task.dueDate) last.tasks.push(task);
        else byDay.push({ date: task.dueDate!, tasks: [task] });
    }

    const renderTask = (task: Task) => (
        <TaskItem key={task.id} task={task} today={today} onToggle={toggleTask} onPress={() => openTask(task)} onEdit={() => openTask(task)} onDelete={removeTask} />
    );

    const addButton = (label: string, onPress: () => void, tint: string) => (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Add a ${label.toLowerCase()}`} onPress={onPress} hitSlop={10} style={styles.addBtn}>
            <Ionicons name="add" size={16} color={tint} />
            <Text style={[styles.addText, { color: tint }]}>{label}</Text>
        </TouchableOpacity>
    );

    const range = `${dateAt(insights.startDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} → ${goal.targetDate ? dateAt(insights.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'no end date'}`;

    return (
        <>
            {/* Inside the goal page this is part of that page, so it must not
                be a second scroll view inside the first one. */}
            <Outer {...(embedded
                ? { style: styles.content }
                : { contentContainerStyle: styles.content, showsVerticalScrollIndicator: false })}>
                <Text numberOfLines={2} style={[styles.goalName, { color: colors.textPrimary }]}>{goal.name}</Text>
                <Text style={[styles.range, { color: colors.textTertiary }]}>{range}</Text>

                <SectionLabel right={addButton('Habit', addHabit, color)}>{`Habits · ${insights.habits.length}`}</SectionLabel>
                {insights.habits.length ? insights.habits.map(summary => (
                    <GoalHabitRow
                        key={summary.habit.id}
                        summary={summary}
                        color={color}
                        showWeek
                        detail={`${summary.schedule} · ${summary.nextDate
                            ? `next ${friendlyDate(summary.nextDate, today).toLowerCase()}`
                            : 'ended'}`}
                        onToggle={() => toggleHabit(summary.habit, summary.doneToday)}
                        onPress={() => router.push({ pathname: '/habit-detail', params: { habitId: summary.habit.id } })}
                        onLongPress={() => setEditingHabit(summary.habit)}
                    />
                )) : (
                    <Text style={[styles.hint, { color: colors.textTertiary }]}>What will you repeat to get there? Add a habit.</Text>
                )}

                <SectionLabel right={addButton('Task', () => openTask(), TASK_COLOR)}>{`Tasks · ${tasks.total}`}</SectionLabel>
                {tasks.total === 0 ? (
                    <Text style={[styles.hint, { color: colors.textTertiary }]}>What must be finished, and by when? Add a task.</Text>
                ) : null}

                {tasks.overdue.length ? (
                    <View style={styles.day}>
                        <Text style={[styles.dayLabel, { color: colors.error }]}>Overdue</Text>
                        {tasks.overdue.map(renderTask)}
                    </View>
                ) : null}

                {byDay.map(group => (
                    <View key={group.date} style={styles.day}>
                        <Text style={[styles.dayLabel, { color: group.date === today ? color : colors.textSecondary }]}>
                            {/* Near days read "Tomorrow" or "Fri"; later ones by their full date. */}
                            {daysBetween(today, group.date) < 7 ? friendlyDate(group.date, today) : ''}
                            {group.date !== today ? (
                                <Text style={{ color: colors.textTertiary }}>
                                    {`${daysBetween(today, group.date) < 7 ? '  ' : ''}${dateAt(group.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`}
                                </Text>
                            ) : null}
                        </Text>
                        {group.tasks.map(renderTask)}
                    </View>
                ))}

                {tasks.undated.length ? (
                    <View style={styles.day}>
                        <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>No date</Text>
                        {tasks.undated.map(renderTask)}
                    </View>
                ) : null}

                {goal.targetDate ? (
                    <View style={[styles.target, { borderColor: color + '55', backgroundColor: color + '12' }]}>
                        <Ionicons name="flag" size={16} color={color} />
                        <Text style={[styles.targetText, { color: colors.textPrimary }]}>
                            Target · {dateAt(insights.endDate).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long' })}
                        </Text>
                        {insights.daysLeft !== null ? (
                            <Text style={[styles.targetDays, { color: colors.textTertiary }]}>{insights.daysLeft} days</Text>
                        ) : null}
                    </View>
                ) : null}

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
    doneToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
    doneToggleText: { fontSize: 13, fontFamily: FontFamily.medium },
});
