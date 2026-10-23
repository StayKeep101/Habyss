import { useEffect, useMemo, useState } from 'react';
import { focusPlan, type FocusPlan } from '@/lib/focusLength';
import type { Habit } from '@/lib/habitsSQLite';
import type { Task } from '@/lib/tasks';

type Slot = { start: number; end: number; cutFrom?: number } | null;

/**
 * The focus length for a habit or task today (lib/focusLength.ts), with
 * today's timeline read once so a cut-short one gets its cut length.
 * `ready` is false until the timeline has been read.
 */
export function useFocusPlan(id: string | undefined, item: { habit?: Habit | null; task?: Task | null }, banked = 0): FocusPlan & { ready: boolean } {
    const [slot, setSlot] = useState<Slot>(null);
    const [ready, setReady] = useState(false);
    useEffect(() => {
        if (!id) return;
        let alive = true;
        void (require('@/lib/todayFlow') as typeof import('@/lib/todayFlow')).todayTimes()
            .then(times => { if (alive) setSlot(times[id] ?? null); })
            .catch(() => undefined)
            .finally(() => { if (alive) setReady(true); });
        return () => { alive = false; };
    }, [id]);
    return useMemo(() => ({ ...focusPlan({ habit: item.habit, task: item.task, slot, banked }), ready }), [item.habit, item.task, slot, banked, ready]);
}
