import { useEffect, useSyncExternalStore } from 'react';
import { currentKept, loadKept, subscribeKept } from '@/lib/marksLedger';
import type { KeptPenalty } from '@/lib/marks';

/** The misses of deleted things, which keep counting (lib/marksLedger.ts). */
export function useMarksKept(): KeptPenalty[] {
    useEffect(() => { void loadKept(); }, []);
    return useSyncExternalStore(subscribeKept, currentKept, currentKept);
}
