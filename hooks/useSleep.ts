import { useEffect, useSyncExternalStore } from 'react';
import { currentSleep, refreshSleep, subscribeSleep, type SleepState } from '@/lib/sleepLog';

/** Your recent sleep and goal, from the one copy in lib/sleepLog.ts. */
export function useSleep(): SleepState {
    const sleep = useSyncExternalStore(subscribeSleep, currentSleep, currentSleep);
    useEffect(() => { void refreshSleep(); }, []);
    return sleep;
}
