import { useCallback } from 'react';
import { useData } from '@/hooks/useData';
import { historyWindow, reloadData } from '@/lib/dataStore';

/**
 * Check-ins and skips for the last `days` days, today included.
 *
 * A window onto the one shared history (lib/dataStore.ts), so every screen
 * that shows history agrees with every other, and a tick anywhere moves them
 * all at once.
 *
 * Returned in both shapes the app asks for. `rows` is the raw record per day,
 * which the statistics read; `history` and `skips` are the same data keyed by
 * date, for screens that look days up one at a time.
 */
export function useHistory(days: number) {
    const data = useData();
    const { rows, history, skips } = historyWindow(days, data);
    /** For pull-to-refresh, which must re-read even when nothing was emitted. */
    const reload = useCallback(() => { void reloadData(); }, []);
    return { rows, history, skips, loaded: data.historyLoaded, reload };
}
