import { useEffect, useSyncExternalStore } from 'react';
import { currentMemory, loadMemory, subscribeMemory, type DayMemory } from '@/lib/dayMemory';

/** What the timeline remembers about today (lib/dayMemory.ts). */
export function useDayMemory(): DayMemory {
    useEffect(() => { void loadMemory(); }, []);
    return useSyncExternalStore(subscribeMemory, currentMemory, currentMemory);
}
