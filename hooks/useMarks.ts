import { useMemo } from 'react';
import { useSleep } from '@/hooks/useSleep';
import { goodNights } from '@/lib/sleepLog';
import type { GoalsData } from '@/hooks/useGoalInsights';
import { computeMarks, rankFor, type MarksResult } from '@/lib/marks';

export type Marks = MarksResult & ReturnType<typeof rankFor>;

/**
 * Your Marks, from the same data Home already holds, so nothing is read twice
 * and the number moves the instant something is ticked.
 */
export function useMarks(data: Pick<GoalsData, 'habits' | 'tasks' | 'history' | 'skips' | 'insightsById' | 'today'>): Marks {
    const { habits, tasks, history, skips, insightsById, today } = data;
    // Nights that reached your sleep goal earn Marks too (lib/sleepLog.ts).
    const sleep = useSleep();
    const nights = goodNights(sleep).sort().join(',');
    return useMemo(() => {
        // The day each goal first reached 100%, read off its own line.
        const goalsCompletedOn: Record<string, string | null> = {};
        for (const [id, insights] of Object.entries(insightsById)) {
            goalsCompletedOn[id] = insights.series.find(point => point.actual >= 100)?.date ?? null;
        }
        const result = computeMarks({ habits, tasks, history, skips, goalsCompletedOn, goodNights: nights ? nights.split(',') : [], today });
        return { ...result, ...rankFor(result.total) };
    }, [habits, tasks, history, skips, insightsById, today, nights]);
}
