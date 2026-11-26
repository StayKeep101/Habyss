import { useEffect, useMemo, useState } from 'react';
import { useDayData } from '@/hooks/useDayData';
import { useSleep } from '@/hooks/useSleep';
import { useCheckIns } from '@/hooks/useCheckIns';
import { useFocusRecords } from '@/hooks/useFocusRecords';
import { toHistoryDays } from '@/hooks/useEchoCoach';
import { findPatterns, savePatternLines, type Pattern } from '@/lib/echoPatterns';
import { getCompletionTicks } from '@/lib/habitsSQLite';

/**
 * Echo's patterns, from everything the app already holds: habits, tasks,
 * sleep, mood and energy answers, focus sessions, and when habits were
 * ticked (one small query, refreshed when the history changes).
 * Recomputed only when one of those changes.
 */
export function useEchoPatterns(): Pattern[] {
    const data = useDayData();
    const sleep = useSleep();
    const checkIns = useCheckIns();
    const focus = useFocusRecords();
    const [ticks, setTicks] = useState<{ habitId: string; date: string; at: string }[]>([]);
    useEffect(() => {
        let live = true;
        void getCompletionTicks(60).then(rows => { if (live) setTicks(rows); });
        return () => { live = false; };
    }, [data.history]);
    const history = useMemo(() => toHistoryDays(data.history, data.skips), [data.history, data.skips]);
    const patterns = useMemo(() => !data.loaded ? [] : findPatterns({
        habits: data.habits, history, tasks: data.tasks, sleep: sleep.nights,
        checkIns: checkIns.entries, focus, ticks, today: data.today,
    }), [data.loaded, data.habits, history, data.tasks, sleep.nights, checkIns.entries, focus, ticks, data.today]);
    // Kept for the morning check-in, which is written outside any screen.
    useEffect(() => { if (patterns.length) void savePatternLines(patterns); }, [patterns]);
    return patterns;
}
