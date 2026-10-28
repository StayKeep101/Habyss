import type { Habit } from './habitsSQLite';
import type { Subtask, Task } from './tasks';
import { habitMinutes, toMinutes } from './dayPlan';

/**
 * The day as one line, built from two rules and nothing else:
 *
 *   1. Meals and calendar events do not move.
 *   2. Everything else goes in this order, one after another:
 *        tasks before habits;
 *        tasks by deadline (soonest first), then urgency, then difficulty;
 *        habits by urgency, then difficulty.
 *      (Urgency: urgent first. Difficulty: hard first. Still tied: by name.)
 *
 * How it is drawn, so the two rules have a page to sit on:
 *   - The line starts when you wake.
 *   - Each thing starts the minute the one before it ends; one that would
 *     run into a meal or an event starts when that ends instead.
 *   - Something with no length takes 30 minutes.
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
    /** Kept for older callers; the line no longer uses these. */
    locked?: boolean;
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

/** How long something with no length is given on the line. */
export const DEFAULT_MINUTES = 30;
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

/**
 * Lays the day out by the two rules. `now` is minutes from midnight on the
 * day shown, or null for another day; it only decides what is on now and
 * next, never where anything goes.
 */
export function flowDay(items: FlowInput[], now: number | null, window: DayWindowMinutes = { wake: 7 * 60, sleep: 23 * 60 }): DayFlow {
    // Rule 1: meals and events, where they are.
    const blocks = items
        .filter(item => item.fixed && item.start !== null)
        .map(item => ({ item, start: item.start as number, end: (item.start as number) + Math.max(1, item.minutes) }))
        .sort((a, b) => a.start - b.start);
    const timeline: FlowItem[] = blocks.map(block => ({ ...block.item, start: block.start, end: block.end, plannedStart: block.start, shift: 0, state: 'later' }));

    // Rule 2: everything else, one after another from waking, in order.
    let at = window.wake;
    for (const item of items.filter(entry => !entry.fixed).sort(lineOrder)) {
        const minutes = item.minutes > 0 ? item.minutes : DEFAULT_MINUTES;
        let start = at;
        // Running into a meal or an event: start when it ends.
        for (let bumped = true; bumped;) {
            bumped = false;
            for (const block of blocks) {
                if (start < block.end && start + minutes > block.start) { start = block.end; bumped = true; }
            }
        }
        timeline.push({ ...item, start, end: start + minutes, plannedStart: start, shift: 0, state: 'later', auto: true });
        at = start + minutes;
    }
    timeline.sort((a, b) => a.start - b.start || a.end - b.end);

    // The clock: what is on now and what is next. Nothing moves for it.
    let current: FlowItem | null = null;
    let nextGiven = false;
    for (let i = 0; i < timeline.length; i++) {
        const item = timeline[i];
        let state: FlowItem['state'] = 'later';
        if (item.done) state = 'done';
        else if (now !== null && item.fixed) state = now >= item.end ? 'done' : now >= item.start ? 'now' : 'later';
        else if (now !== null && now >= item.start && now < item.end && !current) state = 'now';
        else if (now !== null && !nextGiven && item.start >= now) { state = 'next'; nextGiven = true; }
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
            id: habit.id, kind: 'habit', title: habit.name, start: toMinutes(habit.startTime),
            minutes: habitMinutes(habit), done: !!input.done[habit.id], icon: habit.icon, color: habit.color, repeats: true,
            priority: level(habit.priority), difficulty: habit.difficulty,
            doneAt: input.done[habit.id] ? minuteOn(input.doneTimes?.[habit.id]) : undefined,
        });
    }
    for (const task of input.tasks) {
        if (task.status === 'cancelled') continue;
        const minutes = task.measure === 'time' && task.target ? task.target : Number(task.estimatedMinutes) || 0;
        items.push({ id: task.id, kind: 'task', title: task.title, start: toMinutes(task.dueTime), minutes, done: task.status === 'done',
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
