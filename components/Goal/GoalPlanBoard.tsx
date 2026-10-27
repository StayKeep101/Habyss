import React, { useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { AppButton } from '@/components/ui/AppButton';
import { IconButton } from '@/components/ui/IconButton';
import { ListItem } from '@/components/ui/Motion';
import { Draggable, DropTarget } from '@/components/ui/DragDrop';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { AppIcon } from '@/components/ui/AppIcon';
import { GoalHabitRow, SectionLabel, ValuePill } from '@/components/Goal/GoalRows';
import { GoalMilestones } from '@/components/Goal/GoalMilestones';
import { GoalDayCard, GoalMonth, GoalMonthKey } from '@/components/Goal/GoalDays';
import { TaskItem } from '@/components/Roadmap/TaskItem';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useWeekStart } from '@/hooks/useWeekStart';
import { useData } from '@/hooks/useData';
import { addDays, type GoalInsights } from '@/lib/goalInsights';
import { goalDays, monthsBetween, periodOf, type GoalDay, type GoalDayItem } from '@/lib/goalPlanPeriod';
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
 * Day shows what that day asks (habits due, tasks due, milestones due).
 * Week is a column of its seven days, each a card with everything it asks,
 * so a week can be planned day by day. Month is a calendar of the month, each
 * day with a bar per thing it asks; tap one to see that day under the grid.
 * All is the same calendar from the day the goal began to its deadline.
 * Adding lives in the goal's ⋯ menu. The arrows step weeks and months.
 *
 * Over the week, the month and all of it sits the to-do list's unplanned
 * to-dos, in a row: touch and hold one and drag it onto a day (a card, or a
 * day in the calendar) to plan it there, or tap it to choose the day. A day's
 * "Plan a task" offers them too. Only days from today to the deadline take one.
 */
export function GoalPlanBoard({ goalId, insights, milestones, today, color, readOnly, pace, onToggleTask, onOpenTask, onRemoveTask, onToggleHabit, onOpenHabit, onEditHabit, onToggleMilestone, onOpenMilestone, onLog, todos = [], planUntil, onPlanTodo, onChooseDay }: {
    goalId: string;
    insights: GoalInsights;
    milestones: Milestone[];
    today: string;
    color: string;
    readOnly?: boolean;
    /** Shown on today's page: how the goal is pacing. */
    pace?: React.ReactNode;
    onToggleTask: (task: Task) => void;
    /** A task to open, or a new one (on `dueDate`, when a day was picked). */
    onOpenTask: (task?: Task, dueDate?: string) => void;
    onRemoveTask: (task: Task) => void;
    onToggleHabit: (habit: Habit) => void;
    onOpenHabit: (habit: Habit) => void;
    onEditHabit: (habit: Habit) => void;
    onToggleMilestone: (milestone: Milestone) => void;
    onOpenMilestone: (milestone: Milestone) => void;
    /** For a goal you measure: write today's progress on it. */
    onLog?: () => void;
    /** The to-do list's to-dos with no day yet. */
    todos?: Task[];
    /** The last day a to-do can be planned on (the deadline). */
    planUntil?: string;
    onPlanTodo?: (task: Task, day: string) => void;
    /** Choose a day for a to-do (the calendar sheet). */
    onChooseDay?: (task: Task) => void;
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

    // Every day of the week, month or whole goal, with what it asks. Past days
    // read the shared history; today follows this page's own ticks at once.
    const shared = useData();
    const [picked, setPicked] = useState<string | null>(null);
    const calendar = useMemo(() => {
        if (range === 'day') return null;
        const allTasks = [...insights.tasks.overdue, ...insights.tasks.upcoming, ...insights.tasks.undated, ...insights.tasks.completed];
        let from: string; let to: string;
        if (range === 'all') {
            // From the day it began to its deadline, and nothing either side;
            // with no deadline, as far as anything is planned, and at least
            // to the end of this month.
            const planned = [...allTasks.map(task => task.dueDate), ...milestones.map(milestone => milestone.dueDate)].filter((day): day is string => !!day).sort();
            const monthEnd = periodOf('month', 0, today, weekStartsMonday).to;
            from = insights.startDate;
            to = insights.daysLeft !== null ? insights.endDate : [insights.endDate, monthEnd, planned[planned.length - 1] ?? ''].sort().pop()!;
            if (to < from) to = from;
            // Two years of calendar at most; further than that is not a plan.
            const cap = addDays(from, 730);
            if (to > cap) to = cap;
        } else ({ from, to } = periodOf(range, offset, today, weekStartsMonday));
        const doneToday = new Set(insights.habits.filter(summary => summary.doneToday).map(summary => summary.habit.id));
        const history = { ...shared.history, [today]: [...(shared.history[today] ?? []).filter(id => !insights.habits.some(summary => summary.habit.id === id)), ...doneToday] };
        const days = goalDays(range === 'month' || range === 'all' ? periodOf('month', 0, from, weekStartsMonday).from : from, range === 'all' ? periodOf('month', 0, to, weekStartsMonday).to : to, {
            habits: insights.habits.map(summary => summary.habit), tasks: allTasks, milestones, history, skips: shared.skips,
        });
        const byDay: Record<string, GoalDay> = {};
        for (const day of days) byDay[day.day] = day;
        return { from, to, days: days.filter(day => day.day >= from && day.day <= to), byDay };
    }, [range, offset, today, weekStartsMonday, insights, milestones, shared.history, shared.skips]);
    const inGoal = (day: string) => !!calendar && day >= calendar.from && day <= calendar.to;
    const chosenDay = calendar && picked && inGoal(picked) ? picked
        : calendar ? (inGoal(today) ? today : calendar.from) : null;

    const toggleItem = (item: GoalDayItem) => {
        if (item.kind === 'habit') onToggleHabit(item.habit);
        else if (item.kind === 'task') onToggleTask(item.task);
        else onToggleMilestone(item.milestone);
    };
    const openItem = (item: GoalDayItem) => {
        if (item.kind === 'habit') onOpenHabit(item.habit);
        else if (item.kind === 'task') onOpenTask(item.task);
        else onOpenMilestone(item.milestone);
    };
    const plannable = (day: string) => !readOnly && day >= today && (!planUntil || day <= planUntil);
    // A day's "Plan a task": one of the to-dos waiting for a day, or a new task.
    const addOnDay = (dayKey: string) => {
        if (!todos.length || !onPlanTodo || !plannable(dayKey)) { onOpenTask(undefined, dayKey); return; }
        const offered = todos.slice(0, 8);
        const labels = [...offered.map(task => task.title), 'New task'];
        const pickIndex = (index: number) => {
            if (index < offered.length) onPlanTodo(offered[index], dayKey);
            else if (index === offered.length) onOpenTask(undefined, dayKey);
        };
        const title = `Plan on ${dateOf(dayKey).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}`;
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions({ title, message: 'From your to-do list', options: [...labels, 'Cancel'], cancelButtonIndex: labels.length }, pickIndex);
        } else {
            Alert.alert(title, undefined, [...labels.map((text, index) => ({ text, onPress: () => pickIndex(index) })), { text: 'Cancel', style: 'cancel' as const }]);
        }
    };
    const dayCard = (day: GoalDay) => (
        <DropTarget key={day.day} id={day.day} accepts={plannable(day.day)} radius={Radius.card}>
            <GoalDayCard day={day} today={today} color={color} readOnly={readOnly}
                onToggle={toggleItem} onOpen={openItem} onAddTask={readOnly ? undefined : addOnDay} />
        </DropTarget>
    );
    // The to-dos waiting for a day, in a row over the calendar.
    const tray = todos.length && !readOnly && onChooseDay ? (
        <View style={styles.tray}>
            <View style={styles.trayHead}>
                <Text style={[styles.trayTitle, { color: t.color.textPrimary }]}>{`To plan · ${todos.length}`}</Text>
                <Text style={[styles.trayHint, { color: t.color.textMuted }]}>Hold one, drag it onto a day</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trayRow}>
                {todos.map(task => (
                    <Draggable key={task.id} payload={task.id} label={task.title}>
                        <Pressable onPress={() => { selectionFeedback(); onChooseDay(task); }} accessibilityRole="button"
                            accessibilityLabel={`${task.title}. Tap to choose a day, or touch and hold and drag it onto a day`}>
                            <MatteSurface radius={t.radius.full} level="control" style={styles.chip}>
                                <View style={[styles.chipMark, { borderColor: t.color.warning }]} />
                                <Text numberOfLines={1} style={[styles.chipText, { color: t.color.textPrimary }]}>{task.title}</Text>
                            </MatteSurface>
                        </Pressable>
                    </Draggable>
                ))}
            </ScrollView>
        </View>
    ) : null;
    const pick = (day: string) => { selectionFeedback(); setPicked(day); };

    const choose = (next: Range) => { setRange(next); setOffset(0); setPicked(null); };
    const step = (by: number) => { selectionFeedback(); setOffset(value => value + by); setPicked(null); };

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

            {range === 'all' && calendar ? (
                <Animated.View key="all" entering={FadeIn.duration(200)}>
                    <View style={styles.body}>
                        {tray}
                        {monthsBetween(calendar.from, calendar.to).map(month => (
                            <View key={month} style={styles.monthBlock}>
                                <GoalMonth month={month} days={calendar.byDay} selected={chosenDay} today={today} color={color}
                                    weekStartsMonday={weekStartsMonday} inRange={inGoal} onSelect={pick} droppable={plannable}
                                    title={dateOf(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} />
                                {chosenDay && chosenDay.slice(0, 7) === month.slice(0, 7) && calendar.byDay[chosenDay] ? dayCard(calendar.byDay[chosenDay]) : null}
                            </View>
                        ))}
                        <GoalMonthKey color={color} />
                    </View>
                </Animated.View>
            ) : range === 'week' && calendar && plan ? (
                <Animated.View key={`week:${offset}`} entering={FadeIn.duration(200)} style={styles.body}>
                    {tray}
                    {plan.overdue.length ? (
                        <View>
                            <SectionLabel first tone={t.color.danger}>Overdue</SectionLabel>
                            {plan.overdue.map(renderTask)}
                        </View>
                    ) : null}
                    {calendar.days.map(day => <ListItem key={day.day}>{dayCard(day)}</ListItem>)}
                </Animated.View>
            ) : range === 'month' && calendar && plan ? (
                <Animated.View key={`month:${offset}`} entering={FadeIn.duration(200)} style={styles.body}>
                    {tray}
                    <GoalMonth month={calendar.from} days={calendar.byDay} selected={chosenDay} today={today} color={color}
                        weekStartsMonday={weekStartsMonday} inRange={inGoal} onSelect={pick} droppable={plannable} />
                    <GoalMonthKey color={color} />
                    {chosenDay && calendar.byDay[chosenDay] ? dayCard(calendar.byDay[chosenDay]) : null}
                    {plan.overdue.length ? (
                        <View>
                            <SectionLabel tone={t.color.danger}>Overdue</SectionLabel>
                            {plan.overdue.map(renderTask)}
                        </View>
                    ) : null}
                </Animated.View>
            ) : plan ? (
                <Animated.View key={`${range}:${offset}`} entering={FadeIn.duration(200)} style={styles.body}>
                    {range === 'day' && offset === 0 && pace ? pace : null}
                    {range === 'day' && offset === 0 && onLog ? <AppButton label="Log progress" icon="create-outline" variant="ghost" onPress={onLog} /> : null}

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
                            <Text style={[styles.emptyBody, { color: t.color.textMuted }]}>Add milestones, tasks and habits from the ⋯ menu.</Text>
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
    monthBlock: { gap: Spacing.md },
    empty: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.section },
    emptyTitle: { fontSize: 16, fontFamily: FontFamily.semibold },
    emptyBody: { fontSize: 13, fontFamily: FontFamily.regular, textAlign: 'center' },
    tray: { gap: Spacing.sm },
    trayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: Spacing.sm },
    trayTitle: { fontSize: 15, fontFamily: FontFamily.semibold },
    trayHint: { fontSize: 12, fontFamily: FontFamily.medium },
    trayRow: { gap: Spacing.sm, paddingRight: Spacing.xl },
    chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, minHeight: 44, maxWidth: 220 },
    chipMark: { width: 14, height: 14, borderRadius: 4, borderWidth: 2 },
    chipText: { fontSize: 15, fontFamily: FontFamily.medium, flexShrink: 1 },
});
