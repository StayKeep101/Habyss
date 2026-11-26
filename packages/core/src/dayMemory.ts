import type { DayFlow } from './dayFlow';
/**
 * What the timeline remembers about today, so it moves only when it should.
 *
 * - Where each habit and task was last placed. Something done stays in the
 *   slot it was done in (cut short when it was finished early, which frees
 *   the rest of the slot for what comes next), instead of jumping to the
 *   start of the day. Something under way holds its slot until it runs out.
 * - What moved since you last opened it: the green dot on the timeline,
 *   gone once you open it, back if it moves again.
 *
 *
 * Today only; a new day starts empty. Kept on this phone, one copy.
 */
export interface Slot { start: number; end: number }

export interface DayMemory {
    day: string;
    slots: Record<string, Slot>;
    /** Done when last seen, so a fresh tick can be told from an old one. */
    done: Record<string, true>;
    /** Moved since last opened. */
    moved: Record<string, true>;
    /** Had no room before bedtime when last seen. */
    unfit?: Record<string, true>;
    /** Where each done one was before it was ticked: taking the tick back puts it there again. */
    planned?: Record<string, Slot>;
    /** Had their turn and ran out unfinished: they stay at the back of the line until done (lib/dayFlow.ts). */
    lapsed?: Record<string, true>;
    /** Why each one with a dot moved, in a few words ("Moved up · Study done early"). */
    why?: Record<string, string>;
    /** Missed ones brought back into free time, until they have a new place (bringBack). */
    again?: Record<string, true>;
}

/** Moving less than this is the flow breathing, not a change worth a dot. */
export const MOVE_MINUTES = 10;

export const emptyMemory = (day: string): DayMemory => ({ day, slots: {}, done: {}, moved: {} });

/** Today's memory, brought up to date with the flow as it is now. */
export function remember(prev: DayMemory, day: string, flow: DayFlow, now: number): DayMemory {
    const base = prev.day === day ? prev : emptyMemory(day);
    const why: Record<string, string> = { ...base.why };
    // What changed since the line was last seen, to say why something moved.
    const firstOf = (test: (item: DayFlow['timeline'][number]) => boolean) => flow.timeline.find(item => !item.fixed && test(item))?.title;
    const tickedNow = firstOf(item => item.done && !base.done[item.id]);
    const fitted = flow.timeline.some(item => !item.done && !!base.again?.[item.id]);
    const backOn = firstOf(item => !item.done && !!base.done[item.id]);
    const added = Object.keys(base.slots).length ? firstOf(item => !item.done && !base.slots[item.id]) : undefined;
    const reason = (later: boolean) => (later
        ? fitted ? 'Moved back · missed ones fitted in'
            : backOn ? `Moved back · ${backOn} back on`
            : added ? `Moved back · ${added} came first`
            : 'Moved back'
        : tickedNow ? `Moved up · ${tickedNow} done early` : 'Moved up');
    const slots: Record<string, Slot> = {};
    const done: Record<string, true> = {};
    const moved: Record<string, true> = { ...base.moved };
    const planned: Record<string, Slot> = {};
    // Something split around a meal, an event or an exact-time thing is kept whole:
    // from its first part's start to its last part's end. Keeping only the last part
    // meant the one on now was never found at its place, so it started again every minute.
    const whole = (item: { id: string; start: number; end: number }): Slot => {
        const parts = flow.timeline.filter(row => row.id === item.id);
        return { start: Math.min(...parts.map(row => row.start)), end: Math.max(...parts.map(row => row.end)) };
    };
    const shifted: { id: string; start: number; later: boolean }[] = [];
    for (const item of flow.timeline) {
        if (item.fixed) continue;
        if ((item.part?.index ?? 1) !== 1) continue;
        const before = base.slots[item.id];
        if (item.done) {
            done[item.id] = true;
            delete moved[item.id];
            const plan = base.planned?.[item.id] ?? (!base.done[item.id] ? before : undefined);
            if (plan) planned[item.id] = plan;
            // Ticked: it never moves. Where the timeline shows it (lib/dayFlow.ts)
            // is where it stays; this used to move it to "now" and then the
            // timeline put it back, so a ticked item jumped up and down.
            slots[item.id] = whole(item);
            continue;
        }
        slots[item.id] = whole(item);
        // Moved by 10 minutes or more, later or earlier: a dot, and why, until it is opened.
        const shift = before ? item.start - before.start : 0;
        if (before && !base.done[item.id] && item.state !== 'now' && before.end > now && Math.abs(shift) >= MOVE_MINUTES) {
            moved[item.id] = true;
            delete why[item.id];
            shifted.push({ id: item.id, start: item.start, later: shift > 0 });
        }
    }
    // Not in this flow at all (a timeline worked out from a partial list, or before
    // everything loaded): what was known about it stays. Forgetting its slot is
    // what put the thing whose time had run out back at "now" every minute.
    const seenNow = new Set([...flow.timeline, ...flow.unfit].map(item => item.id));
    for (const [id, slot] of Object.entries(base.slots)) {
        if (seenNow.has(id)) continue;
        slots[id] = slot;
        if (base.done[id]) done[id] = true;
        if (base.planned?.[id]) planned[id] = base.planned[id];
    }
    // No longer fits today: that is a change too.
    for (const item of flow.unfit) if (base.slots[item.id]) moved[item.id] = true;
    const unfit = Object.fromEntries(flow.unfit.map(item => [item.id, true as const]));
    // Once its time ran out unfinished, it stays that way today (until it is done).
    const lapsed: Record<string, true> = {};
    for (const [id] of Object.entries(base.lapsed ?? {})) if (!done[id]) lapsed[id] = true;
    for (const item of flow.timeline) if (item.lapsed && !item.done) lapsed[item.id] = true;
    // Pushed off the day after its time ran out: still had its turn.
    for (const item of flow.unfit) if (item.lapsed || (base.slots[item.id] && base.slots[item.id].end <= now)) lapsed[item.id] = true;
    // Said once, on the first one that moved: the rest of the line moved for the same reason.
    const first = shifted.sort((a, b) => a.start - b.start)[0];
    if (first) why[first.id] = reason(first.later);
    for (const id of Object.keys(why)) if (!moved[id]) delete why[id];
    // Brought back: once it has its new place, it is like anything else again.
    const again: Record<string, true> = {};
    for (const id of Object.keys(base.again ?? {})) if (!seenNow.has(id)) again[id] = true;
    return { day, slots, done, moved, unfit, planned, lapsed, why, again };
}

/** Opened: no dot until it moves again. */
export function seen(memory: DayMemory, id: string): DayMemory {
    if (!memory.moved[id]) return memory;
    const moved = { ...memory.moved };
    delete moved[id];
    const why = { ...memory.why };
    delete why[id];
    return { ...memory, moved, why };
}

/** Missed ones put back into today: they lose the place that went by and are fitted in from now. */
export function broughtBack(memory: DayMemory, ids: string[]): DayMemory {
    const slots = { ...memory.slots };
    const lapsed = { ...memory.lapsed };
    const again = { ...memory.again };
    for (const id of ids) { delete slots[id]; delete lapsed[id]; again[id] = true; }
    return { ...memory, slots, lapsed, again };
}
