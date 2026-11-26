import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { currentActivity, refreshActivity, subscribeActivity, type ActivityState } from '@/lib/activityLog';

/** Your exercise minutes, steps and goal, from the one copy in lib/activityLog.ts. */
export function useActivity(): ActivityState {
    const activity = useSyncExternalStore(subscribeActivity, currentActivity, currentActivity);
    useEffect(() => {
        void refreshActivity();
        // Back in the app: what the watch has synced since.
        const subscription = AppState.addEventListener('change', next => { if (next === 'active') void refreshActivity(); });
        return () => subscription.remove();
    }, []);
    return activity;
}
