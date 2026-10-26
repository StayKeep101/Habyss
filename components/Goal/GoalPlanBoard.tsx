import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { IconButton } from '@/components/ui/IconButton';
import { ListItem } from '@/components/ui/Motion';
import { GoalHabitRow, SectionLabel, ValuePill } from '@/components/Goal/GoalRows';
import { GoalMilestones } from '@/components/Goal/GoalMilestones';
import { GoalPlanView } from '@/components/Goal/GoalPlanView';
import { TaskItem } from '@/components/Roadmap/TaskItem';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useWeekStart } from '@/hooks/useWeekStart';
import { addDays, type GoalInsights } from '@/lib/goalInsights';
import { periodOf } from '@/lib/goalPlanPeriod';
import { isHabitScheduledForDate } from '@/lib/habitSchedule';
import type { Habit } from '@/lib/habitsSQLite';
import type { Milestone } from '@/lib/goalMilestones';
import type { Task } from '@/lib/tasks';

type Range = 'day' | 'week' | 'month' | 'all';

const dateOf = (key: string) => new Date(`${key}T12:00:00`);

function periodLabel(range: Exclude<Range, 'all'>, offset: number, from: string, to: string): string {
    const short = (key: string) => dateOf(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    if (range === 'day') {
        if (offset === 0) return 'Today';
        if (offset === 1) return 'Tomorrow';
        if (offset === -1) return 'Yesterday';
        return dateOf(from).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    }
    if (range === 'week') {
        const name = offset === 0 ? 'This week' : offset === 1 ? 'Next week' : offset === -1 ? 'Last week' : null;
        return name ? `${name} · ${short(from)} – ${short(to)}` : `${short(from)} – ${short(to)}`;
    }
    return dateOf(from).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/**
 * A goal's plan, one page: a day, a week, a month, or all of it.
 *
 * Day shows what that day asks (habits due, tasks due, milestones due), the
 * week and the month list it day by day, and the arrows step to the next or
 * previous one. All is the whole roadmap, with milestones, tasks and habits
 * and their Add buttons. Ticking works on today; other days are to look ahead
 * or back.
 */
export function GoalPlanBoard({ goalId, insights, milestones, today, color, readOnly, pace, onToggleTask, onOpenTask, onRemoveTask, onToggleHabit, onOpenHabit, onEditHabit, onToggleMilestone, onOpenMilestone }: {
    goalId: string;
    insights: GoalInsights;
    milestones: Milestone[];
    today: string;
    color: string;
    readOnly?: boolean;
    /** Shown on today's page: how the goal is pacing. */
    pace?: React.ReactNode;
    onToggleTask: (task: Task) => void;
    onOpenTask: (task?: Task) => void;
    onRemoveTask: (task: Task) => void;
    onToggleHabit: (habit: Habit) => void;
    onOpenHabit: (habit: Habit) => void;
    onEditHabit: (habit: Habit) => void;
    onToggleMilestone: (milestone: Milestone) => void;
    onOpenMilestone: (milestone: Milestone) => void;
}) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const weekStartsMonday = useWeekStart() === 'monday';
    const [range, setRange] = useState<Range>('day');
    const [offset, setOffset] = useState(0);

    const plan = useMemo(() => {
        if (range === 'all') return null;
        const { from, to } = periodOf(range, offset, today, weekStartsMonday);
        const holdsToday = from <= today && today <= to;
        const inside = (key?: string) => !!key && key >= from && key <= to;
        const allTasks = [...insights.tasks.overdue, ...insights.tasks.upcoming, ...insights.tasks.completed];
        const tasks = allTasks.filter(task => inside(task.dueDate)).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
        const overdue = holdsToday ? insights.tasks.overdue.filter(task => (task.dueDate ?? '') < from) : [];
        const dueMilestones = milestones.filter(milestone => inside(milestone.dueDate)
            || (holdsToday && !milestone.doneAt && !!milestone.dueDate && milestone.dueDate < from));
        // The habits this period asks for: on a day, those due that day; over
        // a week or a month, each habit due at least once, with its rhythm.
        const days: string[] = [];
        for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
        const habits = insights.habits.filter(summary => days.some(day => isHabitScheduledForDate(summary.habit, dateOf(day))));
        const byDay = days.map(day => ({ day, tasks: tasks.filter(task => task.dueDate === day) })).filter(group => group.tasks.length);
        return { from, to, holdsToday, tasks, overdue, dueMilestones, habits, byDay };
    }, [range, offset, today, weekStartsMonday, insights, milestones]);

    const choose = (next: Range) => { setRange(next); setOffset(0); };
    const step = (by: number) => { selectionFeedback(); setOffset(value => value + by); };

    const renderTask = (task: Task) => (
        <ListItem key={task.id}>
            <TaskItem task={task} today={today} onToggle={onToggleTask} onPress={() => onOpenTask(task)} onEdit={() => onOpenTask(task)} onDelete={onRemoveTask} />
        </ListItem>
    );
    const dayHeading = (day: string) => {
        const name = day === today ? 'Today' : day === addDays(today, 1) ? 'Tomorrow' : dateOf(day).toLocaleDateString(undefined, { weekday: 'long' });
        return `${name} · ${dateOf(day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    };

    return (
        <View style={styles.wrap}>
            <View style={styles.head}>
            <ChoiceRow accessibilityLabel="Show the plan for" value={range} onChange={choose}
                options={[{ id: 'day', label: 'Day' }, { id: 'week', label: 'Week' }, { id: 'month', label: 'Month' }, { id: 'all', label: 'All' }]} />

            {plan ? (
                <View style={styles.period}>
                    <IconButton icon="chevron-back" label={`Previous ${range}`} onPress={() => step(-1)} />
                    <Text numberOfLines={1} style={[styles.periodLabel, { color: t.color.textPrimary }]} accessibilityRole="header"
                        onPress={offset !== 0 ? () => { selectionFeedback(); setOffset(0); } : undefined}>
                        {periodLabel(range as Exclude<Range, 'all'>, offset, plan.from, plan.to)}
                    </Text>
                    <IconButton icon="chevron-forward" label={`Next ${range}`} onPress={() => step(1)} />
                </View>
            ) : null}
            </View>

            {range === 'all' ? (
                <Animated.View key="all" entering={FadeIn.duration(200)}>
                    <GoalPlanView goalId={goalId} embedded readOnly={readOnly} />
                </Animated.View>
            ) : plan ? (
                <Animated.View key={`${range}:${offset}`} entering={FadeIn.duration(200)} style={styles.body}>
                    {range === 'day' && offset === 0 && pace ? pace : null}

                    {plan.dueMilestones.length ? (
                        <View>
                            <SectionLabel first right={<ValuePill value={`${plan.dueMilestones.filter(m => m.doneAt).length}/${plan.dueMilestones.length}`} />}>Milestones</SectionLabel>
                            <GoalMilestones header={false} milestones={plan.dueMilestones} color={color} today={today}
                                onToggle={readOnly ? () => undefined : onToggleMilestone} onOpen={readOnly ? () => undefined : onOpenMilestone} />
                        </View>
                    ) : null}

                    {plan.overdue.length ? (
                        <View>
                            <SectionLabel tone={t.color.danger}>Overdue</SectionLabel>
                            {plan.overdue.map(renderTask)}
                        </View>
                    ) : null}

                    {plan.habits.length ? (
                        <View>
                            <SectionLabel>Habits</SectionLabel>
                            {plan.habits.map(summary => {
                                const tickable = plan.holdsToday && (range !== 'day' || plan.from === today);
                                return (
                                    <GoalHabitRow key={summary.habit.id} summary={summary} color={color}
                                        detail={summary.streak > 1 ? `${summary.schedule} · ${summary.streak} in a row` : summary.schedule}
                                        onToggle={tickable && !readOnly ? () => onToggleHabit(summary.habit) : undefined}
                                        onPress={() => onOpenHabit(summary.habit)}
                                        onLongPress={readOnly ? undefined : () => onEditHabit(summary.habit)} />
                                );
                            })}
                        </View>
                    ) : null}

                    {range === 'day' ? (
                        plan.tasks.length ? (
                            <View>
                                <SectionLabel right={<ValuePill value={`${plan.tasks.filter(task => task.status === 'done').length}/${plan.tasks.length}`} />}>Tasks</SectionLabel>
                                {plan.tasks.map(renderTask)}
                            </View>
                        ) : null
                    ) : plan.byDay.map(group => (
                        <View key={group.day}>
                            <SectionLabel>{dayHeading(group.day)}</SectionLabel>
                            {group.tasks.map(renderTask)}
                        </View>
                    ))}

                    {!plan.tasks.length && !plan.habits.length && !plan.dueMilestones.length && !plan.overdue.length ? (
                        <View style={styles.empty}>
                            <Text style={[styles.emptyTitle, { color: t.color.textPrimary }]}>{`Nothing planned ${range === 'day' ? (offset === 0 ? 'today' : 'that day') : `this ${range}`}`}</Text>
                            <Text style={[styles.emptyBody, { color: t.color.textMuted }]}>Add milestones, tasks and habits in All.</Text>
                        </View>
                    ) : null}
                </Animated.View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
    head: { gap: Spacing.md, paddingHorizontal: Spacing.xl },
    period: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    periodLabel: { flex: 1, textAlign: 'center', fontSize: 16, fontFamily: FontFamily.semibold },
    body: { gap: Spacing.lg, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.section },
    empty: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.section },
    emptyTitle: { fontSize: 16, fontFamily: FontFamily.semibold },
    emptyBody: { fontSize: 13, fontFamily: FontFamily.regular, textAlign: 'center' },
});
