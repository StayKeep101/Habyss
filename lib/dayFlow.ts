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
 * Flexible things go in order of importance (see fillDay): the next one is
 * always the most important left, never whatever happens to fit. The one you
 * are on stays yours however long it runs; one that began and was left for
 * another is fitted in again, and says it moved. Something done keeps the slot
 * it was done in, cut short if it was finished early, so the rest moves up.
 *
 * Meals (Settings → Timeline) and calendar events are fixed: they never move,
 * and nothing is moved into them. Whatever would land on one is pushed past
 * its end instead. With flexible meals on, a meal may wait up to two hours
 * when the day is too full for everything otherwise. Waking and bedtime never
 * give: when there is not time for everything, the last thing of the day gets
 * the time that is left; only what then has no room at all is listed.
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
    /**
     * A habit or task at an exact time (not flexible): it stays at that time
     * whatever else runs over or finishes early, and nothing is put on top of
     * it — but unlike a meal it can be ticked and focused on.
     */
    locked?: boolean;
    /** Habyss found it a slot (it had no time, or its time passed). */
    auto?: boolean;
    /** The time a flexible one was given: it orders it among equals, never pins it. */
    preferred?: number;
    /** Its time passed without it being done, so it was fitted in again. */
    moved?: boolean;
    /** A task's "due by" day, shown on its row. */
    deadline?: string;
    /** When it was ticked, in minutes from midnight on the day shown. */
    doneAt?: number;
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
    /** Cut short to fit the day: how long it was meant to take. */
    cutFrom?: number;
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

/** No breaks: the next thing the scheduler places starts the moment the last one ends. */
export const breakAfter = (_minutes: number) => 0;
/** How long past its end something can run before it counts as missed and moves. */
export const GRACE = 10;
/** The longest a flexible meal waits for a full day. */
export const MEAL_DELAY = 120;
/** The shortest anything is cut to, to fit a full day. */
export const MIN_CUT = 10;

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
    // How much the day had to give: anything left out counts far more than minutes cut.
    const cost = (flow: DayFlow) => flow.unfit.length * 10000 + flow.timeline.reduce((sum, item) => sum + (item.cutFrom ? item.cutFrom - (item.end - item.start) : 0), 0);
    if (!cost(first)) return first;
    let best = first;
    let bestItems = items;
    // Flexible meals: when the day is too short, try letting a meal wait, a
    // quarter of an hour at a time, and keep whatever gives up the least.
    const meals = items.filter(item => item.kind === 'meal' && item.flex && item.start !== null && (now === null || (item.start as number) > now));
    const delays: Record<string, number> = {};
    for (const meal of meals) {
        for (let delay = 15; delay <= MEAL_DELAY && cost(best); delay += 15) {
            const trial = bestItems.map(item => item.id === meal.id ? { ...item, start: (meal.start as number) + delay } : item);
            const flow = layOut(trial, now, window);
            if (cost(flow) < cost(best)) { best = flow; bestItems = trial; delays[meal.id] = delay; }
        }
    }
    // A meal that waited says so.
    const timeline = best.timeline.map(item => (delays[item.id] ? { ...item, plannedStart: item.start - delays[item.id], shift: delays[item.id] } : item));
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
        const over = flow.timeline.filter(item => !item.fixed && !item.locked && !item.done && item.state !== 'now' && !outside.has(item.id) && !inside(item.start, item.end - item.start));
        if (!over.length) return flow;
        outside = new Set([...outside, ...over.map(item => item.id)]);
    }
    return layOutOnce(items, now, window, outside);
}

function layOutOnce(items: FlowInput[], now: number | null, window: DayWindowMinutes, outside: Set<string>): DayFlow {
    // The one you are on: of the flexible things whose slot has begun, the one
    // being focused on, else the last one started. It stays yours however long
    // it takes: 20 minutes planned and four hours spent, it is still the one
    // you are on, and the rest waits behind it. The others that began and were
    // left are fitted in again.
    //
    // Its start never moves: something planned at 4 PM that is still not ticked
    // at 4:42 reads 4:00 onwards, running past its end until it is ticked, not
    // a fresh two hours from now. Where it was placed today (kept), else the
    // time it was given.
    const anchor = (item: FlowInput) => (item.kept && item.kept.end > item.kept.start ? item.kept
        : item.start !== null && item.minutes > 0 && item.start >= window.wake ? { start: item.start, end: item.start + item.minutes } : null);
    const started = now === null ? [] : items.filter(item => !item.fixed && !item.done && !(item.locked && item.start !== null)
        && !outside.has(item.id) && (anchor(item)?.start ?? Infinity) <= now);
    // Several begun and not ticked: the one being focused on, else the one
    // that comes first by the rules (tasks, then urgency, then difficulty).
    const onIt = (started.find(item => item.id === window.active) ?? [...started].sort(priorityOrder)[0])?.id ?? null;
    // A meeting or a meal never gives way to it: the first fixed block that
    // begins inside its slot ends it there. If that block has already begun,
    // it is no longer the one you are on; it is fitted in again after.
    const blocks = items.filter(item => item.fixed && item.start !== null).map(item => ({ start: item.start as number, end: (item.start as number) + item.minutes }));
    const wallFor = (kept: { start: number; end: number }) => {
        const until = Math.max(kept.end, now ?? kept.end);
        return blocks.filter(block => block.start > kept.start && block.start < until).sort((a, b) => a.start - b.start)[0] ?? null;
    };
    const timed: FlowInput[] = [];
    const untimed: FlowInput[] = [];
    for (const item of items) {
        const kept = item.kept && item.kept.end > item.kept.start ? item.kept : null;
        const held = item.id === onIt ? anchor(item) : null;
        if (item.fixed) { timed.push(item); continue; }
        if (item.done) {
            // Done: shown where it was done, the same way every time — ending
            // the moment it was ticked and as long as it was expected to take
            // (its cut length, if it was cut). A 30-minute task ticked at 5:55
            // reads 5:25–5:55, early or late, ticked here, on Home or the watch.
            const planned = item.minutes > 0 ? item.minutes : DEFAULT_MINUTES;
            const expected = Math.max(5, kept ? Math.min(planned, kept.end - kept.start) : planned);
            const at = item.doneAt ?? (kept && now !== null && now < kept.end ? now : undefined);
            let slot = kept;
            if (at !== undefined) { const start = Math.max(0, at - expected); slot = { start, end: Math.max(at, start + 1) }; }
            if (slot) timed.push({ ...item, start: slot.start, minutes: slot.end - slot.start, auto: item.auto || item.start === null || slot.start !== item.start });
            else if (item.start !== null) timed.push(item);
            else untimed.push(item);
            continue;
        }
        // Exact time: it stays there, missed or not.
        if (item.locked && item.start !== null) { timed.push(item); continue; }
        // Flexible (everything not at an exact time): it does not have to start
        // at its time. It is fitted in by priority, its length kept unless the
        // day is too short; a time it was given only orders it among equals
        // (and places it on a day that is not today, when that time is free).
        const floating: FlowInput = { ...item, start: null, auto: true, preferred: item.start ?? undefined };
        if (now === null || outside.has(item.id)) { untimed.push(floating); continue; }
        // Under way: it holds its slot, running on past its end until it is done,
        // up to the next meeting or meal.
        if (held) {
            const wall = wallFor(held);
            if (!wall) { timed.push({ ...item, start: held.start, minutes: held.end - held.start, auto: true }); continue; }
            if (wall.start > now) { timed.push({ ...item, start: held.start, minutes: wall.start - held.start, auto: true }); continue; }
        }
        untimed.push({ ...floating, moved: !!kept && kept.start <= now });
    }
    const placed = flowTimed(timed, now);
    if (!untimed.length) return placed;
    return fillDay(placed, untimed, now, window);
}

/** 1 urgent (set as urgent, overdue, or a deadline in a day or two), 2 normal, 3 not urgent. */
const urgencyLevel = (item: FlowInput) => Math.floor(((item.urgency ?? 30) + 10) / 20);
/**
 * What goes first, strictly, in this order of rules:
 *   1. tasks before habits: a task has to get done, a habit comes round again;
 *   2. then the more urgent (urgent, normal, not urgent; overdue and near
 *      deadlines count as urgent);
 *   3. then the harder (hard, medium, easy);
 *   4. then the finer urgency (how overdue, how close the deadline), the time
 *      it was given, the longer one, and the name.
 */
export function priorityOrder(a: FlowInput, b: FlowInput): number {
    const kindRank = (item: FlowInput) => (item.kind === 'task' ? 0 : 1);
    return kindRank(a) - kindRank(b) || urgencyLevel(a) - urgencyLevel(b) || (b.difficulty ?? 2) - (a.difficulty ?? 2)
        || (a.urgency ?? 50) - (b.urgency ?? 50) || (a.preferred ?? a.start ?? 1440) - (b.preferred ?? b.start ?? 1440) || b.minutes - a.minutes || a.title.localeCompare(b.title);
}

/** Gives every untimed item a slot, then settles which one is now and next. */
function fillDay(flow: DayFlow, untimed: FlowInput[], now: number | null, window: DayWindowMinutes): DayFlow {
    const sleep = window.sleep > window.wake ? window.sleep : window.sleep + 1440;
    // Busy: everything still to happen, plus anything done that sits ahead of now.
    const busy = flow.timeline.map(item => ({ start: item.start, end: item.end })).sort((a, b) => a.start - b.start);
    const fits = (start: number, minutes: number) => busy.every(slot => start + minutes + breakAfter(minutes) <= slot.start || start >= slot.end + breakAfter(slot.end - slot.start) || (slot.end === slot.start));
    const slotFor = (from: number, minutes: number): number | null => {
        // Try the earliest start, then just after each busy block.
        const candidates = [from, ...busy.map(slot => slot.end + breakAfter(slot.end - slot.start))].filter(at => at >= from).sort((a, b) => a - b);
        for (const at of candidates) if (at + minutes <= sleep && fits(at, minutes)) return at;
        return null;
    };
    const roundUp = (minutes: number) => Math.ceil(minutes / 5) * 5;
    const order = priorityOrder;
    const peak = window.peak ?? null;
    const timeline = [...flow.timeline];
    const unfit: FlowInput[] = [];

    /** The longest free stretch from `from` on, for something that no longer fits whole. */
    const roomFrom = (from: number, least: number): { at: number; minutes: number } | null => {
        let room: { at: number; minutes: number } | null = null;
        const candidates = [from, ...busy.map(slot => slot.end + breakAfter(slot.end - slot.start))].filter(at => at >= from);
        for (const at of candidates) {
            if (!fits(at, least)) continue;
            const wall = Math.min(sleep, ...busy.filter(slot => slot.start >= at && slot.end > slot.start).map(slot => slot.start));
            const minutes = Math.floor((wall - at) / 5) * 5;
            if (minutes >= least && (!room || minutes > room.minutes)) room = { at, minutes };
        }
        return room;
    };

    // Done ones first, from the start of the day, so they hold still as the day goes on.
    const place = (list: FlowInput[], from: number) => {
        // Today the most important thing left always gets the first place it
        // fits, whether or not the day has room for everything; something less
        // important only takes a gap it could not use (before a meeting, say).
        for (const item of [...list].sort(order)) {
            let minutes = item.minutes > 0 ? item.minutes : DEFAULT_MINUTES;
            const strict = now !== null && !item.done;
            // Another day: hard ones into your best hours, and a flexible one at
            // the time it was given, if free.
            const inPeak = !strict && item.difficulty === 3 && peak && peak.end > from ? slotFor(Math.max(from, peak.start), minutes) : null;
            const atPreferred = now === null && item.preferred !== undefined && item.preferred >= from ? slotFor(item.preferred, minutes) : null;
            let found = atPreferred ?? (inPeak !== null && peak && inPeak < peak.end ? inPeak : slotFor(from, minutes));
            let cutFrom: number | undefined;
            if (found === null && !item.done) {
                // Bedtime never gives, so the last thing of the day gets whatever time is left.
                const room = roomFrom(from, Math.min(MIN_CUT, minutes));
                if (!room) { unfit.push(item); continue; }
                found = room.at;
                if (room.minutes < minutes) { cutFrom = minutes; minutes = room.minutes; }
            }
            const start = found ?? window.wake;
            const placedItem: FlowItem = { ...item, start, end: start + minutes, plannedStart: start, shift: 0, state: item.done ? 'done' : 'later', auto: true, ...(cutFrom ? { cutFrom } : null) };
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
            // Starting now rather than in a few minutes: the whole slot moves, its length kept.
            const early = first.start - Math.min(first.start, now);
            current = { ...first, start: first.start - early, end: first.end - early, state: 'now' };
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
    const fixed = timed.filter(item => item.fixed || (item.locked && !item.done)).map(item => ({ start: item.plannedStart, end: item.plannedStart + item.minutes }));
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
        if (item.locked) {
            // At its exact time: on while it lasts, never moved.
            const on = now !== null && now >= item.plannedStart && now < plannedEnd;
            const placedItem: FlowItem = { ...item, start: item.plannedStart, end: plannedEnd, shift: 0, state: on ? 'now' : 'later' };
            timeline.push(placedItem);
            if (on && !current) current = placedItem;
            if (cursor !== null) cursor = Math.max(cursor, plannedEnd);
            previous = { start: item.plannedStart, end: plannedEnd, done: false };
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
 * for a task, how overdue it is, or how close its deadline. Lower is sooner.
 */
export function urgencyOf(priority: number | undefined, dueDate: string | undefined, today: string | undefined, deadline?: string): number {
    const base = ((priority ?? 2) - 1) * 20;
    const by = deadline ?? dueDate;
    if (!by || !today) return base + 10;
    const days = Math.round((Date.parse(`${by}T12:00:00`) - Date.parse(`${today}T12:00:00`)) / 86400000);
    if (days < 0) return base - Math.min(10, -days);
    // A deadline in the next few days pulls it ahead of others at its priority.
    return deadline ? base + 10 - Math.max(0, 5 - days) * 2 : base + 10;
}

/** Today's habits, tasks, meals and calendar events as flow input. */
export function flowInputs(input: {
    habits: Habit[]; tasks: Task[]; done: Record<string, boolean>;
    /** The day shown (today when left out), to read when things were ticked on it. */
    day?: string;
    /** When each habit was ticked on that day (ISO), from its completion. */
    doneTimes?: Record<string, string>;
    meals?: { id: string; name: string; start: number; minutes: number }[];
    events?: { id: string; title: string; start: number; minutes: number; color?: string }[];
    today?: string;
    /** Meals may wait for a full day (Settings → Timeline). */
    flexibleMeals?: boolean;
    /** Where each was last placed today (lib/dayMemory.ts). */
    kept?: Record<string, { start: number; end: number }>;
    /** Where each done one was planned before it was ticked, so taking the tick back puts it back. */
    planned?: Record<string, { start: number; end: number }>;
}): FlowInput[] {
    // A tick's time, in minutes from midnight, when it was made on the day shown.
    const day = input.day ?? input.today;
    const minuteOn = (iso?: string) => {
        if (!iso || !day) return undefined;
        const at = new Date(iso);
        if (!Number.isFinite(at.getTime())) return undefined;
        const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
        return key === day ? at.getHours() * 60 + at.getMinutes() : undefined;
    };
    const items: FlowInput[] = (input.meals ?? []).map(meal => ({
        id: `meal:${meal.id}`, kind: 'meal' as const, title: meal.name, start: meal.start, minutes: meal.minutes,
        done: false, icon: 'restaurant', fixed: true, flex: !!input.flexibleMeals,
    }));
    for (const event of input.events ?? []) {
        items.push({ id: `event:${event.id}`, kind: 'event', title: event.title, start: event.start, minutes: event.minutes, done: false, icon: 'calendar', color: event.color, fixed: true });
    }
    for (const habit of input.habits) {
        items.push({
            id: habit.id, kind: 'habit', title: habit.name, start: toMinutes(habit.startTime), locked: !!habit.startTime && habit.flexible === false,
            minutes: habitMinutes(habit), done: !!input.done[habit.id], icon: habit.icon, color: habit.color, repeats: true,
            urgency: urgencyOf(habit.priority, undefined, input.today), difficulty: habit.difficulty,
            doneAt: input.done[habit.id] ? minuteOn(input.doneTimes?.[habit.id]) : undefined,
        });
    }
    for (const task of input.tasks) {
        if (task.status === 'cancelled') continue;
        const minutes = task.measure === 'time' && task.target ? task.target : Number(task.estimatedMinutes) || 0;
        items.push({ id: task.id, kind: 'task', title: task.title, start: toMinutes(task.dueTime), minutes, done: task.status === 'done', locked: !!task.dueTime && task.flexible === false,
            urgency: urgencyOf(task.priority, task.dueDate, input.today, task.deadline), difficulty: task.difficulty, deadline: task.deadline,
            doneAt: task.status === 'done' ? minuteOn(task.completedAt) : undefined });
    }
    if (input.kept) for (const item of items) {
        if (item.kind === 'meal' || item.kind === 'event') continue;
        // Not done (again): where it was planned, not where a tick put it.
        const slot = (!item.done && input.planned?.[item.id]) || input.kept[item.id];
        if (slot) item.kept = slot;
    }
    return items;
}

/** "Due today", "Due tomorrow", "Due Fri 24", seen from `day`; "Overdue" once it has passed. */
export function dueLabel(deadline: string, day: string): string {
    const days = Math.round((Date.parse(`${deadline}T12:00:00`) - Date.parse(`${day}T12:00:00`)) / 86400000);
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    const date = new Date(`${deadline}T12:00:00`);
    return `Due ${date.toLocaleDateString('en-US', { weekday: 'short' })} ${date.getDate()}`;
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
