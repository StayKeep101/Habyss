import { useEffect, useSyncExternalStore } from 'react';
import { currentEndedEarly, endedFor, loadEndedEarly, subscribeEndedEarly } from '@/lib/endedEarly';

/** Meals and events that finished early on `day` (lib/endedEarly.ts). */
export function useEndedEarly(day: string): Record<string, number> {
    useEffect(() => { void loadEndedEarly(); }, []);
    const all = useSyncExternalStore(subscribeEndedEarly, currentEndedEarly, currentEndedEarly);
    return endedFor(all, day);
}
