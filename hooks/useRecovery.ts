import { useMemo } from 'react';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { toHistoryDays } from '@/hooks/useEchoCoach';
import { recovery, type Recovery } from '@/lib/recovery';

/**
 * Never miss twice (lib/recovery.ts): how often a miss stayed a single miss
 * over the last 90 days, and the habits missed last time and due again today.
 */
export function useRecovery(): Recovery {
    const { habits, history, skips, completions, today } = useGoalsInsights();
    return useMemo(() => recovery(habits, toHistoryDays(history, skips), completions, 90, today), [habits, history, skips, completions, today]);
}
