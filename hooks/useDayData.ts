import { useCallback, useEffect, useMemo, useState } from 'react';
import { subscribeToHabits, type Habit } from '@/lib/habitsSQLite';
import { localDateKey } from '@/lib/habitSchedule';
import { useData } from '@/hooks/useData';
import type { Task } from '@/lib/tasks';

export interface DayData {
    habits: Habit[];
    tasks: Task[];
    /** Today's check-ins, kept current as habits are ticked anywhere. */
    completions: Record<string, boolean>;
    /** Habits deliberately skipped today. */
    skippedToday: Record<string, boolean>;
    setCompletion: (habitId: string, done: boolean) => void;
    today: string;
    loaded: boolean;
    /** Completed habit ids by day, today included. */
    history: Record<string, string[]>;
    /** Skipped habit ids by day, today included. */
    skips: Record<string, string[]>;
}

/**
 * Every habit and task, today's check-ins and the history behind them, from
 * the one shared copy (lib/dataStore.ts). A tick made on one screen shows at
 * once on the others, before the save comes back.
 */
export function useDayData(): DayData {
    const [habits, setHabits] = useState<Habit[]>([]);
    const [loaded, setLoaded] = useState(false);
    // Ticks a screen has shown before the save comes back; the shared history
    // takes over as soon as it changes.
    const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
    const data = useData();
    const today = localDateKey(new Date());

    useEffect(() => {
        let alive = true;
        const unsubscribe = subscribeToHabits(all => { if (alive) { setHabits(all); setLoaded(true); } });
        return () => { alive = false; unsubscribe.then(stop => stop()); };
    }, []);
    useEffect(() => { setOptimistic({}); }, [data.history, data.skips]);

    const completions = useMemo(() => {
        const done: Record<string, boolean> = {};
        for (const id of data.history[today] ?? []) done[id] = true;
        return { ...done, ...optimistic };
    }, [data.history, today, optimistic]);
    const skippedToday = useMemo(() => {
        const skipped: Record<string, boolean> = {};
        for (const id of data.skips[today] ?? []) skipped[id] = true;
        return skipped;
    }, [data.skips, today]);
    const setCompletion = useCallback((habitId: string, done: boolean) => {
        setOptimistic(prev => ({ ...prev, [habitId]: done }));
    }, []);
    const history = useMemo(
        () => ({ ...data.history, [today]: Object.keys(completions).filter(id => completions[id]) }),
        [data.history, completions, today],
    );

    return {
        habits, tasks: data.tasks, completions, skippedToday, setCompletion, today,
        loaded: loaded && data.historyLoaded && data.tasksLoaded,
        history, skips: data.skips,
    };
}
