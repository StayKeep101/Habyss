import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { AppButton } from '@/components/ui/AppButton';
import { GoalMonth } from '@/components/Goal/GoalDays';
import { Spacing } from '@/theme/designSystem';
import { useWeekStart } from '@/hooks/useWeekStart';
import { useGoalCalendar } from '@/hooks/useGoalCalendar';
import { monthsBetween } from '@/lib/goalPlanPeriod';
import type { GoalInsights } from '@/lib/goalInsights';
import type { Milestone } from '@/lib/goalMilestones';
import type { Task } from '@/lib/tasks';

const monthTitle = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

/**
 * "Plan on a day" for one to-do: the goal's calendar from today to its
 * deadline (and no further), each day with a bar for what it already asks,
 * so you can see a busy day before choosing it. Tapping a day plans the to-do
 * there. One already planned can be taken off its day.
 */
export function PlanDaySheet({ task, insights, milestones, today, from, to, color, onPlan, onClose }: {
    task: Task | null;
    insights: GoalInsights;
    milestones: Milestone[];
    today: string;
    from: string;
    to: string;
    color: string;
    /** A day, or null to take it off its day. */
    onPlan: (task: Task, day: string | null) => void;
    onClose: () => void;
}) {
    const weekStartsMonday = useWeekStart() === 'monday';
    const byDay = useGoalCalendar(insights, milestones, from, to, today);
    // Kept while the sheet slides away.
    const [shown, setShown] = useState<Task | null>(task);
    if (task && task !== shown) setShown(task);
    const inRange = (day: string) => day >= from && day <= to;
    // Every month up to the deadline, drawn a few at a time so the sheet opens
    // at once even when the deadline is a year away; it ends at the deadline.
    const months = monthsBetween(from, to);
    const [shownMonths, setShownMonths] = useState(3);
    useEffect(() => {
        if (!task) { setShownMonths(3); return; }
        if (shownMonths >= months.length) return;
        const more = setTimeout(() => setShownMonths(count => count + 3), 200);
        return () => clearTimeout(more);
    }, [task, shownMonths, months.length]);
    return (
        <VoidSheet visible={!!task} onClose={onClose} title="Plan on a day" caption={shown?.title} maxShare={0.85} scrollable
            footer={shown?.dueDate ? <AppButton label="Take off its day" variant="ghost" onPress={() => shown && onPlan(shown, null)} /> : undefined}>
            <View style={styles.months}>
                {months.slice(0, shownMonths).map(month => (
                    <GoalMonth key={month} month={month} days={byDay} selected={shown?.dueDate ?? null} today={today} color={color}
                        weekStartsMonday={weekStartsMonday} inRange={inRange} title={monthTitle(month)} still compact
                        onSelect={day => shown && onPlan(shown, day)} />
                ))}
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    months: { gap: Spacing.lg, paddingBottom: Spacing.md },
});
