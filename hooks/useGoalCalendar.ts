import { useMemo } from 'react';
import { useData } from '@/hooks/useData';
import { goalDays, type GoalDay } from '@/lib/goalPlanPeriod';
import type { GoalInsights } from '@/lib/goalInsights';
import type { Milestone } from '@/lib/goalMilestones';

/**
 * What each day from `from` to `to` asks of a goal (its habits, tasks and
 * milestones), by day. Past days read the shared history; today follows the
 * goal page's own ticks at once.
 */
export function useGoalCalendar(insights: GoalInsights | null | undefined, milestones: Milestone[], from: string, to: string, today: string): Record<string, GoalDay> {
    const shared = useData();
    return useMemo(() => {
        if (!insights) return {};
        const tasks = [...insights.tasks.overdue, ...insights.tasks.upcoming, ...insights.tasks.undated, ...insights.tasks.completed];
        const doneToday = new Set(insights.habits.filter(summary => summary.doneToday).map(summary => summary.habit.id));
        const history = { ...shared.history, [today]: [...(shared.history[today] ?? []).filter(id => !insights.habits.some(summary => summary.habit.id === id)), ...doneToday] };
        const byDay: Record<string, GoalDay> = {};
        for (const day of goalDays(from, to, { habits: insights.habits.map(summary => summary.habit), tasks, milestones, history, skips: shared.skips })) byDay[day.day] = day;
        return byDay;
    }, [insights, milestones, from, to, today, shared.history, shared.skips]);
}
