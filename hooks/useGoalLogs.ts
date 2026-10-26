import { useEffect, useSyncExternalStore } from 'react';
import { currentGoalLogs, loadGoalLogs, subscribeGoalLogs, type GoalLog } from '@/lib/goalLogs';

/** Progress written onto goals, by goal id (lib/goalLogs.ts). */
export function useGoalLogs(): Record<string, GoalLog[]> {
    useEffect(() => { void loadGoalLogs(); }, []);
    return useSyncExternalStore(subscribeGoalLogs, currentGoalLogs, currentGoalLogs);
}
