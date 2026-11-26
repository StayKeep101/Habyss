import { useEffect, useSyncExternalStore } from 'react';
import { ensureData, getData, subscribeData, type DataSnapshot } from '@/lib/dataStore';

/**
 * The shared tasks and check-in history (see lib/dataStore.ts). Every screen
 * reads the same copy, so they agree, and opening one costs no query.
 */
export function useData(): DataSnapshot {
    const data = useSyncExternalStore(subscribeData, getData, getData);
    useEffect(() => { void ensureData(); }, []);
    return data;
}
