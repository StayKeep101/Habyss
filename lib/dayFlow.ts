import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { habitMinutes, toMinutes } from './dayPlan';

/**
 * The day as one continuous routine.
 *
 * Every habit and task with a time is laid out in order. The plan is a flow,
 * not a set of slots: the first thing not yet done is the one you are on, and
 * finishing it early does not leave you waiting for the next one's start time —
 * the next starts now, and the ones chained after it move up with it. Running
 * over pushes what follows later. A real gap in the day (lunch, the evening)
 * stays where it is and absorbs the shift, so finishing breakfast early never
 * drags the evening run to 10am.
 *
 * Things with no time sit under the timeline, as "Anytime".
 *
 * Meals (Settings → Meals) are fixed: they never move, and nothing is moved
 * into them. Whatever would land on one is pushed past its end instead.
 */

export interface FlowInput {
    id: string;
    kind: 'habit' | 'task' | 'meal' | 'event';
    title: string;
    /** Minutes from midnight it was planned for; null when it has no time. */
    start: number | null;
    minutes: number;
    done: boolean;
    icon?: string;
    color?: string;
    /** Repeats (a habit), for the little repeat mark. */
    repeats?: boolean;
    /** Never moves, and nothing moves into it (a meal, a calendar event). */
    fixed?: boolean;
    /** For things with no time: lower goes first when the day is filled in. */
    urgency?: number;
}

export interface FlowItem extends FlowInput {
    /** Where it lands now, in minutes from midnight. */
    start: number;
    end: number;
    /** Where it was planned. */
    plannedStart: number;
    /** Minutes it moved from the plan: negative is earlier. */
    shift: number;
    state: 'done' | 'now' | 'next' | 'later';
    /** It had no time: Habyss found it a slot, by urgency. */
    auto?: boolean;
    /** Placed after bedtime, because the day had no room left for it. */
    overflow?: boolean;
}

export interface DayFlow {
    timeline: FlowItem[];
    /** Always empty now: everything without a time is given a slot. Kept for older callers. */
    anytime: FlowInput[];
    /** The item you are on, if any. */
    current: FlowItem | null;
}

/** A gap shorter than this between two planned items chains them together. */
export const CHAIN_GAP = 15;
/** How long something with no length is given on the timeline. */
export const DEFAULT_MINUTES = 30;
/** The first item of the day can be started this early without waiting. */
const EARLY = 10;

/** A breath between two things the scheduler places back to back. */
const BUFFER = 5;

/**
 * Lays the day out as a flow. `now` is minutes from midnight on the day shown,
 * or null for another day (then everything stays where it was planned).
 *
 * Things with no time are not left aside: once the timed ones, meals and
 * calendar events are placed, each is given the first free gap that fits it,
 * most urgent first, between waking and bedtime (and not before now).
 */
export function flowDay(items: FlowInput[], now: number | null, window: { wake: number; sleep: number } = { wake: 7 * 60, sleep: 23 * 60 }): DayFlow {
    const placed = flowTimed(items.filter(item => item.start !== null), now);
    const untimed = items.filter(item => item.start === null);
    if (!untimed.length) return placed;
    return fillDay(placed, untimed, now, window);
}

/** Gives every untimed item a slot, then settles which one is now and next. */
function fillDay(flow: DayFlow, untimed: FlowInput[], now: number | null, window: { wake: number; sleep: number }): DayFlow {
    const sleep = window.sleep > window.wake ? window.sleep : window.sleep + 1440;
    // Busy: everything still to happen, plus anything done that sits ahead of now.
    const busy = flow.timeline.map(item => ({ start: item.start, end: item.end })).sort((a, b) => a.start - b.start);
    const fits = (start: number, minutes: number) => busy.every(slot => start + minutes + BUFFER <= slot.start || start >= slot.end + BUFFER || (slot.end === slot.start));
    const slotFor = (from: number, minutes: number): number | null => {
        // Try the earliest start, then just after each busy block.
        const candidates = [from, ...busy.map(slot => slot.end + BUFFER)].filter(at => at >= from).sort((a, b) => a - b);
        for (const at of candidates) if (at + minutes <= sleep && fits(at, minutes)) return at;
        return null;
    };
    const roundUp = (minutes: number) => Math.ceil(minutes / 5) * 5;
    const order = (a: FlowInput, b: FlowInput) => (a.urgency ?? 50) - (b.urgency ?? 50) || b.minutes - a.minutes || a.title.localeCompare(b.title);
    const timeline = [...flow.timeline];
    let late = Math.max(sleep, ...busy.map(slot => slot.end));

    // Done ones first, from the start of the day, so they hold still as the day goes on.
    const place = (list: FlowInput[], from: number) => {
        for (const item of [...list].sort(order)) {
            const minutes = item.minutes > 0 ? item.minutes : DEFAULT_MINUTES;
            const at = slotFor(from, minutes);
            const start = at ?? late;
            if (at === null) late = start + minutes + BUFFER;
            const placedItem: FlowItem = { ...item, start, end: start + minutes, plannedStart: start, shift: 0, state: item.done ? 'done' : 'later', auto: true, overflow: at === null };
            timeline.push(placedItem);
            busy.push({ start, end: start + minutes });
            busy.sort((a, b) => a.start - b.start);
        }
    };
    place(untimed.filter(item => item.done), window.wake);
    place(untimed.filter(item => !item.done), now === null ? window.wake : Math.max(window.wake, roundUp(now)));
    timeline.sort((a, b) => a.start - b.start);

    // Which is now and which is next, across timed and placed alike.
    let current = flow.current;
    if (!current && now !== null) {
        const first = timeline.find(item => !item.done && !item.fixed && item.state !== 'done');
        if (first && first.auto && first.start <= now + EARLY) {
            const index = timeline.indexOf(first);
            current = { ...first, start: Math.min(first.start, now), state: 'now' };
            timeline[index] = current;
        }
    }
    let nextGiven = false;
    for (let i = 0; i < timeline.length; i++) {
        const item = timeline[i];
        if (item.fixed || item.state === 'done' || item.state === 'now') continue;
        timeline[i] = { ...item, state: !nextGiven && now !== null ? 'next' : 'later' };
        nextGiven = true;
    }
    return { timeline, anytime: [], current };
}

/** The timed part: in order, the one you are on first, the rest moved up or back. */
function flowTimed(items: FlowInput[], now: number | null): DayFlow {
    const timed = items
        .map(item => ({ ...item, plannedStart: item.start as number, minutes: item.minutes > 0 ? item.minutes : DEFAULT_MINUTES }))
        .sort((a, b) => a.plannedStart - b.plannedStart || a.title.localeCompare(b.title));
    const anytime: FlowInput[] = [];

    const timeline: FlowItem[] = [];
    let current: FlowItem | null = null;
    /** Whether the first thing not done has been placed yet. */
    let reachedOpen = false;
    /** Where the flow has got to: the end of the last open item placed. */
    let cursor: number | null = null;
    /** The previous item's planned start and end, to tell a chain from a gap. */
    let previous: { start: number; end: number; done: boolean } | null = null;

    // Meals and anything else fixed: nothing placed may overlap one.
    const fixed = timed.filter(item => item.fixed).map(item => ({ start: item.plannedStart, end: item.plannedStart + item.minutes }));
    const clear = (start: number, minutes: number) => {
        let at = start;
        for (let moved = true; moved;) {
            moved = false;
            for (const slot of fixed) {
                if (at < slot.end && at + minutes > slot.start) { at = slot.end; moved = true; }
            }
        }
        return at;
    };

    for (const item of timed) {
        const plannedEnd = item.plannedStart + item.minutes;
        if (item.fixed) {
            // In the past once it is over, "now" while it lasts; never shifted.
            const state: FlowItem['state'] = now !== null && now >= plannedEnd ? 'done' : now !== null && now >= item.plannedStart ? 'now' : 'later';
            timeline.push({ ...item, start: item.plannedStart, end: plannedEnd, shift: 0, state });
            // What follows waits for the meal to end.
            if (cursor !== null) cursor = Math.max(cursor, plannedEnd);
            previous = { start: item.plannedStart, end: plannedEnd, done: state === 'done' };
            continue;
        }
        if (item.done) {
            timeline.push({ ...item, start: item.plannedStart, end: plannedEnd, shift: 0, state: 'done' });
            previous = { start: item.plannedStart, end: plannedEnd, done: true };
            continue;
        }
        let start = item.plannedStart;
        let state: FlowItem['state'] = 'later';
        if (now !== null && !reachedOpen) {
            reachedOpen = true;
            // You are on it once its time has (nearly) come, or as soon as the
            // one before it is finished and that one's time had come: no
            // waiting for this one's slot.
            const onIt = now >= item.plannedStart - EARLY || (!!previous?.done && now >= previous.start);
            if (onIt) {
                start = Math.min(item.plannedStart, now);
                // Running over: it lasts at least until now.
                const end = Math.max(start + item.minutes, now);
                current = { ...item, start, end, shift: start - item.plannedStart, state: 'now' };
                timeline.push(current);
                cursor = end;
                previous = { start: item.plannedStart, end: plannedEnd, done: false };
                continue;
            }
            state = 'next';
        } else if (now !== null && cursor !== null && previous) {
            const chained = item.plannedStart - previous.end < CHAIN_GAP;
            // Late pushes whatever is still ahead; early only pulls a chain.
            if (cursor > item.plannedStart || chained) start = cursor;
            state = timeline.some(placed => placed.state === 'next') ? 'later' : 'next';
        }
        if (now !== null) start = clear(start, item.minutes);
        const end = start + item.minutes;
        timeline.push({ ...item, start, end, shift: start - item.plannedStart, state });
        if (cursor !== null) cursor = end;
        previous = { start: item.plannedStart, end: plannedEnd, done: false };
    }
    // In time order, now that some have been pushed past a meal.
    timeline.sort((a, b) => a.start - b.start);
    return { timeline, anytime, current };
}

/**
 * How urgent something with no time is: priority first (high 1, low 3), then,
 * for a task, how overdue it is. Lower is sooner.
 */
export function urgencyOf(priority: number | undefined, dueDate: string | undefined, today: string | undefined): number {
    const base = ((priority ?? 2) - 1) * 20;
    if (!dueDate || !today || dueDate >= today) return base + 10;
    const days = Math.round((Date.parse(`${today}T12:00:00`) - Date.parse(`${dueDate}T12:00:00`)) / 86400000);
    return base - Math.min(10, days);
}

/** Today's habits, tasks, meals and calendar events as flow input. */
export function flowInputs(input: {
    habits: Habit[]; tasks: Task[]; done: Record<string, boolean>;
    meals?: { id: string; name: string; start: number; minutes: number }[];
    events?: { id: string; title: string; start: number; minutes: number; color?: string }[];
    today?: string;
}): FlowInput[] {
    const items: FlowInput[] = (input.meals ?? []).map(meal => ({
        id: `meal:${meal.id}`, kind: 'meal' as const, title: meal.name, start: meal.start, minutes: meal.minutes,
        done: false, icon: 'restaurant', fixed: true,
    }));
    for (const event of input.events ?? []) {
        items.push({ id: `event:${event.id}`, kind: 'event', title: event.title, start: event.start, minutes: event.minutes, done: false, icon: 'calendar', color: event.color, fixed: true });
    }
    for (const habit of input.habits) {
        items.push({
            id: habit.id, kind: 'habit', title: habit.name, start: toMinutes(habit.startTime),
            minutes: habitMinutes(habit), done: !!input.done[habit.id], icon: habit.icon, color: habit.color, repeats: true,
            urgency: urgencyOf(habit.priority, undefined, input.today),
        });
    }
    for (const task of input.tasks) {
        if (task.status === 'cancelled') continue;
        const minutes = task.measure === 'time' && task.target ? task.target : Number(task.estimatedMinutes) || 0;
        items.push({ id: task.id, kind: 'task', title: task.title, start: toMinutes(task.dueTime), minutes, done: task.status === 'done',
            urgency: urgencyOf(task.priority, task.dueDate, input.today) });
    }
    return items;
}

/** "8:00–8:30 AM", in the phone's own clock style. */
export function rangeLabel(start: number, end: number): string {
    const at = (minutes: number) => {
        const date = new Date(2000, 0, 1, Math.floor(minutes / 60) % 24, minutes % 60);
        return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    };
    return `${at(start)}–${at(end)}`;
}

/** "30 min", "1 hr", "1 hr 30 min". */
export function lengthLabel(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours) return `${rest} min`;
    return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/**
 * What comes after the thing just finished: the next open item on the
 * timeline, else the first open one with no time. `finishedId` is left out
 * even if the record has not caught up with it yet.
 */
export function upNext(flow: DayFlow, finishedId: string): FlowInput | null {
    const open = (item: FlowInput) => !item.done && !item.fixed && item.id !== finishedId;
    return flow.timeline.find(open) ?? flow.anytime.find(open) ?? null;
}
