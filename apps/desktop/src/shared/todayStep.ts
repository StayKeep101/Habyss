// Copied from Habyss Mobile lib/todayFlow.ts @f48c4da4. Keep in sync; do not re-derive rules. Only nextStep: the rest reads the phone's storage.
import type { DayFlow, FlowItem } from './dayFlow';
/**
 * Focusing all day: what comes next from `now` on today's timeline. A habit
 * or task not done yet, or a meal or calendar event not over yet, in the
 * order the timeline has them; `skip` is the one just finished (its tick may
 * still be saving). An exact-time one that has not started yet comes back
 * with `wait`: the free time before it is the step.
 */
export interface DayStep {
    item: FlowItem; wait: boolean;
    /** A gap before it: free since this minute (the end of the last thing before now). */
    freeFrom?: number;
    /** Nothing on now: habits and tasks whose time went by unticked, which can be fitted in. */
    missed?: string[];
}

export function nextStep(flow: DayFlow | null, now: number, skip?: string): DayStep | null {
    // The next open thing on the line (lib/dayFlow.ts), in its order: a habit
    // or task still open whatever its slot says, a meal or event only until it is over.
    // What is on now comes first, then what comes after now, and only then
    // something whose time has already gone by (Done · Next after the 10:30
    // job used to go back to the 9:00 task, an hour over).
    const open = (flow?.timeline ?? [])
        .filter(entry => entry.id !== skip && !entry.done && entry.state !== 'done' && (!entry.fixed || entry.end > now))
        .sort((a, b) => a.start - b.start);
    const item = open.find(entry => entry.start <= now && entry.end > now)
        ?? open.find(entry => entry.start >= now)
        ?? open[0];
    if (!item) return null;
    // A habit or task can start straight away; a meal or an event waits for its time.
    const waits = !!item.fixed && item.start > now;
    if (item.start <= now && item.end > now) return { item, wait: waits };
    // Nothing on: what went by unticked can be fitted in (lib/dayMemory.ts bringBack).
    const missed = [...new Set((flow?.timeline ?? [])
        .filter(entry => !entry.done && !entry.fixed && !entry.locked && entry.id !== skip && (entry.part?.index ?? 1) === (entry.part?.of ?? 1) && entry.end <= now)
        .map(entry => entry.id))];
    const more = missed.length ? { missed } : null;
    // Free time until it: since the last thing before now ended (or since now, when nothing did).
    if (item.start > now) {
        const before = (flow?.timeline ?? []).filter(entry => entry.end <= now && entry.end > entry.start).map(entry => entry.end);
        return { item, wait: waits, freeFrom: before.length ? Math.max(...before) : now, ...more };
    }
    return { item, wait: waits, ...more };
}
