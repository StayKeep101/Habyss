import { useEffect, useSyncExternalStore } from 'react';
import { currentCheckIns, loadCheckIns, subscribeCheckIns, type CheckInState } from '@/lib/checkIns';
import { currentFreezes, loadFreezes, subscribeFreezes, type FreezeState } from '@/lib/streakFreeze';

/** Echo's quick-question answers (lib/checkIns.ts). */
export function useCheckIns(): CheckInState {
    useEffect(() => { void loadCheckIns(); }, []);
    return useSyncExternalStore(subscribeCheckIns, currentCheckIns, currentCheckIns);
}


/** Streak freezes held and the days they covered (lib/streakFreeze.ts). */
export function useFreezes(): FreezeState {
    useEffect(() => { void loadFreezes(); }, []);
    return useSyncExternalStore(subscribeFreezes, currentFreezes, currentFreezes);
}
