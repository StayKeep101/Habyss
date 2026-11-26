import { useMemo } from 'react';
import { useData } from '@/hooks/useData';
import { useDailyTarget } from '@/hooks/useDailyFocus';
import type { DayData } from '@/hooks/useDayData';
import { bestStreakFrom, streakFrom } from '@/lib/dayComplete';
import { useTimeOffPeriods } from '@/hooks/useTimeOff';

/**
 * Your streak and your best, worked out once the way Home works it out: the
 * whole shared history with today's ticks merged in, habits and tasks, against the daily target. A page that shows a streak reads it here,
 * so two screens never disagree about the same run.
 */
export function useStreak(day: Pick<DayData, 'habits' | 'completions' | 'today'>): { streak: number; bestStreak: number; completedDates: string[] } {
    const data = useData();
    const target = useDailyTarget();
    // Days off keep the run: it is counted again when time off starts or ends.
    const timeOff = useTimeOffPeriods();
    const { habits, completions, today } = day;
    return useMemo(() => {
        const history = { ...data.history, [today]: Object.keys(completions).filter(id => completions[id]) };
        const run = streakFrom(habits, data.tasks, history, data.skips, today, undefined, target);
        return { streak: run.streak, bestStreak: bestStreakFrom(run.completedDates), completedDates: run.completedDates };
    }, [data.history, data.skips, data.tasks, habits, completions, today, target, timeOff]);
}
