import { useCallback, useEffect, useState } from 'react';
import { getLastNDaysCompletions } from '@/lib/habitsSQLite';
import { on } from '@/lib/appEvents';
import type { HistoryDay } from '@/lib/habitDays';

/**
 * Check-ins and skips for the last `days` days.
 *
 * One loader for every screen that shows history. Each of them used to keep its
 * own copy of this — the same fetch, the same two subscriptions, the same
 * useState — and they drifted: some reloaded on a restore, some did not, so a
 * tab could sit on numbers the rest of the app had already moved past.
 *
 * Returned in both shapes the app asks for. `rows` is the raw record per day,
 * which the statistics read; `history` and `skips` are the same data keyed by
 * date, for screens that look days up one at a time.
 */
export function useHistory(days: number) {
    const [rows, setRows] = useState<HistoryDay[]>([]);
    const [history, setHistory] = useState<Record<string, string[]>>({});
    const [skips, setSkips] = useState<Record<string, string[]>>({});
    const [loaded, setLoaded] = useState(false);

    const [token, setToken] = useState(0);
    /** For pull-to-refresh, which must re-read even when nothing was emitted. */
    const reload = useCallback(() => setToken(value => value + 1), []);

    useEffect(() => {
        let alive = true;
        const load = () => {
            getLastNDaysCompletions(days)
                .then(fetched => {
                    if (!alive) return;
                    const done: Record<string, string[]> = {};
                    const skipped: Record<string, string[]> = {};
                    for (const row of fetched) {
                        done[row.date] = row.completedIds;
                        if (row.skippedIds?.length) skipped[row.date] = row.skippedIds;
                    }
                    setRows(fetched);
                    setHistory(done);
                    setSkips(skipped);
                    setLoaded(true);
                })
                .catch(() => setLoaded(true));
        };
        load();
        const subs = [
            on('habit_completion_updated', load),
            on('cloud_restored', load),
        ];
        return () => { alive = false; subs.forEach(sub => sub.remove()); };
    }, [days, token]);

    return { rows, history, skips, loaded, reload };
}
