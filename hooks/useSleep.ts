import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { currentSleep, refreshSleep, subscribeSleep, type SleepState } from '@/lib/sleepLog';

/** Your recent sleep and goal, from the one copy in lib/sleepLog.ts. */
export function useSleep(): SleepState {
    const sleep = useSyncExternalStore(subscribeSleep, currentSleep, currentSleep);
    useEffect(() => {
        void refreshSleep();
        // Opening the app in the morning reads last night, even if Home stayed mounted.
        const subscription = AppState.addEventListener('change', next => { if (next === 'active') void refreshSleep(); });
        return () => subscription.remove();
    }, []);
    return sleep;
}
