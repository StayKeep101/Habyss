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
 * Things with no time are given a free slot (see fillDay). Something whose
 * time passes without it being done is not left behind: it is fitted in again
 * from now, and says it moved. Something done keeps the slot it was done in,
 * cut short if it was finished early, so the rest of the day moves up.
 *
 * Meals (Settings → Timeline) and calendar events are fixed: they never move,
 * and nothing is moved into them. Whatever would land on one is pushed past
 * its end instead. With flexible meals on, a meal may wait up to two hours
 * when the day is too full for everything otherwise. Waking and bedtime never
 * give: what does not fit between them is listed as not fitting today.
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
    /** 1 easy, 2 medium, 3 hard: hard ones get your best hours. */
    difficulty?: 1 | 2 | 3;
    /**
     * Where it was last placed (lib/dayMemory.ts). Something done stays
     * there; something under way holds it until it runs out.
     */
    kept?: { start: number; end: number };
    /** A meal that may wait when the day is full (Settings → Timeline); otherwise as fixed as any. */
    flex?: boolean;
    /** Habyss found it a slot (it had no time, or its time passed). */
    auto?: boolean;
    /** Its time passed without it being done, so it was fitted in again. */
    moved?: boolean;
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
}

export interface DayFlow {
    timeline: FlowItem[];
    /** Always empty now: everything without a time is given a slot. Kept for older callers. */
    anytime: FlowInput[];
    /** Open things there is no room for between now and bedtime. */
    unfit: FlowInput[];
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
/** How long past its end something can run before it counts as missed and moves. */
export const GRACE = 10;
/** The longest a flexible meal waits for a full day. */
export const MEAL_DELAY = 120;

/**
 * Lays the day out as a flow. `now` is minutes from midnight on the day shown,
 * or null for another day (then everything stays where it was planned).
 *
 * Things with no time are not left aside: once the timed ones, meals and
 * calendar events are placed, each is given the first free gap that fits it,
 * most urgent first, between waking and bedtime (and not before now).
 */
export interface DayWindowMinutes {
    wake: number;
    sleep: number;
    /**
     * Your best hours, from what Echo found (energy peaks, when focus holds,
     * when tasks get finished). Hard things are put here; without it they go
     * first, while the day is fresh.
     */
    peak?: { start: number; end: number } | null;
    /** Being focused on right now: it never counts as missed. */
    active?: string | null;
}

export function flowDay(items: FlowInput[], now: number | null, window: DayWindowMinutes = { wake: 7 * 60, sleep: 23 * 60 }): DayFlow {
    const first = layOut(items, now, window);
    // Flexible meals: when something does not fit, try letting a meal wait,
    // a quarter of an hour at a time, and keep whatever fits the most in.
    const meals = items.filter(item => item.kind === 'meal' && item.flex && item.start !== null && (now === null || (item.start as number) > now));
    if (!first.unfit.length || !meals.length) return first;
    let best = first;
    let bestItems = items;
    const delays: Record<string, number> = {};
    for (const meal of meals) {
        for (let delay = 15; delay <= MEAL_DELAY && best.unfit.length; delay += 15) {
            const trial = bestItems.map(item => item.id === meal.id ? { ...item, start: (meal.start as number) + delay } : item);
            const flow = layOut(trial, now, window);
            if (flow.unfit.length < best.unfit.length) { best = flow; bestItems = trial; delays[meal.id] = delay; }
        }
    }
    // A meal that waited says so, like anything else that moved.
    const timeline = best.timeline.map(item => delays[item.id] ? { ...item, plannedStart: item.start - delays[item.id], shift: delays[item.id] } : item);
    return { ...best, timeline };
}

/**
 * One layout of the day: what is done or under way holds, the rest is fitted
 * around it. Waking and bedtime are walls: anything set (or pushed) outside
 * them is fitted in between instead, and what has no room left is unfit.
 */
function layOut(items: FlowInput[], now: number | null, window: DayWindowMinutes): DayFlow {
    const sleep = window.sleep > window.wake ? window.sleep : window.sleep + 1440;
    // Minutes past midnight before waking belong to a bedtime after midnight.
    const onClock = (minute: number) => (minute < window.wake && sleep > 1440 ? minute + 1440 : minute);
    const inside = (start: number, minutes: number) => onClock(start) >= window.wake && onClock(start) + minutes <= sleep;
    let outside = new Set<string>();
    for (let pass = 0; pass < 3; pass++) {
        const flow = layOutOnce(items, now, window, outside);
        // Something the flow pushed past bedtime (not the one you are on) is fitted again.
        const over = flow.timeline.filter(item => !item.fixed && !item.done && item.state !== 'now' && !outside.has(item.id) && !inside(item.start, item.end - item.start));
        if (!over.length) return flow;
        outside = new Set([...outside, ...over.map(item => item.id)]);
    }
    return layOutOnce(items, now, window, outside);
}

function layOutOnce(items: FlowInput[], now: number | null, window: DayWindowMinutes, outside: Set<string>): DayFlow {
    const timed: FlowInput[] = [];
    const untimed: FlowInput[] = [];
    for (const item of items) {
        const kept = item.kept && item.kept.end > item.kept.start ? item.kept : null;
        if (item.fixed) { timed.push(item); continue; }
        if (item.done) {
            // Done: it stays where it was done. Just ticked, it ends now — cut
            // short if early, or placed where it was really done if its slot
            // had not come yet — in one move, not two (lib/dayMemory.ts agrees).
            let slot = kept;
            if (slot && now !== null && now < slot.end) {
                slot = slot.start <= now ? { start: slot.start, end: Math.max(slot.start + 5, now) } : { start: Math.max(0, now - (slot.end - slot.start)), end: now };
            }
            if (slot) timed.push({ ...item, start: slot.start, minutes: slot.end - slot.start, auto: item.auto || item.start === null || slot.start !== item.start });
            else if (item.start !== null) timed.push(item);
            else untimed.push(item);
            continue;
        }
        if (outside.has(item.id)) { untimed.push({ ...item, start: null, auto: true, moved: item.moved || item.start !== null }); continue; }
        if (now === null) { (item.start !== null ? timed : untimed).push(item); continue; }
        const length = item.minutes > 0 ? item.minutes : DEFAULT_MINUTES;
        const missed = (end: number) => now >= end + GRACE && item.id !== window.active;
        // Its own time, not yet past: it keeps it (the flow may still move it up or back).
        if (item.start !== null && !missed(item.start + length)) { timed.push(item); continue; }
        // A slot Habyss gave it earlier: held while under way, given up once it runs out.
        if (kept && kept.start <= now) {
            if (!missed(kept.end)) { timed.push({ ...item, start: kept.start, minutes: kept.end - kept.start, auto: true, moved: item.moved || item.start !== null }); continue; }
            untimed.push({ ...item, start: null, auto: true, moved: true });
            continue;
        }
        untimed.push({ ...item, start: null, auto: true, moved: item.start !== null || item.moved });
    }
    const placed = flowTimed(timed, now);
    if (!untimed.length) return placed;
    return fillDay(placed, untimed, now, window);
}

/** Gives every untimed item a slot, then settles which one is now and next. */
function fillDay(flow: DayFlow, untimed: FlowInput[], now: number | null, window: DayWindowMinutes): DayFlow {
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
    // Priority first; within it the hardest first, so the hard part is done
    // while there is the most in the tank and the easy things close the day.
    const level = (item: FlowInput) => Math.floor(((item.urgency ?? 30) + 10) / 20);
    const order = (a: FlowInput, b: FlowInput) => level(a) - level(b) || (b.difficulty ?? 2) - (a.difficulty ?? 2)
        || (a.urgency ?? 50) - (b.urgency ?? 50) || b.minutes - a.minutes || a.title.localeCompare(b.title);
    const peak = window.peak ?? null;
    const timeline = [...flow.timeline];
    const unfit: FlowInput[] = [];

    // Done ones first, from the start of the day, so they hold still as the day goes on.
    const place = (list: FlowInput[], from: number) => {
        for (const item of [...list].sort(order)) {
            const minutes = item.minutes > 0 ? item.minutes : DEFAULT_MINUTES;
            // Hard: into your best hours when they are known and still ahead.
            const inPeak = item.difficulty === 3 && peak && peak.end > from ? slotFor(Math.max(from, peak.start), minutes) : null;
            const found = inPeak !== null && peak && inPeak < peak.end ? inPeak : slotFor(from, minutes);
            // Bedtime never gives: what does not fit is listed, not squeezed in.
            if (found === null && !item.done) { unfit.push(item); continue; }
            const start = found ?? window.wake;
            const placedItem: FlowItem = { ...item, start, end: start + minutes, plannedStart: start, shift: 0, state: item.done ? 'done' : 'later', auto: true };
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
    return { timeline, anytime: [], unfit, current };
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
    return { timeline, anytime, unfit: [], current };
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
    /** Meals may wait for a full day (Settings → Timeline). */
    flexibleMeals?: boolean;
    /** Where each was last placed today (lib/dayMemory.ts). */
    kept?: Record<string, { start: number; end: number }>;
}): FlowInput[] {
    const items: FlowInput[] = (input.meals ?? []).map(meal => ({
        id: `meal:${meal.id}`, kind: 'meal' as const, title: meal.name, start: meal.start, minutes: meal.minutes,
        done: false, icon: 'restaurant', fixed: true, flex: !!input.flexibleMeals,
    }));
    for (const event of input.events ?? []) {
        items.push({ id: `event:${event.id}`, kind: 'event', title: event.title, start: event.start, minutes: event.minutes, done: false, icon: 'calendar', color: event.color, fixed: true });
    }
    for (const habit of input.habits) {
        items.push({
            id: habit.id, kind: 'habit', title: habit.name, start: toMinutes(habit.startTime),
            minutes: habitMinutes(habit), done: !!input.done[habit.id], icon: habit.icon, color: habit.color, repeats: true,
            urgency: urgencyOf(habit.priority, undefined, input.today), difficulty: habit.difficulty,
        });
    }
    for (const task of input.tasks) {
        if (task.status === 'cancelled') continue;
        const minutes = task.measure === 'time' && task.target ? task.target : Number(task.estimatedMinutes) || 0;
        items.push({ id: task.id, kind: 'task', title: task.title, start: toMinutes(task.dueTime), minutes, done: task.status === 'done',
            urgency: urgencyOf(task.priority, task.dueDate, input.today), difficulty: task.difficulty });
    }
    if (input.kept) for (const item of items) if (input.kept[item.id] && item.kind !== 'meal' && item.kind !== 'event') item.kept = input.kept[item.id];
    return items;
}

/** "8:30 AM", in the phone's own clock style. */
export function clockLabel(minutes: number): string {
    const date = new Date(2000, 0, 1, Math.floor(minutes / 60) % 24, minutes % 60);
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** "8:00–8:30 AM", in the phone's own clock style. */
export function rangeLabel(start: number, end: number): string {
    return `${clockLabel(start)}–${clockLabel(end)}`;
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
