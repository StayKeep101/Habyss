import { useMemo } from 'react';
import { useData } from '@/hooks/useData';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import type { GoalsData } from '@/hooks/useGoalInsights';
import { bestStreakFrom, streakFrom } from '@/lib/dayComplete';

/**
 * Your streak and your best, worked out once the way Home works it out: the
 * whole shared history with today's ticks merged in, habits (not goals) and
 * tasks, against the daily target. A page that shows a streak reads it here,
 * so two screens never disagree about the same run.
 */
export function useStreak(goals: Pick<GoalsData, 'habits' | 'completions' | 'today'>): { streak: number; bestStreak: number; completedDates: string[] } {
    const data = useData();
    const target = useDailyTarget();
    const { habits, completions, today } = goals;
    return useMemo(() => {
        const history = { ...data.history, [today]: Object.keys(completions).filter(id => completions[id]) };
        const run = streakFrom(habits.filter(habit => !habit.isGoal), data.tasks, history, data.skips, today, undefined, target);
        return { streak: run.streak, bestStreak: bestStreakFrom(run.completedDates), completedDates: run.completedDates };
    }, [data.history, data.skips, data.tasks, habits, completions, today, target]);
}
