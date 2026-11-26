import { useEffect, useMemo, useState } from 'react';
import { useTasks } from '@/hooks/useTasks';
import {
    DEFAULT_TARGET, TARGET_CHANGED, dailyFocus, focusHistory, focusStreak, getDailyTarget,
    type DailyFocus, type DailyTarget,
} from '@/lib/dailyFocus';
import { todayKey } from '@/lib/tasks';
import { on } from '@/lib/appEvents';

/** The number of tasks a day is meant to carry, kept current as it is changed. */
export function useDailyTarget(): DailyTarget {
    const [target, setTarget] = useState<DailyTarget>(DEFAULT_TARGET);
    useEffect(() => {
        let alive = true;
        getDailyTarget().then(value => { if (alive) setTarget(value); }).catch(() => undefined);
        const sub = on(TARGET_CHANGED, (value: DailyTarget) => setTarget(value));
        return () => { alive = false; sub.remove(); };
    }, []);
    return target;
}

/** Today's promise: what is done, what is left, and how far through it is. */
export function useDailyFocus(): DailyFocus & { loaded: boolean; streak: number } {
    const tasks = useTasks();
    const target = useDailyTarget();
    const [today, setToday] = useState(todayKey);

    // The card belongs to a day; it has to notice the day turning over.
    useEffect(() => {
        const timer = setInterval(() => setToday(todayKey()), 60000);
        return () => clearInterval(timer);
    }, []);

    const focus = useMemo(() => dailyFocus(tasks, target, today, today), [tasks, target, today]);
    // Days in a row the 3 (or 5) were done; today joins once it is won.
    const streak = useMemo(() => focusStreak(focusHistory(tasks, target, 400, today)), [tasks, target, today]);
    return { ...focus, streak, loaded: tasks.length > 0 || focus.rows.length === 0 };
}
