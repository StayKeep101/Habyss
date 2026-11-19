import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { currentGoalFocus, goalModes, loadGoalFocus, subscribeGoalFocus, type GoalMode } from '@/lib/goalFocus';

/** Each goal's mode (focus, at most three, or maintain), for the goals given in age order. */
export function useGoalModes(goalIds: string[]): Record<string, GoalMode> {
    useEffect(() => { void loadGoalFocus(); }, []);
    const chosen = useSyncExternalStore(subscribeGoalFocus, currentGoalFocus, currentGoalFocus);
    const key = goalIds.join('|');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => goalModes(goalIds, chosen), [key, chosen]);
}
