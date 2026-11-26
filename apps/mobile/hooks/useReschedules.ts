import { useEffect, useSyncExternalStore } from 'react';
import { currentReschedules, loadReschedules, reschedulesFor, subscribeReschedules } from '@/lib/reschedule';

/** What was rescheduled on `day` by a swipe, and when (lib/reschedule.ts). */
export function useReschedules(day: string): Record<string, number> {
    useEffect(() => { void loadReschedules(); }, []);
    const all = useSyncExternalStore(subscribeReschedules, currentReschedules, currentReschedules);
    return reschedulesFor(all, day);
}
