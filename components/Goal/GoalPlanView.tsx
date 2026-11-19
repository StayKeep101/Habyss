import { useRemoveTask } from '@/hooks/useRemoveTask';
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
import { toggleCompletion, type Habit } from '@/lib/habitsSQLite';
import { proveTick } from '@/lib/challengeProof';
import { setTaskStatus, updateTask, type Task } from '@/lib/tasks';
import { emit } from '@/lib/appEvents';
import { GoalMilestones } from '@/components/Goal/GoalMilestones';
import { MilestoneSheet } from '@/components/Goal/MilestoneSheet';
import { useMilestones } from '@/hooks/useMilestones';
import { useRetained } from '@/hooks/useRetained';
import { updateMilestone, type Milestone } from '@/lib/goalMilestones';
import { oopsTitle } from '@/lib/voice';

/**
 * The goal's roadmap: everything that gets it done, in three plain parts.
 *
 * - Milestones: by when each part should be done ("Beta ready by Nov 30").
 * - Tasks: the steps to finish it, the most urgent first, done ones folded away.
 * - Habits: what you keep doing, each with its rhythm ("Every day").
 *
 * Each part says in one line what it is for and ends with its own add button,
 * so building the plan happens right here.
 */
export const GoalPlanView: React.FC<{ goalId?: string; embedded?: boolean; readOnly?: boolean; onOpenTask?: (task?: Task) => void }> = ({ goalId, embedded = false, readOnly = false, onOpenTask }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, selectionFeedback } = useHaptics();
    const { goal, insights, loaded, today, setCompletion } = useGoalInsights(goalId);
    const [showDone, setShowDone] = useState(false);
    const Outer: any = embedded ? View : ScrollView;
    const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
    const [addingHabit, setAddingHabit] = useState(false);
    const milestones = useMilestones(goal?.id);
    const [milestoneSheet, setMilestoneSheet] = useState<{ milestone: Milestone | null } | null>(null);
    const shownMilestoneSheet = useRetained(milestoneSheet);

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

    // On the goal page the page opens the sheet itself (a second modal over a
    // modal route freezes iOS); elsewhere the root's copy does.
    const addTask = () => {
        if (onOpenTask) { onOpenTask(); return; }
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
        if (onOpenTask) { onOpenTask(task); return; }
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
        if (task.status !== 'done' && !(await proveTick({ kind: 'task', task }, today))) return;
        selectionFeedback();
        try {
            await setTaskStatus(task.id, task.status === 'done' ? 'open' : 'done');
            emit('tasks_changed');
        } catch { Alert.alert(oopsTitle(), 'Please try again.'); }
    };
    // The same question as everywhere a task is deleted (hooks/useRemoveTask.ts).
    const askRemoveTask = useRemoveTask();
    const removeTask = (task: Task) => askRemoveTask(task);
    const toggleHabit = async (habit: Habit, done: boolean) => {
        // A tap ticks anything; a second tap takes it back. In a challenge or a bet, a tick needs proof first.
        if (!done && !(await proveTick({ kind: 'habit', habit }, today))) return;
        selectionFeedback();
        setCompletion(habit.id, !done);
        toggleCompletion(habit.id, today).catch(() => {
            setCompletion(habit.id, done);
            Alert.alert(oopsTitle(), 'Your check-in was not saved. Please try again.');
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

                {/* 1 · Milestones: by when each part should be done. */}
                <SectionLabel first right={milestones.length ? <ValuePill value={`${milestones.filter(m => m.doneAt).length}/${milestones.length}`} /> : undefined}>Milestones</SectionLabel>
                <Text style={[styles.lead, { color: colors.textTertiary }]}>By when each part should be done.</Text>
                {milestones.length ? (
                    <GoalMilestones header={false} milestones={milestones} color={color} today={today}
                        onToggle={milestone => { if (!readOnly) void updateMilestone(milestone, { done: !milestone.doneAt }).catch(() => Alert.alert(oopsTitle(), 'That milestone could not be updated. Try again.')); }}
                        onOpen={milestone => { if (!readOnly) setMilestoneSheet({ milestone }); }} />
                ) : null}
                {!readOnly ? <View style={styles.addRow}><AddButton label="Milestone" icon="flag-outline" onPress={() => { lightFeedback(); setMilestoneSheet({ milestone: null }); }} /></View> : null}

                {/* 2 · Tasks: the steps to finish it. */}
                <SectionLabel right={tasks.total ? <ValuePill value={`${tasks.done}/${tasks.total}`} /> : undefined}>Tasks</SectionLabel>
                <Text style={[styles.lead, { color: colors.textTertiary }]}>The steps to finish it, most urgent first.</Text>
                {/* One list, most urgent first: each row already says when it is due. */}
                {[...tasks.overdue, ...tasks.upcoming, ...tasks.undated].map(renderTask)}
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
                {!readOnly ? <View style={styles.addRow}><AddButton label="Task" icon="checkbox-outline" onPress={addTask} /></View> : null}

                {/* 3 · Habits: what you keep doing, each with its rhythm. */}
                <SectionLabel right={insights.habits.length ? <ValuePill value={String(insights.habits.length)} /> : undefined}>Habits</SectionLabel>
                <Text style={[styles.lead, { color: colors.textTertiary }]}>What you keep doing, and how often.</Text>
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

                {!readOnly ? <View style={styles.addRow}><AddButton label="Habit" icon="repeat-outline" onPress={() => { lightFeedback(); setAddingHabit(true); }} /></View> : null}
            </Outer>

            {addingHabit ? <HabitSheet visible goalId={goal.id} onClose={() => setAddingHabit(false)} onSaved={() => setAddingHabit(false)} /> : null}
            <MilestoneSheet visible={!!milestoneSheet} goalId={goal.id} goalEnd={goal.targetDate ? insights.endDate : undefined}
                milestone={shownMilestoneSheet?.milestone ?? null} onClose={() => setMilestoneSheet(null)} />

            {editingHabit ? (
                <HabitSheet visible habit={editingHabit} goalId={editingHabit.goalId} onClose={() => setEditingHabit(null)} />
            ) : null}
        </>
    );
}

/** A matte pill to add something to the plan. */
const AddButton: React.FC<{ label: string; icon?: string; onPress: () => void }> = ({ label, icon = 'add', onPress }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Add ${label.toLowerCase()}`} onPress={onPress} activeOpacity={0.8} style={{ flex: 1 }}>
            <MatteSurface radius={999} level="control" style={styles.addButton}>
                <Ionicons name={icon as never} size={18} color={colors.textPrimary} />
                <Text style={[styles.addButtonText, { color: colors.textPrimary }]}>Add {label.toLowerCase()}</Text>
            </MatteSurface>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    content: { paddingHorizontal: 20, paddingBottom: 48 },
    /** One line under each heading: what that part of the plan is for. */
    lead: { fontSize: 13, fontFamily: FontFamily.regular, marginTop: -4, marginBottom: 12 },
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
