import type { Habit } from './habitsSQLite';
import type { Subtask, Task } from './tasks';
import { habitMinutes, toMinutes } from './dayPlan';
import { anchoredStart, anchorLabel, type AnchorBlock } from './habitAnchor';
import { travelOf, type Travel } from './eventTravel';

/**
 * The day as one line, built from these rules and nothing else
 * (docs/timeline-rules.md):
 *
 *   1. Meals and calendar events do not move.
 *   2. Everything else goes in this order, one after another:
 *        tasks before habits;
 *        tasks by deadline (soonest first), then urgency, then difficulty;
 *        habits by urgency, then difficulty.
 *      (Urgency: urgent first. Difficulty: hard first. Still tied: by name.)
 *   3. A habit or task at an exact time stays at that time, with a lock,
 *      like a meal, but it can still be ticked.
 *   4. Something too long for the time left before a meal, an event or an
 *      exact-time thing takes that time, and the rest of it goes after.
 *   5. A habit or task rescheduled at a moment (lib/reschedule.ts; the
 *      timeline's swipe for it is gone, a hold-and-drag sets an exact time
 *      instead) lays it, and everything still open after that moment, out
 *      again from then, in the order of rule 2. What comes before stays.
 *   6. A habit or task ticked before its end ends there, and what is still
 *      open after it starts from that moment, in the order of rule 2.
 *   8. Today is planned from waking, whether or not the app is open, and the
 *      clock moves on whether or not things are ticked: something whose time
 *      ran out unticked stays in its place, unticked, and the next thing is on.
 *      Whatever was added after waking (or unticked) is laid out from now, with everything open after
 *      it, in the order of rule 2: an urgent task added at 7:38 PM goes now,
 *      not at the 9:00 AM it would have had if the day had started with it.
 *      What is on now (its place runs across this minute) keeps it; something
 *      urgent added meanwhile goes straight after it, ahead of what was next.
 *      Done things, meals, events and exact-time things stay where they are.
 *      Something ticked after its place was over is ticked in that place.
 *   7. Nothing that moves goes past bedtime. When the day is too full, the
 *      last of them before bedtime is cut short to end there (a scissors
 *      mark says so), and anything with no room left at all waits under the
 *      line in "No room before bedtime". Meals, events and exact-time things
 *      stay where they were put.
 *
 * How it is drawn, so the rules have a page to sit on:
 *   - The line starts when you wake.
 *   - Each thing starts the minute the one before it ends.
 *   - Something with no length takes its kind's default: a task 90 minutes,
 *     a habit 30 (DEFAULT_LENGTH).
 *   - Ticking something does not move anything: done things keep their place
 *     in the order. The clock only says which one is on now and which is next.
 */

export interface FlowInput {
    id: string;
    kind: 'habit' | 'task' | 'meal' | 'event';
    title: string;
    /** Meals and events: when they are, in minutes from midnight. Others: the time they were given (not used to place them). */
    start: number | null;
    minutes: number;
    done: boolean;
    icon?: string;
    color?: string;
    /** Repeats (a habit), for the little repeat mark. */
    repeats?: boolean;
    /** A meal or a calendar event: rule 1, it does not move. */
    fixed?: boolean;
    /** 1 urgent, 2 normal, 3 not urgent. */
    priority?: 1 | 2 | 3;
    /** 1 easy, 2 medium, 3 hard. */
    difficulty?: 1 | 2 | 3;
    /** A task's deadline for ordering: its "due by" day, else the day it is planned for. */
    due?: string;
    /** A task's "due by" day, shown on its row. */
    deadline?: string;
    /** When it was ticked, in minutes from midnight on the day shown. */
    doneAt?: number;
    /** The exact moment it was ticked (ms): orders ticks made in the same minute. */
    doneStamp?: number;
    /** Today, its time ran out unfinished (kept for older memory; the calendar no longer moves it). */
    lapsed?: boolean;
    /** Made today at this minute: a new thing is never placed before it (lib/dayFlow.ts layoutToday). */
    notBefore?: number;
    /** Unticked today after it was done: fitted in from now, like something new. */
    fresh?: boolean;
    /** A task's subtasks, shown under it on the timeline. */
    subtasks?: Subtask[];
    /** Rule 3: at its exact time, it stays there (with a lock). */
    locked?: boolean;
    /** Held to an event or meal today (lib/habitAnchor.ts): "Right before Accounting". Placed and locked like rule 3. */
    anchoredTo?: string;
    /** Rule 5: rescheduled at this minute, by a swipe. */
    rescheduledAt?: number;
    /** The trip to an event: a heads-up this many minutes before it is time to leave. */
    warn?: number;
    /** Kept for older callers; the line no longer uses these, except `kept` (today: where it was last shown) and `planned`. */
    flex?: boolean;
    auto?: boolean;
    moved?: boolean;
    urgency?: number;
    kept?: { start: number; end: number };
    planned?: { start: number; end: number };
}

export interface FlowItem extends FlowInput {
    /** Where it sits on the line, in minutes from midnight. */
    start: number;
    end: number;
    /** The same as start: nothing is shifted from a plan any more. */
    plannedStart: number;
    shift: number;
    state: 'done' | 'now' | 'next' | 'later';
    /** Rule 7: cut short to end at bedtime; the length it was meant to have, in minutes. */
    cutFrom?: number;
    /** Rule 4: one part of something split around a meal, an event or an exact-time thing. */
    part?: { index: number; of: number };
}

export interface DayFlow {
    timeline: FlowItem[];
    /** Auto-reschedule off: habits and tasks with no time, not placed on the line. Empty when on. */
    anytime: FlowInput[];
    /** Rule 7: habits and tasks still to do with no room left before bedtime. */
    unfit: FlowInput[];
    /** The habit or task on now, if any. */
    current: FlowItem | null;
}

export interface DayWindowMinutes {
    wake: number;
    sleep: number;
    /** Kept for older callers; the line does not use them. */
    peak?: { start: number; end: number } | null;
    active?: string | null;
}

/**
 * How long something with no length is given: a task is real work (90
 * minutes), a habit a regular slot (30). New tasks and habits start at these
 * too, so what is planned and what the line shows agree.
 */
export const DEFAULT_LENGTH = { task: 90, habit: 30 } as const;
/** The length the line gives an item: its own, or its kind's default (anything else: a habit's). */
export const lengthOf = (item: { kind: string; minutes: number }): number =>
    item.minutes > 0 ? item.minutes : item.kind === 'task' ? DEFAULT_LENGTH.task : DEFAULT_LENGTH.habit;
/** How long past its end something can run before the "still going?" alert. */
export const GRACE = 10;

const NO_DUE = '9999-12-31';

/** Rule 2: the order everything that moves is placed in. */
export function lineOrder(a: FlowInput, b: FlowInput): number {
    const kind = (item: FlowInput) => (item.kind === 'task' ? 0 : 1);
    if (kind(a) !== kind(b)) return kind(a) - kind(b);
    if (a.kind === 'task') {
        const due = (a.due ?? NO_DUE).localeCompare(b.due ?? NO_DUE);
        if (due) return due;
    }
    return (a.priority ?? 2) - (b.priority ?? 2)
        || (b.difficulty ?? 2) - (a.difficulty ?? 2)
        || a.title.localeCompare(b.title)
        || a.id.localeCompare(b.id);
}

type Span = { start: number; end: number };

/**
 * Rule 4: from `from`, the free stretches `minutes` takes, stepping over
 * every block in its way: as much as fits before one, the rest after it.
 */
function spans(from: number, minutes: number, blocks: Span[]): Span[] {
    const out: Span[] = [];
    let at = from;
    let left = minutes;
    while (left > 0) {
        const inside = blocks.find(block => at >= block.start && at < block.end);
        if (inside) { at = inside.end; continue; }
        const wall = blocks.filter(block => block.start > at).reduce((first, block) => Math.min(first, block.start), Infinity);
        const take = Math.min(left, wall - at);
        out.push({ start: at, end: at + take });
        left -= take;
        at += take;
    }
    return out;
}

/** The free stretches of `start`–`end` once `blocks` are taken out (rule 4: a place kept across a meal). */
function around(start: number, end: number, blocks: Span[]): Span[] {
    let out: Span[] = [{ start, end }];
    for (const block of blocks) {
        out = out.flatMap(span => (block.end <= span.start || block.start >= span.end ? [span]
            : [{ start: span.start, end: block.start }, { start: block.end, end: span.end }].filter(part => part.end > part.start)));
    }
    return out.sort((a, b) => a.start - b.start);
}

/** Lays `items` out in rule 2's order from `from`, around `blocks`; each one's parts become blocks for the next. */
function pack(items: FlowInput[], from: number, blocks: Span[], ordered = false): FlowItem[] {
    const taken = [...blocks];
    const out: FlowItem[] = [];
    let at = from;
    for (const item of ordered ? items : [...items].sort(lineOrder)) {
        const parts = spans(at, lengthOf(item), taken);
        parts.forEach((span, index) => {
            out.push({ ...item, start: span.start, end: span.end, plannedStart: span.start, shift: 0, state: 'later', auto: true,
                ...(parts.length > 1 ? { part: { index: index + 1, of: parts.length } } : null) });
            taken.push(span);
        });
        at = parts[parts.length - 1].end;
    }
    return out;
}

/**
 * Today, three rules and nothing else, so nothing on the line moves for no reason:
 *
 *   1. Done stays where it was done. The one you were on runs from its start
 *      there (`planned`, lib/dayMemory.ts) to the tick; anything ticked ahead of
 *      its turn took no time and shows at its tick.
 *   2. What you are on stays where you saw it (`kept`), starting no earlier than
 *      the last tick. Unless something urgent is waiting: then it goes back in line.
 *   3. Everything else still open lines up from now (or after what you are on),
 *      in the order of rule 2, around meals, events and exact times (rule 4).
 *      The day runs like a clock: something whose time ran out unticked stays
 *      where it was (it can still be ticked there) and the next thing takes over.
 */
function layoutToday(moving: FlowInput[], fixedBlocks: Span[], now: number, window: DayWindowMinutes): FlowItem[] {
    const blocks: Span[] = [...fixedBlocks];
    const out: FlowItem[] = [];
    const row = (item: FlowInput, start: number, end: number): FlowItem =>
        ({ ...item, start, end, plannedStart: item.kept?.start ?? start, shift: 0, state: 'later', auto: true });

    // 1. Done, in the order they were ticked.
    const done = moving.filter(item => item.done);
    const timed = done.filter(item => item.doneAt !== undefined)
        .sort((a, b) => (a.doneAt as number) - (b.doneAt as number) || (a.doneStamp ?? 0) - (b.doneStamp ?? 0));
    let lastTick = -Infinity;
    for (const item of timed) {
        const tick = item.doneAt as number;
        const length = item.planned ? Math.max(1, item.planned.end - item.planned.start) : Math.max(1, lengthOf(item));
        // Drawn around meals, events and exact-time things, in parts, never over them.
        const placed = (start: number, end: number): FlowItem[] => {
            const parts = end > start ? around(start, end, fixedBlocks) : [];
            if (!parts.length) return [row(item, start, end)];
            return parts.map((span, index) => ({ ...row(item, span.start, span.end), ...(parts.length > 1 ? { part: { index: index + 1, of: parts.length } } : null) }));
        };
        // Ticked after its time had passed (the day moved on without it), however late: ticked where it was.
        if (item.planned && tick >= item.planned.end) { out.push(...placed(item.planned.start, item.planned.end)); continue; }
        // Was it the one you were on? Its place ran across the tick.
        const wasOn = !!item.planned && item.planned.start < tick && tick - item.planned.end <= length;
        if (!wasOn) { out.push(row(item, tick, tick)); continue; }
        const start = Math.min(tick, Math.max(item.planned!.start, window.wake, lastTick));
        out.push(...placed(start, tick));
        if (tick > start) { blocks.push({ start, end: tick }); lastTick = Math.max(lastTick, tick); }
    }
    // Done with no time at all (an old record): from waking, out of the way.
    const untimed = done.filter(item => item.doneAt === undefined);
    if (untimed.length) {
        const laid = pack(untimed, window.wake, blocks);
        out.push(...laid);
        blocks.push(...laid.map(item => ({ start: item.start, end: item.end })));
    }

    // 2. What you are on.
    // The day was planned from waking, whether or not the app was open: something with
    // no place kept yet takes the place it had in that plan (rule 2's order from waking,
    // around meals, events and exact times), so the clock runs through it from the morning.
    // Only what was made after waking, or unticked, is new: fitted in from now.
    const isNew = (item: FlowInput) => !!item.fresh || (item.notBefore !== undefined && item.notBefore > window.wake);
    const plan = new Map<string, Span>();
    for (const part of pack(moving.filter(item => !isNew(item)), window.wake, fixedBlocks)) {
        const was = plan.get(part.id);
        plan.set(part.id, was ? { start: Math.min(was.start, part.start), end: Math.max(was.end, part.end) } : { start: part.start, end: part.end });
    }
    const placedOpen = moving.filter(item => !item.done)
        .map(item => (item.kept || item.lapsed || isNew(item) || !plan.has(item.id) ? item : { ...item, kept: plan.get(item.id) }));
    // Places kept from different moments can disagree: one away from the list for a moment
    // (still loading) comes back with where it was, while the rest moved on. Two open things
    // never share a minute: earliest first, a place over one already taken is given up, and
    // that one lines up again like anything new. (It took "now" from the one really on.)
    const taken: Span[] = [];
    const stale = new Set<string>();
    for (const item of placedOpen.filter(entry => entry.kept).sort((a, b) => a.kept!.start - b.kept!.start || lineOrder(a, b))) {
        const parts = around(item.kept!.start, item.kept!.end, fixedBlocks);
        if (parts.some(part => taken.some(span => part.start < span.end && span.start < part.end))) { stale.add(item.id); continue; }
        taken.push(...parts);
    }
    const open = placedOpen.map(item => (stale.has(item.id) ? { ...item, kept: undefined } : item));
    const from = Math.max(now, window.wake);
    // A kept place, cut around meals, events and exact-time things again (rule 4), in parts.
    const kept = (item: FlowInput, start: number, end: number): FlowItem[] => {
        const parts = around(start, end, fixedBlocks);
        if (!parts.length) return [row(item, start, end)];
        return parts.map((span, index) => ({ ...row(item, span.start, span.end), ...(parts.length > 1 ? { part: { index: index + 1, of: parts.length } } : null) }));
    };
    // The day runs like a clock. Something whose time is up and was not ticked keeps its
    // place in the past, unticked (it can still be ticked there): the clock moves on to
    // the next thing, never holding it at "now" or starting it again.
    const past = (item: FlowInput) => !!item.kept && item.kept.end <= now;
    // Had its turn but has no place to keep (an old record): it waits at the back of the line.
    const lapsedLoose = (item: FlowInput) => !item.kept && !!item.lapsed;
    const overdue = (item: FlowInput) => past(item) || lapsedLoose(item);
    const onNow = open
        .filter(item => item.kept && item.kept.start <= now && item.kept.end > now)
        .sort((a, b) => a.kept!.start - b.kept!.start)[0];
    let queueFrom = from;
    let current: FlowInput | undefined;
    // What is on keeps its place, always: something urgent that comes in goes next, never on top of it.
    if (onNow) {
        // Not before the last thing that was actually done (something you ran over into it).
        const start = Math.max(onNow.kept!.start, lastTick === -Infinity ? onNow.kept!.start : Math.min(lastTick, now));
        if (start < onNow.kept!.end) {
            current = onNow;
            out.push(...kept(onNow, start, onNow.kept!.end));
            blocks.push({ start, end: onNow.kept!.end });
            queueFrom = Math.max(from, onNow.kept!.end);
        }
    }

    // 3. Past and not ticked: where it was.
    for (const item of open.filter(past)) out.push(...kept(item, item.kept!.start, item.kept!.end).map(part => ({ ...part, lapsed: true })));
    // The rest, in line from now; one with no place that already had its turn goes after all of it.
    // The near future holds still: what was next (the first one already planned) stays first;
    // only something urgent just come in goes before it.
    const waiting = open.filter(item => item !== current && !overdue(item));
    const nextUp = waiting.filter(item => item.kept).sort((a, b) => a.kept!.start - b.kept!.start)[0];
    const cutsIn = waiting.filter(item => item !== nextUp && !item.kept && item.priority === 1).sort(lineOrder);
    const rest = waiting.filter(item => item !== nextUp && !cutsIn.includes(item)).sort(lineOrder);
    const queue = [...cutsIn, ...(nextUp ? [nextUp] : []), ...rest];
    const fresh = pack(queue, queueFrom, blocks, true);
    const afterFresh = fresh.length ? Math.max(...fresh.map(item => item.end)) : queueFrom;
    const late = pack(open.filter(item => item !== current && lapsedLoose(item)), afterFresh, [...blocks, ...fresh.map(item => ({ start: item.start, end: item.end }))])
        .map(item => ({ ...item, lapsed: true }));
    out.push(...[...fresh, ...late].map(item => ({ ...item, plannedStart: item.kept?.start ?? item.start })));
    return out;
}

/**
 * Lays the day out by the rules. `now` is minutes from midnight on the day
 * shown, or null for another day; it only decides what is on now and next,
 * never where anything goes.
 *
 * With `auto` off (Settings → Auto-reschedule), it is a plain calendar:
 * every habit and task with a time stays at its time for its whole length
 * (exact or flexible makes no difference, and nothing shows a lock), and
 * neither a reschedule nor a tick moves anything. What has no time waits in
 * `anytime`, by name; urgency and difficulty order nothing.
 */
export function flowDay(items: FlowInput[], now: number | null, window: DayWindowMinutes = { wake: 7 * 60, sleep: 23 * 60 }, options: { auto?: boolean } = {}): DayFlow {
    const auto = options.auto !== false;
    const at = (item: FlowInput): FlowItem => ({ ...item, start: item.start as number, end: (item.start as number) + Math.max(1, lengthOf(item)), plannedStart: item.start as number, shift: 0, state: 'later' });
    // Rule 6: ticked before its end, it ends at the tick (never before it began).
    // A meal or event ended early (lib/endedEarly.ts) is done at its minute the same way.
    const finishedAt = (row: FlowItem): number | null =>
        row.done && row.doneAt !== undefined && row.doneAt < row.end ? Math.max(row.start, row.doneAt) : null;
    // Rules 1 and 3: meals, events and exact-time things, where they are.
    const holds = (item: FlowInput) => (item.fixed || item.locked || !auto) && item.start !== null;
    // With Auto-reschedule off it is a plain calendar: every habit and task with
    // a time sits at that time, for its whole length, ticked or not. Exact and
    // flexible mean nothing then, so nothing wears the lock.
    const held = items.filter(holds).map(at)
        // Fixed is fixed: ticking it (or ending a meal or event early) leaves it exactly where it was.
        .map(row => (!auto && !row.fixed ? { ...row, locked: false } : row));
    const blocks: Span[] = held.map(item => ({ start: item.start, end: item.end }));
    const moving = items.filter(item => !holds(item));
    const anytime = auto ? [] : [...moving].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));

    // Today (rule 8): never laid out again from waking. What is done stays where it was done,
    // what you are on stays where you saw it, and everything still open lines up from now.
    let placed = !auto ? [] : now !== null ? layoutToday(moving, blocks, now, window) : pack(moving, window.wake, blocks);

    // Another day: rules 5 and 6, in the order they happened: a reschedule, or something
    // finished early, lays out again from its moment what is still open from
    // then on (with what was rescheduled then). Something ticked but not yet
    // settled moves with them, so when its turn comes it ends where it now
    // sits: tick three things before they begin and each one closes up at the
    // start of the line, one after another, never at a place it has left.
    const another = auto && now === null;
    const heldFinishes = another ? held.map(finishedAt).filter((minute): minute is number => minute !== null) : [];
    const reschedules = another ? moving.flatMap(item => (item.rescheduledAt === undefined ? [] : [{ id: item.id, at: item.rescheduledAt }])) : [];
    const settled = new Set<string>();
    const heldDone = new Set<number>();
    const moved = new Set<string>();
    /** When each habit or task ticked early, and not yet settled, ends: over all its parts (rule 4), where it sits now. */
    const pending = (): Map<string, number> => {
        const out = new Map<string, number>();
        if (!another) return out;
        for (const row of placed) {
            if (!row.done || row.doneAt === undefined || settled.has(row.id) || out.has(row.id)) continue;
            const parts = placed.filter(part => part.id === row.id);
            const from = Math.min(...parts.map(part => part.start));
            const to = Math.max(...parts.map(part => part.end));
            if (row.doneAt < to) out.set(row.id, Math.max(from, row.doneAt));
            else settled.add(row.id);
        }
        return out;
    };
    for (let guard = 0; another && guard < items.length * 3 + 10; guard++) {
        const finish = pending();
        const candidates = [
            ...finish.values(),
            ...heldFinishes.filter(minute => !heldDone.has(minute)),
            ...reschedules.filter(item => !moved.has(item.id)).map(item => item.at),
        ];
        if (!candidates.length) break;
        const moment = Math.min(...candidates);
        heldDone.add(moment);
        // Finished early at this moment: it ends here, and any later parts go.
        // Ticked before it began, it takes no time, where it is.
        for (const [id, when] of finish) {
            if (when !== moment) continue;
            settled.add(id);
            const parts = placed.filter(row => row.id === id);
            const kept = parts.filter(row => row.start < moment).map(row => ({ ...row, end: Math.min(row.end, moment) }));
            const first = parts.reduce((x, y) => (y.start < x.start ? y : x));
            const shrunk = kept.length ? kept : [{ ...first, end: first.start }];
            placed = [...placed.filter(row => row.id !== id), ...shrunk.map(row => (shrunk.length > 1 ? row : { ...row, part: undefined }))];
        }
        const again = new Set(reschedules.filter(item => item.at === moment && !moved.has(item.id)).map(item => item.id));
        again.forEach(id => moved.add(id));
        for (const row of placed) {
            if (row.start < moment || (row.part?.index ?? 1) !== 1) continue;
            if (!row.done || !settled.has(row.id)) again.add(row.id);
        }
        // Taken off the line where it was (that time is past or given up), laid again from the moment.
        const stays = placed.filter(row => !again.has(row.id));
        const redo = moving.filter(item => again.has(item.id));
        placed = [...stays, ...pack(redo, moment, [...blocks, ...stays.map(row => ({ start: row.start, end: row.end }))])];
    }

    // Rule 7: bedtime is the end of the line for everything that moves. Bedtime
    // after midnight (00:30) is read as that night, not that morning.
    const bed = window.sleep > window.wake ? window.sleep : window.sleep + 24 * 60;
    const unfit: FlowInput[] = [];
    const fitted: FlowItem[] = [];
    for (const id of [...new Set(placed.map(row => row.id))]) {
        const parts = placed.filter(row => row.id === id).sort((a, b) => a.start - b.start);
        // Done is done: a tick is never moved or hidden.
        if (parts[0].done || parts[parts.length - 1].end <= bed) { fitted.push(...parts); continue; }
        const kept = parts.filter(row => row.start < bed).map(row => ({ ...row, end: Math.min(row.end, bed) }));
        const source = moving.find(item => item.id === id);
        if (!kept.length) { if (source) unfit.push(source); continue; }
        const full = source ? lengthOf(source) : parts.reduce((sum, row) => sum + row.end - row.start, 0);
        fitted.push(...kept.map((row, index) => ({
            ...row, cutFrom: full,
            part: kept.length > 1 ? { index: index + 1, of: kept.length } : undefined,
        })));
    }
    placed = fitted;

    // Ticked ahead of their turn (no time, at the tick) go above what you are on, in the order ticked.
    const onAt = now === null ? undefined : placed.find(row => !row.done && row.start <= now && row.end > now);
    const sortAt = (row: FlowItem) => (onAt && row.done && row.start === row.end && row.start >= onAt.start && row.start <= onAt.end ? onAt.start - 0.5 : row.start);
    // Ticks in the same minute keep the order they were made in: the latest sits closest to what you are on.
    const timeline = [...held, ...placed].sort((a, b) => sortAt(a) - sortAt(b) || a.start - b.start || a.end - b.end
        || (a.doneStamp ?? 0) - (b.doneStamp ?? 0) || a.id.localeCompare(b.id));

    // The clock: what is on now and what is next. Nothing moves for it.
    let current: FlowItem | null = null;
    let nextGiven = false;
    for (let i = 0; i < timeline.length; i++) {
        const item = timeline[i];
        let state: FlowItem['state'] = 'later';
        if (item.done) state = 'done';
        else if (now !== null && item.fixed) state = now >= item.end ? 'done' : now >= item.start ? 'now' : 'later';
        else if (now !== null && now >= item.start && now < item.end && !current) state = 'now';
        else if (now !== null && !nextGiven && item.start >= now && item.id !== current?.id) { state = 'next'; nextGiven = true; }
        timeline[i] = { ...item, state };
        if (state === 'now' && !item.fixed && !current) current = timeline[i];
    }
    return { timeline, anytime, unfit, current };
}

/** Getting to or back from a calendar event (the travel either side of it, lib/eventTravel.ts). */
export const isTravel = (id: string): boolean => /^event:.+:(to|back)$/.test(id);

/** How far a meal may move to get out of a class's way, either side: two and a half hours. */
export const MEAL_REACH = 150;
/**
 * Where a meal goes when classes are on: its own time when nothing covers it,
 * else the nearest start (earlier or later, within MEAL_REACH) where the
 * whole meal fits between them; null when there is none. Pure.
 */
export function mealAround(start: number, minutes: number, busy: { start: number; end: number }[]): number | null {
    const clear = (at: number) => at >= 0 && at + minutes <= 24 * 60 && busy.every(block => at + minutes <= block.start || at >= block.end);
    if (clear(start)) return start;
    // The edges of what is busy are the only places a meal can start or end against.
    const candidates = busy.flatMap(block => [block.end, block.start - minutes])
        .filter(at => Math.abs(at - start) <= MEAL_REACH && clear(at))
        .sort((a, b) => Math.abs(a - start) - Math.abs(b - start) || a - b);
    return candidates[0] ?? null;
}

/** Today's habits, tasks, meals and calendar events as flow input. */
export function flowInputs(input: {
    habits: Habit[]; tasks: Task[]; done: Record<string, boolean>;
    /** The day shown (today when left out), to read when things were ticked on it. */
    day?: string;
    /** When each habit was ticked on that day (ISO), from its completion. */
    doneTimes?: Record<string, string>;
    meals?: { id: string; name: string; start: number; minutes: number }[];
    events?: { id: string; title: string; start: number; minutes: number; color?: string; icon?: string }[];
    /** Travel to and from events, by event name or for one event on the day (lib/eventTravel.ts). */
    travel?: Record<string, Travel>;
    today?: string;
    /** Rule 5: when each habit or task was rescheduled today, in minutes from midnight (lib/reschedule.ts). */
    rescheduled?: Record<string, number>;
    /** Kept for older callers; not used. */
    flexibleMeals?: boolean;
    /** Where each habit and task was last on the line today (lib/dayMemory.ts slots). */
    kept?: Record<string, { start: number; end: number }>;
    /** Where each ticked one was just before it was ticked: it stays there. */
    planned?: Record<string, { start: number; end: number }>;
    /** Had their turn today and ran out unfinished (lib/dayMemory.ts): at the back of the line. */
    lapsed?: Record<string, true>;
    /** Done when the line was last seen (lib/dayMemory.ts done): one open now was just unticked. */
    wasDone?: Record<string, true>;
    /** Missed ones brought back into free time (lib/dayMemory.ts bringBack): fitted in from now. */
    again?: Record<string, true>;
    /** Meals and events finished early today, by flow id, at their minute (lib/endedEarly.ts). */
    ended?: Record<string, number>;
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
    const stampOf = (iso?: string) => { const at = iso ? Date.parse(iso) : NaN; return Number.isFinite(at) ? at : undefined; };
    const level = (value: number | undefined): 1 | 2 | 3 => (value === 1 || value === 3 ? value : 2);
    // Finished early (lib/endedEarly.ts): done at that minute.
    const ended = (id: string) => (input.ended?.[id] !== undefined ? { done: true, doneAt: input.ended[id] } : { done: false });
    // Unticked after it was done: it is fresh again, laid out from now like anything new,
    // never put back in the place it had (that time has gone).
    const unticked = (id: string, done: boolean) => !done && (!!input.wasDone?.[id] || !!input.again?.[id]);
    const keptOf = (id: string, done: boolean) => (done || unticked(id, done) ? undefined : input.kept?.[id]);
    const items: FlowInput[] = [];
    for (const event of input.events ?? []) {
        items.push({ id: `event:${event.id}`, kind: 'event', title: event.title, start: event.start, minutes: event.minutes, icon: event.icon ?? 'calendar', color: event.color, fixed: true, ...ended(`event:${event.id}`) });
        // Getting there and back: fixed like the event, so nothing is planned in it.
        const travel = travelOf(input.travel, event, input.day);
        if (travel?.before && event.start > 0) items.push({ id: `event:${event.id}:to`, kind: 'event', title: `To ${event.title}`, start: Math.max(0, event.start - travel.before), minutes: Math.min(travel.before, event.start), icon: 'car', color: event.color, fixed: true, ...(travel.warn ? { warn: travel.warn } : null), ...ended(`event:${event.id}:to`) });
        // The way back leaves when the event really ended: early, if it was ended early.
        const out = input.ended?.[`event:${event.id}`] ?? event.start + event.minutes;
        if (travel?.after) items.push({ id: `event:${event.id}:back`, kind: 'event', title: `Back from ${event.title}`, start: Math.min(out, event.start + event.minutes), minutes: travel.after, icon: 'car', color: event.color, fixed: true, ...ended(`event:${event.id}:back`) });
    }
    // Meals go around classes: one a class (or the walk to it) covers moves to the nearest free
    // time, and is left out for the day when there is none, instead of sitting on top of it.
    const busy = items.map(item => ({ start: item.start ?? 0, end: (item.start ?? 0) + item.minutes }));
    const meals: FlowInput[] = [];
    for (const meal of input.meals ?? []) {
        const finished = ended(`meal:${meal.id}`);
        const start = finished.done ? meal.start : mealAround(meal.start, meal.minutes, busy);
        if (start === null) continue;
        meals.push({ id: `meal:${meal.id}`, kind: 'meal' as const, title: meal.name, start, minutes: meal.minutes, icon: 'restaurant', fixed: true, ...finished });
    }
    items.unshift(...meals);
    // What a habit can be held to today (lib/habitAnchor.ts): the events, with their travel, and the meals.
    const anchors: AnchorBlock[] = [
        ...(input.events ?? []).map(event => {
            const travel = travelOf(input.travel, event, input.day);
            return { title: event.title, start: event.start, minutes: event.minutes, before: travel?.before, after: travel?.after };
        }),
        ...(input.meals ?? []).map(meal => ({ title: meal.name, start: meal.start, minutes: meal.minutes })),
        // Other habits and today's tasks, where they have a time of their own.
        ...input.habits.filter(habit => habit.startTime).map(habit => ({ title: habit.name, start: toMinutes(habit.startTime)!, minutes: habitMinutes(habit) || DEFAULT_LENGTH.habit })),
        ...input.tasks.filter(task => task.dueTime && task.status !== 'cancelled').map(task => ({ title: task.title, start: toMinutes(task.dueTime)!, minutes: Number(task.estimatedMinutes) || DEFAULT_LENGTH.task })),
    ];
    for (const habit of input.habits) {
        // Pinned at an exact time wins; else, held to today's class or meal when there is one.
        const pinned = !!habit.startTime && habit.flexible === false;
        // Never held to itself.
        const anchorAt = !pinned && habit.anchor ? anchoredStart(habit.anchor, habitMinutes(habit) || DEFAULT_LENGTH.habit, anchors.filter(block => block.title !== habit.name)) : null;
        items.push({
            id: habit.id, kind: 'habit', title: habit.name,
            start: anchorAt ?? toMinutes(habit.startTime), locked: pinned || anchorAt !== null,
            anchoredTo: anchorAt !== null && habit.anchor ? anchorLabel(habit.anchor) : undefined,
            rescheduledAt: input.rescheduled?.[habit.id],
            minutes: habitMinutes(habit), done: !!input.done[habit.id], icon: habit.icon, color: habit.color, repeats: true,
            priority: level(habit.priority), difficulty: habit.difficulty,
            doneAt: input.done[habit.id] ? minuteOn(input.doneTimes?.[habit.id]) : undefined,
            doneStamp: input.done[habit.id] ? stampOf(input.doneTimes?.[habit.id]) : undefined,
            planned: input.done[habit.id] ? (input.planned?.[habit.id] ?? input.kept?.[habit.id]) : undefined,
            kept: keptOf(habit.id, !!input.done[habit.id]), fresh: unticked(habit.id, !!input.done[habit.id]) || undefined,
            lapsed: !input.done[habit.id] && !unticked(habit.id, false) && !!input.lapsed?.[habit.id],
            notBefore: minuteOn(habit.createdAt),
        });
    }
    for (const task of input.tasks) {
        if (task.status === 'cancelled') continue;
        const minutes = task.measure === 'time' && task.target ? task.target : Number(task.estimatedMinutes) || 0;
        items.push({ id: task.id, kind: 'task', title: task.title, start: toMinutes(task.dueTime), minutes, done: task.status === 'done',
            locked: !!task.dueTime && task.flexible === false, rescheduledAt: input.rescheduled?.[task.id],
            priority: level(task.priority), difficulty: task.difficulty, due: task.deadline ?? task.dueDate, deadline: task.deadline,
            doneAt: task.status === 'done' ? minuteOn(task.completedAt) : undefined, subtasks: task.subtasks,
            doneStamp: task.status === 'done' ? stampOf(task.completedAt) : undefined,
            planned: task.status === 'done' ? (input.planned?.[task.id] ?? input.kept?.[task.id]) : undefined,
            kept: keptOf(task.id, task.status === 'done'), fresh: unticked(task.id, task.status === 'done') || undefined,
            lapsed: task.status !== 'done' && !unticked(task.id, false) && !!input.lapsed?.[task.id],
            notBefore: minuteOn(task.createdAt) });
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
/** "5:25 PM–7:25 PM (2 hr)"; one ticked before its time took none, so just "7:30 PM–7:30 PM". */
export function whenLabel(item: { start: number; end: number; state: string }): string {
    if (item.state === 'done' && item.end === item.start) return rangeLabel(item.start, item.end);
    return `${rangeLabel(item.start, item.end)} (${lengthLabel(item.end - item.start)})`;
}

export function rangeLabel(start: number, end: number): string {
    return `${clockLabel(start)}–${clockLabel(end)}`;
}

/** "30 min", "1 hr", "1 hr 30 min". */
/**
 * How much of the waking day is free: what no habit, task, meal or event
 * (or the travel to one) takes, between waking and bedtime, overlaps counted once.
 */
export function freeTime(flow: Pick<DayFlow, 'timeline'>, window: DayWindowMinutes): { free: number; awake: number; share: number } {
    const bed = window.sleep > window.wake ? window.sleep : window.sleep + 24 * 60;
    const awake = Math.max(1, bed - window.wake);
    const spans = flow.timeline
        .map(item => ({ start: Math.max(window.wake, item.start), end: Math.min(bed, item.end) }))
        .filter(span => span.end > span.start)
        .sort((a, b) => a.start - b.start);
    let busy = 0;
    let reach = window.wake;
    for (const span of spans) {
        const from = Math.max(reach, span.start);
        if (span.end > from) busy += span.end - from;
        reach = Math.max(reach, span.end);
    }
    const free = Math.max(0, awake - busy);
    return { free, awake, share: free / awake };
}

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
