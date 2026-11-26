import { useEffect, useSyncExternalStore } from 'react';
import { currentFocusRecords, loadFocusRecords, subscribeFocusRecords, type FocusRecord } from '@/lib/focusStats';

/** Every saved focus session, kept current as new ones are saved. */
export function useFocusRecords(): FocusRecord[] {
    useEffect(() => { void loadFocusRecords(); }, []);
    return useSyncExternalStore(subscribeFocusRecords, currentFocusRecords, currentFocusRecords);
}
