import { useEffect, useSyncExternalStore } from 'react';
import { currentClockStyle, loadClockStyle, subscribeClockStyle, type ClockStyle } from '@/lib/focusClock';

/** The focus clock's look, kept in step with Settings. */
export function useClockStyle(): ClockStyle {
    useEffect(() => { void loadClockStyle(); }, []);
    return useSyncExternalStore(subscribeClockStyle, currentClockStyle, currentClockStyle);
}
