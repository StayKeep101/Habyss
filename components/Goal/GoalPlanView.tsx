import React, { useState } from 'react';
import {ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import { router } from 'expo-router';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { GoalHabitRow, SectionLabel } from '@/components/Goal/GoalRows';
import { Countdown } from '@/components/Goal/Countdown';
import { TaskItem } from '@/components/Roadmap/TaskItem';
import { HabitSheet } from '@/components/Create/HabitSheet';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useGoalInsights } from '@/hooks/useGoalInsights';
import { addDays, dateAt, daysBetween, friendlyDate, minutesPerCheckIn, type MilestoneProgress } from '@/lib/goalInsights';
import { toggleCompletion, updateHabit, type Habit } from '@/lib/habitsSQLite';
import { generateId } from '@/lib/database';
import { GoalPace, goalAmount } from '@/components/Goal/GoalPace';
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
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});

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
    const { tasks, measure, milestones } = insights;
    const isProject = measure.kind === 'complete' && milestones.length > 0;
    const [openSteps, setOpenSteps] = [expanded, setExpanded];
    // The first unfinished step is open by default: it is the one being worked on.
    const current = milestones.find(step => !step.complete && step.milestone.id)?.milestone.id;
    const isOpen = (id: string) => openSteps[id] ?? id === current;

    const addStep = () => {
        lightFeedback();
        Alert.prompt?.('New step', 'A phase of the plan, like "Dashboard".', async title => {
            const name = title?.trim();
            if (!name) return;
            let spec: Record<string, any> = {};
            try { spec = goal.goalSpec ? JSON.parse(goal.goalSpec) : {}; } catch { spec = {}; }
            const steps = Array.isArray(spec.milestones) ? spec.milestones : [];
            try {
                await updateHabit({ id: goal.id, goalSpec: JSON.stringify({ ...spec, kind: spec.kind ?? 'complete', milestones: [...steps, { id: generateId(), title: name }] }) });
                emit('habit_updated', { habitId: goal.id });
            } catch { Alert.alert('Could not add the step', 'Please try again.'); }
        });
    };
    const addTaskTo = (milestoneId?: string) => {
        lightFeedback();
        emit('show_task_form', { goalId: goal.id, ...(milestoneId ? { milestoneId } : {}) });
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
        <TaskItem
            key={task.id} task={task} today={today}
            // Inside a step the task is ticked off where it sits; on the dated
            // plan the only question is when.
            actions={isProject ? 'all' : 'reschedule'}
            onMove={(moved, days) => void moveTask(moved, days)}
            onPress={() => openTask(task)}
            // Kept for the shape of the row; on the plan the swipes move days.
            onToggle={toggleTask} onEdit={() => openTask(task)} onDelete={removeTask}
        />
    );

    return (
        <>
            {/* Inside the goal page this is part of that page, so it must not
                be a second scroll view inside the first one. */}
            <Outer {...(embedded
                ? { style: styles.content }
                : { contentContainerStyle: styles.content, showsVerticalScrollIndicator: false })}>
                <GoalPace measure={measure} color={color} />

                <Countdown
                    span={Math.max(1, Math.round(
                        (dateAt(insights.endDate).getTime() - dateAt(insights.startDate).getTime()) / 86400000))}
                    left={insights.daysLeft ?? 0}
                    endLabel={goal.targetDate
                        ? dateAt(insights.endDate).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })
                        : 'no end date'}
                />

                {isProject ? (
                    <>
                        <SectionLabel>{`Steps · ${milestones.filter(step => step.complete).length} of ${milestones.filter(step => step.milestone.id).length} done`}</SectionLabel>
                        <View>
                            {milestones.map((step, index) => (
                                <StepNode
                                    key={step.milestone.id || 'loose'}
                                    step={step}
                                    index={index}
                                    last={index === milestones.length - 1}
                                    color={color}
                                    open={isOpen(step.milestone.id)}
                                    onToggleOpen={() => { lightFeedback(); setOpenSteps(prev => ({ ...prev, [step.milestone.id]: !isOpen(step.milestone.id) })); }}
                                    onAddTask={() => addTaskTo(step.milestone.id || undefined)}
                                    renderTask={renderTask}
                                />
                            ))}
                        </View>
                        <TouchableOpacity accessibilityRole="button" onPress={addStep} style={[styles.addStep, { borderColor: color + '55' }]}>
                            <Ionicons name="add" size={16} color={color} />
                            <Text style={[styles.addStepText, { color }]}>Add a step</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <SectionLabel>{`Tasks · ${tasks.done} of ${tasks.total} done`}</SectionLabel>
                        {tasks.total === 0 ? (
                            <Text style={[styles.hint, { color: colors.textTertiary }]}>
                                {measure.kind === 'complete'
                                    ? 'Break it into steps, then the tasks inside each.'
                                    : 'One-off pushes, like "Call 25 leads". Add a task.'}
                            </Text>
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

                        <View style={styles.addRow}>
                            <TouchableOpacity accessibilityRole="button" onPress={() => addTaskTo()} style={[styles.addStep, { borderColor: color + '55', flex: 1 }]}>
                                <Ionicons name="add" size={16} color={color} />
                                <Text style={[styles.addStepText, { color }]}>Task</Text>
                            </TouchableOpacity>
                            {measure.kind === 'complete' ? (
                                <TouchableOpacity accessibilityRole="button" onPress={addStep} style={[styles.addStep, { borderColor: color + '55', flex: 1 }]}>
                                    <Ionicons name="git-commit-outline" size={16} color={color} />
                                    <Text style={[styles.addStepText, { color }]}>Step</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                    </>
                )}

                <SectionLabel>{`Every day · ${insights.habits.length} habit${insights.habits.length === 1 ? '' : 's'}`}</SectionLabel>
                {insights.habits.length ? insights.habits.map(summary => {
                    const gives = measure.kind === 'time'
                        ? minutesPerCheckIn(summary.habit)
                        : measure.kind === 'number' ? Number(summary.habit.goalValue) || 0 : 0;
                    return (
                        <GoalHabitRow
                            key={summary.habit.id}
                            summary={summary}
                            color={color}
                            showWeek
                            detail={[
                                summary.schedule,
                                gives > 0 ? `+${goalAmount(measure, gives)}${measure.kind === 'number' && measure.unit !== 'sessions' ? ` ${measure.unit}` : ''} each` : null,
                                summary.nextDate ? `next ${friendlyDate(summary.nextDate, today).toLowerCase()}` : 'ended',
                            ].filter(Boolean).join(' · ')}
                            onToggle={() => toggleHabit(summary.habit, summary.doneToday)}
                            onPress={() => router.push({ pathname: '/habit-detail', params: { habitId: summary.habit.id } })}
                            onLongPress={() => setEditingHabit(summary.habit)}
                        />
                    );
                }) : (
                    <Text style={[styles.hint, { color: colors.textTertiary }]}>What will you repeat to get there? Add a habit.</Text>
                )}

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

                {tasks.completed.length && !isProject ? (
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

/** One step of a project on the path: a node, its count, and its tasks. */
const StepNode: React.FC<{
    step: MilestoneProgress;
    index: number;
    last: boolean;
    color: string;
    open: boolean;
    onToggleOpen: () => void;
    onAddTask: () => void;
    renderTask: (task: Task) => React.ReactNode;
}> = ({ step, index, last, color, open, onToggleOpen, onAddTask, renderTask }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const started = step.done > 0;
    const share = step.total ? step.done / step.total : 0;
    const loose = !step.milestone.id;
    const pending = step.tasks.filter(task => task.status !== 'done');
    const finished = step.tasks.filter(task => task.status === 'done');

    return (
        <View style={styles.step}>
            <View style={styles.rail}>
                <View style={[styles.node, {
                    borderColor: step.complete || started ? color : colors.border,
                    backgroundColor: step.complete ? color : 'transparent',
                }]}>
                    {step.complete
                        ? <Ionicons name="checkmark" size={12} color="#000" />
                        : <Text style={[styles.nodeText, { color: started ? color : colors.textTertiary }]}>{loose ? '·' : index + 1}</Text>}
                </View>
                {!last ? <View style={[styles.line, { backgroundColor: step.complete ? color : colors.border }]} /> : null}
            </View>

            <View style={styles.stepBody}>
                <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: open }}
                    accessibilityLabel={`${step.milestone.title}, ${step.done} of ${step.total} tasks done`}
                    onPress={onToggleOpen} style={styles.stepHead}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.stepTitle, { color: step.complete ? colors.textSecondary : colors.textPrimary }]} numberOfLines={2}>
                            {step.milestone.title}
                        </Text>
                        <Text style={[styles.stepMeta, { color: step.complete ? color : colors.textTertiary }]}>
                            {step.total === 0 ? 'No tasks yet' : step.complete ? `Done · ${step.total} tasks` : `${step.done} of ${step.total} tasks`}
                        </Text>
                    </View>
                    {step.total > 0 && !step.complete ? (
                        <View style={[styles.stepTrack, { backgroundColor: color + '22' }]}>
                            <View style={[styles.stepFill, { width: `${share * 100}%`, backgroundColor: color }]} />
                        </View>
                    ) : null}
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textTertiary} />
                </TouchableOpacity>

                {open ? (
                    <View style={styles.stepTasks}>
                        {pending.map(renderTask)}
                        {finished.map(renderTask)}
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Add a task to ${step.milestone.title}`}
                            onPress={onAddTask} style={styles.stepAdd}>
                            <Ionicons name="add" size={14} color={color} />
                            <Text style={[styles.stepAddText, { color }]}>Add task</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}
            </View>
        </View>
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
    addRow: { flexDirection: 'row', gap: 10 },
    addStep: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', marginTop: 6 },
    addStepText: { fontSize: 13, fontFamily: FontFamily.semibold },
    step: { flexDirection: 'row' },
    rail: { width: 28, alignItems: 'center' },
    node: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    nodeText: { fontSize: 11, fontFamily: FontFamily.bold },
    line: { width: 2, flex: 1, marginVertical: 2, borderRadius: 1 },
    stepBody: { flex: 1, paddingLeft: 10, paddingBottom: 14 },
    stepHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 28 },
    stepTitle: { fontSize: 15, fontFamily: FontFamily.semibold },
    stepMeta: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 2 },
    stepTrack: { width: 44, height: 4, borderRadius: 2, overflow: 'hidden' },
    stepFill: { height: 4, borderRadius: 2 },
    stepTasks: { marginTop: 10, gap: 6 },
    stepAdd: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6 },
    stepAddText: { fontSize: 13, fontFamily: FontFamily.medium },
    doneToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16 },
    doneToggleText: { fontSize: 13, fontFamily: FontFamily.medium },
});
