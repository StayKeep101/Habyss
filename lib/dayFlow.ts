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
 */

export interface FlowInput {
    id: string;
    kind: 'habit' | 'task';
    title: string;
    /** Minutes from midnight it was planned for; null when it has no time. */
    start: number | null;
    minutes: number;
    done: boolean;
    icon?: string;
    color?: string;
    /** Repeats (a habit), for the little repeat mark. */
    repeats?: boolean;
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

/**
 * Lays the day out as a flow. `now` is minutes from midnight on the day shown,
 * or null for another day (then everything stays where it was planned).
 */
export function flowDay(items: FlowInput[], now: number | null): DayFlow {
    const timed = items.filter(item => item.start !== null)
        .map(item => ({ ...item, plannedStart: item.start as number, minutes: item.minutes > 0 ? item.minutes : DEFAULT_MINUTES }))
        .sort((a, b) => a.plannedStart - b.plannedStart || a.title.localeCompare(b.title));
    const anytime = items.filter(item => item.start === null);

    const timeline: FlowItem[] = [];
    let current: FlowItem | null = null;
    /** Whether the first thing not done has been placed yet. */
    let reachedOpen = false;
    /** Where the flow has got to: the end of the last open item placed. */
    let cursor: number | null = null;
    /** The previous item's planned start and end, to tell a chain from a gap. */
    let previous: { start: number; end: number; done: boolean } | null = null;

    for (const item of timed) {
        const plannedEnd = item.plannedStart + item.minutes;
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
        const end = start + item.minutes;
        timeline.push({ ...item, start, end, shift: start - item.plannedStart, state });
        if (cursor !== null) cursor = end;
        previous = { start: item.plannedStart, end: plannedEnd, done: false };
    }
    return { timeline, anytime, current };
}

/** Today's habits and tasks as flow input. */
export function flowInputs(input: { habits: Habit[]; tasks: Task[]; done: Record<string, boolean> }): FlowInput[] {
    const items: FlowInput[] = [];
    for (const habit of input.habits) {
        items.push({
            id: habit.id, kind: 'habit', title: habit.name, start: toMinutes(habit.startTime),
            minutes: habitMinutes(habit), done: !!input.done[habit.id], icon: habit.icon, color: habit.color, repeats: true,
        });
    }
    for (const task of input.tasks) {
        if (task.status === 'cancelled') continue;
        const minutes = task.measure === 'time' && task.target ? task.target : Number(task.estimatedMinutes) || 0;
        items.push({ id: task.id, kind: 'task', title: task.title, start: toMinutes(task.dueTime), minutes, done: task.status === 'done' });
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
