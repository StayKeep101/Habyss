import { useEffect, useMemo, useState } from 'react';
import { focusPlan, type FocusPlan } from '@/lib/focusLength';
import type { Habit } from '@/lib/habitsSQLite';
import type { Task } from '@/lib/tasks';

type Slot = { start: number; end: number; cutFrom?: number; parts?: { start: number; end: number }[]; breaks?: (string | null)[] } | null;

/** After this part of a split one: how long is still to come, and what comes in between. */
export interface FocusThen { minutes: number; after: string | null }

/**
 * The part of a split habit or task that focus is for: the one on now, or the
 * next to come, or the last. A task split around lunch focuses until lunch.
 */
export function partNow(slot: NonNullable<Slot>, now: number): { part: { start: number; end: number }; then: FocusThen | null } {
    const parts = slot.parts ?? [{ start: slot.start, end: slot.end }];
    let index = parts.findIndex(part => now < part.end);
    if (index < 0) index = parts.length - 1;
    const rest = parts.slice(index + 1).reduce((sum, part) => sum + (part.end - part.start), 0);
    return { part: parts[index], then: rest > 0 ? { minutes: rest, after: slot.breaks?.[index] ?? null } : null };
}

/**
 * The focus length for a habit or task today (lib/focusLength.ts), with
 * today's timeline read once so a cut-short one gets its cut length.
 * `ready` is false until the timeline has been read; `since` is when it
 * begins on today's timeline (ms), so the clock can count from then.
 */
export function useFocusPlan(id: string | undefined, item: { habit?: Habit | null; task?: Task | null }, banked = 0): FocusPlan & { ready: boolean; since: number | null; then: FocusThen | null } {
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
    return useMemo(() => {
        const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
        const plan = focusPlan({ habit: item.habit, task: item.task, slot, banked });
        // Split around something fixed: focus runs to where this part ends, and
        // says how much comes after (37 minutes now, 53 after lunch; not 90 at once).
        if (slot?.parts && slot.parts.length > 1) {
            const now = Math.round((Date.now() - midnight.getTime()) / 60000);
            const { part, then } = partNow(slot, now);
            const seconds = Math.max(60, (part.end - part.start) * 60);
            return { ...plan, seconds, length: seconds, cutFrom: null, ready, since: midnight.getTime() + part.start * 60000, then };
        }
        const since = slot ? midnight.getTime() + slot.start * 60000 : null;
        return { ...plan, ready, since, then: null };
    }, [item.habit, item.task, slot, banked, ready]);
}
