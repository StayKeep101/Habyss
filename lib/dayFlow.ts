import type { Habit } from './habitsSQLite';
import type { Subtask, Task } from './tasks';
import { habitMinutes, toMinutes } from './dayPlan';

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
 *   5. Swiping a habit or task to reschedule it lays it, and everything
 *      still open after that moment, out again from then, in the order of
 *      rule 2. What comes before that moment stays where it is.
 *   6. A habit or task ticked before its end ends there, and what is still
 *      open after it starts from that moment, in the order of rule 2.
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
    /** A task's subtasks, shown under it on the timeline. */
    subtasks?: Subtask[];
    /** Rule 3: at its exact time, it stays there (with a lock). */
    locked?: boolean;
    /** Rule 5: rescheduled at this minute, by a swipe. */
    rescheduledAt?: number;
    /** Kept for older callers; the line no longer uses these. */
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
    /** Kept for older callers: nothing is cut short. */
    cutFrom?: number;
    /** Rule 4: one part of something split around a meal, an event or an exact-time thing. */
    part?: { index: number; of: number };
}

export interface DayFlow {
    timeline: FlowItem[];
    /** Always empty: everything is on the line. Kept for older callers. */
    anytime: FlowInput[];
    /** Always empty: nothing is left off. Kept for older callers. */
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

/** Lays `items` out in rule 2's order from `from`, around `blocks`; each one's parts become blocks for the next. */
function pack(items: FlowInput[], from: number, blocks: Span[]): FlowItem[] {
    const taken = [...blocks];
    const out: FlowItem[] = [];
    let at = from;
    for (const item of [...items].sort(lineOrder)) {
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
 * Lays the day out by the rules. `now` is minutes from midnight on the day
 * shown, or null for another day; it only decides what is on now and next,
 * never where anything goes.
 *
 * With `auto` off (Settings → Auto-reschedule), nothing is moved for you:
 * every habit and task with a time stays at its time, as an exact one does,
 * and neither a reschedule nor finishing early lays anything out again. What
 * has no time is placed once, in order, in the free time.
 */
export function flowDay(items: FlowInput[], now: number | null, window: DayWindowMinutes = { wake: 7 * 60, sleep: 23 * 60 }, options: { auto?: boolean } = {}): DayFlow {
    const auto = options.auto !== false;
    const at = (item: FlowInput): FlowItem => ({ ...item, start: item.start as number, end: (item.start as number) + Math.max(1, lengthOf(item)), plannedStart: item.start as number, shift: 0, state: 'later' });
    // Rule 6: ticked before its end, it ends at the tick (never before it began).
    const finishedAt = (row: FlowItem): number | null =>
        row.done && !row.fixed && row.doneAt !== undefined && row.doneAt < row.end ? Math.max(row.start, row.doneAt) : null;
    // Rules 1 and 3: meals, events and exact-time things, where they are.
    const holds = (item: FlowInput) => (item.fixed || item.locked || !auto) && item.start !== null;
    const held = items.filter(holds).map(at)
        .map(row => { const end = finishedAt(row); return end === null ? row : { ...row, end }; });
    const blocks: Span[] = held.map(item => ({ start: item.start, end: item.end }));
    const moving = items.filter(item => !holds(item));

    // Rule 2: everything else, from waking, in order (rule 4 splitting around
    // blocks). Rescheduled things too, so what comes before a reschedule keeps
    // exactly the place it had.
    let placed = pack(moving, window.wake, blocks);

    // Rules 5 and 6, in the order they happened: a reschedule, or something
    // finished early, lays out again from its moment what is still open from
    // then on (with what was rescheduled then).
    // Each habit or task finished early, and when: over all its parts (rule 4).
    const finish = new Map<string, number>();
    for (const row of placed) {
        if (!row.done || row.doneAt === undefined || finish.has(row.id)) continue;
        const parts = placed.filter(part => part.id === row.id);
        const from = Math.min(...parts.map(part => part.start));
        const to = Math.max(...parts.map(part => part.end));
        if (row.doneAt < to) finish.set(row.id, Math.max(from, row.doneAt));
    }
    const finishes = [...held.map(finishedAt).filter((minute): minute is number => minute !== null), ...finish.values()];
    const reschedules = moving.map(item => item.rescheduledAt).filter((minute): minute is number => minute !== undefined);
    const moments = auto ? [...new Set([...finishes, ...reschedules])].sort((a, b) => a - b) : [];
    for (const moment of moments) {
        // Finished early at this moment: it ends here, and any later parts go.
        // Ticked before it began, it takes no time, where it was.
        for (const [id, at] of finish) {
            if (at !== moment) continue;
            const parts = placed.filter(row => row.id === id);
            const kept = parts.filter(row => row.start < moment).map(row => ({ ...row, end: Math.min(row.end, moment) }));
            const first = parts.reduce((a, b) => (b.start < a.start ? b : a));
            const shrunk = kept.length ? kept : [{ ...first, end: first.start }];
            placed = [...placed.filter(row => row.id !== id), ...shrunk.map(row => (shrunk.length > 1 ? row : { ...row, part: undefined }))];
        }
        const again = new Set(moving.filter(item => item.rescheduledAt === moment).map(item => item.id));
        for (const row of placed) if (!row.done && row.start >= moment && (row.part?.index ?? 1) === 1) again.add(row.id);
        // Taken off the line where it was (that time is past or given up), laid again from the moment.
        const stays = placed.filter(row => !again.has(row.id));
        const redo = moving.filter(item => again.has(item.id));
        placed = [...stays, ...pack(redo, moment, [...blocks, ...stays.map(row => ({ start: row.start, end: row.end }))])];
    }

    const timeline = [...held, ...placed].sort((a, b) => a.start - b.start || a.end - b.end);

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
    return { timeline, anytime: [], unfit: [], current };
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
    /** Travel to and from events, by event name (lib/eventTravel.ts). */
    travel?: Record<string, { before: number; after: number }>;
    today?: string;
    /** Rule 5: when each habit or task was rescheduled today, in minutes from midnight (lib/reschedule.ts). */
    rescheduled?: Record<string, number>;
    /** Kept for older callers; not used. */
    flexibleMeals?: boolean;
    kept?: Record<string, { start: number; end: number }>;
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
    const level = (value: number | undefined): 1 | 2 | 3 => (value === 1 || value === 3 ? value : 2);
    const items: FlowInput[] = (input.meals ?? []).map(meal => ({
        id: `meal:${meal.id}`, kind: 'meal' as const, title: meal.name, start: meal.start, minutes: meal.minutes,
        done: false, icon: 'restaurant', fixed: true,
    }));
    for (const event of input.events ?? []) {
        items.push({ id: `event:${event.id}`, kind: 'event', title: event.title, start: event.start, minutes: event.minutes, done: false, icon: 'calendar', color: event.color, fixed: true });
        // Getting there and back: fixed like the event, so nothing is planned in it.
        const travel = input.travel?.[event.title.trim().toLowerCase().replace(/\s+/g, ' ')];
        if (travel?.before) items.push({ id: `event:${event.id}:to`, kind: 'event', title: `To ${event.title}`, start: Math.max(0, event.start - travel.before), minutes: Math.min(travel.before, event.start), done: false, icon: 'car', color: event.color, fixed: true });
        if (travel?.after) items.push({ id: `event:${event.id}:back`, kind: 'event', title: `Back from ${event.title}`, start: event.start + event.minutes, minutes: travel.after, done: false, icon: 'car', color: event.color, fixed: true });
    }
    for (const habit of input.habits) {
        items.push({
            id: habit.id, kind: 'habit', title: habit.name, start: toMinutes(habit.startTime), locked: !!habit.startTime && habit.flexible === false,
            rescheduledAt: input.rescheduled?.[habit.id],
            minutes: habitMinutes(habit), done: !!input.done[habit.id], icon: habit.icon, color: habit.color, repeats: true,
            priority: level(habit.priority), difficulty: habit.difficulty,
            doneAt: input.done[habit.id] ? minuteOn(input.doneTimes?.[habit.id]) : undefined,
        });
    }
    for (const task of input.tasks) {
        if (task.status === 'cancelled') continue;
        const minutes = task.measure === 'time' && task.target ? task.target : Number(task.estimatedMinutes) || 0;
        items.push({ id: task.id, kind: 'task', title: task.title, start: toMinutes(task.dueTime), minutes, done: task.status === 'done',
            locked: !!task.dueTime && task.flexible === false, rescheduledAt: input.rescheduled?.[task.id],
            priority: level(task.priority), difficulty: task.difficulty, due: task.deadline ?? task.dueDate, deadline: task.deadline,
            doneAt: task.status === 'done' ? minuteOn(task.completedAt) : undefined, subtasks: task.subtasks });
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
