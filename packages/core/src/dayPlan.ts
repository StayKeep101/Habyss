import type { Habit } from './types';
import type { Task } from './types';
import { measurementFor } from './habitMeasurement';

/**
 * A day as hours, not as a list.
 *
 * The roadmap said what to do and never when, so a day of six habits and three
 * tasks looked the same at 7am as at 9pm. This lays the day out between waking
 * and sleeping: what is placed at a time, what still has none, the gaps
 * between, and how much of the day is genuinely left.
 */

export interface PlanBlock {
    id: string;
    /** A habit, a task, a meal, or something from the calendar (an event, a reminder, the travel either side of an event). */
    kind: 'habit' | 'task' | 'event' | 'meal';
    /** Getting to or back from an event: drawn as a dotted line, not a bar. */
    travel?: boolean;
    title: string;
    /** Minutes from midnight. */
    start: number;
    end: number;
    done: boolean;
    color?: string;
}

export interface PlanItem {
    id: string;
    kind: 'habit' | 'task';
    title: string;
    /** How long it takes, when that is known. */
    minutes: number;
    done: boolean;
}

export interface DayPlan {
    wake: number;
    sleep: number;
    /** Minutes from now (or wake, if earlier) until sleep; 0 once the day is over. */
    left: number;
    /** Where now sits, or null when the day shown is not today. */
    now: number | null;
    blocks: PlanBlock[];
    /** Open things with no time yet. */
    unplaced: PlanItem[];
    /** Minutes still to do across everything open, timed or not. */
    planned: number;
    /** Gaps of at least `minGap` minutes from now until sleep, longest first. */
    free: { start: number; end: number }[];
    /** What is left of the day minus what is still planned for it. */
    spare: number;
}

export const toMinutes = (time?: string | null): number | null => {
    const match = time ? /^(\d{1,2}):(\d{2})/.exec(time) : null;
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

export const clockOf = (minutes: number): string => {
    const value = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
};

/** How long a habit takes: its time range, its duration, or its timer target. */
export function habitMinutes(habit: Habit): number {
    // A timed habit ("2 hours of study") takes exactly its goal: that is what
    // the habit page and the focus timer use, so an edited goal must move the
    // timeline too, whatever slot or length it had before.
    const { kind, target, secondsPerUnit } = measurementFor(habit);
    if (kind === 'timer' && target > 0) return Math.round((target * secondsPerUnit) / 60);
    const start = toMinutes(habit.startTime);
    const end = toMinutes(habit.endTime);
    if (start !== null && end !== null && end > start) return end - start;
    if (Number(habit.durationMinutes) > 0) return Number(habit.durationMinutes);
    return 0;
}

export function buildDayPlan(input: {
    habits: Habit[];
    tasks: Task[];
    completions: Record<string, boolean>;
    wake: string;
    sleep: string;
    /** Minutes from midnight now, or null for a day that is not today. */
    now: number | null;
    minGap?: number;
}): DayPlan {
    const wake = toMinutes(input.wake) ?? 7 * 60;
    let sleep = toMinutes(input.sleep) ?? 23 * 60;
    if (sleep <= wake) sleep += 1440; // Bedtime after midnight.
    const minGap = input.minGap ?? 30;
    const now = input.now === null ? null : (input.now < wake && sleep > 1440 ? input.now + 1440 : input.now);
    const from = now === null ? wake : Math.min(sleep, Math.max(wake, now));

    const blocks: PlanBlock[] = [];
    const unplaced: PlanItem[] = [];
    let planned = 0;

    for (const habit of input.habits) {
        const minutes = habitMinutes(habit);
        const start = toMinutes(habit.startTime);
        const done = !!input.completions[habit.id];
        if (!done) planned += minutes;
        if (start !== null) {
            blocks.push({ id: habit.id, kind: 'habit', title: habit.name, start, end: start + Math.max(minutes, 15), done, color: habit.color });
        } else if (!done) {
            unplaced.push({ id: habit.id, kind: 'habit', title: habit.name, minutes, done });
        }
    }
    for (const task of input.tasks) {
        if (task.status === 'cancelled') continue;
        const done = task.status === 'done';
        const minutes = task.measure === 'time' && task.target
            ? Math.max(0, task.target - (task.amount ?? 0))
            : Number(task.estimatedMinutes) || 0;
        const start = toMinutes(task.dueTime);
        if (!done) planned += minutes;
        if (start !== null) {
            blocks.push({ id: task.id, kind: 'task', title: task.title, start, end: start + Math.max(minutes, 15), done });
        } else if (!done) {
            unplaced.push({ id: task.id, kind: 'task', title: task.title, minutes, done });
        }
    }
    blocks.sort((a, b) => a.start - b.start);

    // Free time: from now to sleep, less every open block.
    const busy = blocks.filter(block => !block.done && block.end > from).map(block => [Math.max(from, block.start), block.end] as const);
    const free: { start: number; end: number }[] = [];
    let cursor = from;
    for (const [start, end] of busy) {
        if (start - cursor >= minGap) free.push({ start: cursor, end: Math.min(start, sleep) });
        cursor = Math.max(cursor, end);
    }
    if (sleep - cursor >= minGap) free.push({ start: cursor, end: sleep });
    free.sort((a, b) => (b.end - b.start) - (a.end - a.start));

    const left = Math.max(0, sleep - from);
    return {
        wake, sleep, left, now: now === null ? null : Math.min(Math.max(now, wake), sleep),
        blocks, unplaced, planned, free: free.filter(slot => slot.end > slot.start).slice(0, 3),
        spare: left - planned,
    };
}

/** "3 h 20 min" for the plan's own labels. */
export function spanLabel(minutes: number): string {
    const value = Math.max(0, Math.round(minutes));
    const hours = Math.floor(value / 60);
    const rest = value % 60;
    if (!hours) return `${rest} min`;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/**
 * What is on at a minute of the day: every block running then, or — when the
 * finger is between blocks — any starting or ending within `slack` minutes.
 */
export function blocksAt(plan: Pick<DayPlan, 'blocks'>, minute: number, slack = 10): PlanBlock[] {
    const running = plan.blocks.filter(block => block.start <= minute && minute < Math.max(block.end, block.start + 1));
    if (running.length) return running;
    return plan.blocks.filter(block => Math.abs(block.start - minute) <= slack || Math.abs(block.end - minute) <= slack);
}
