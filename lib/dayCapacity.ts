/**
 * A day planned to 70%, not 100%. People underestimate how long things take
 * (Buehler et al. 1994: a thesis expected in 34 days took 55), so a day
 * packed to the minute is a day already late. Habits and tasks may take at
 * most this share of the waking hours left once meals and events are placed;
 * past it, the least important open tasks wait off the line ("No room today")
 * rather than being squeezed in. Habits, anything done and anything at an
 * exact time are never taken off. The share is set in lib/dayShare.ts. Pure.
 */

interface Capped { id: string; kind: string; minutes: number; done: boolean; fixed?: boolean; locked?: boolean; anchoredTo?: string; start: number | null; priority?: 1 | 2 | 3; due?: string }

/**
 * Which open tasks do not fit in `share` of the free waking time. Pure.
 * `lengthOf` is the timeline's own length rule, so both count minutes alike.
 * Least important go first: not urgent before urgent, the latest deadline
 * (or none) before the nearest, the longest before the shortest.
 */
export function overCapacity(
    items: Capped[], window: { wake: number; sleep: number }, share: number,
    lengthOf: (item: { kind: string; minutes: number }) => number,
): Set<string> {
    const over = new Set<string>();
    if (share >= 1) return over;
    const bed = window.sleep > window.wake ? window.sleep : window.sleep + 24 * 60;
    const held = (item: Capped) => (item.fixed || item.locked || !!item.anchoredTo) && item.start !== null;
    const fixedMinutes = items.filter(item => item.fixed && item.start !== null).reduce((sum, item) => sum + lengthOf(item), 0);
    const room = Math.max(0, (bed - window.wake - fixedMinutes) * share);
    const work = items.filter(item => !item.fixed);
    let total = work.reduce((sum, item) => sum + lengthOf(item), 0);
    if (total <= room) return over;
    const removable = work
        .filter(item => item.kind === 'task' && !item.done && !held(item))
        .sort((a, b) => (b.priority ?? 2) - (a.priority ?? 2)
            || (b.due ?? '9999').localeCompare(a.due ?? '9999')
            || lengthOf(b) - lengthOf(a)
            || a.id.localeCompare(b.id));
    for (const item of removable) {
        if (total <= room) break;
        over.add(item.id);
        total -= lengthOf(item);
    }
    return over;
}
