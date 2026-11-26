import type { Habit } from './habitsSQLite';

const minutesOf = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    return (Number.isFinite(hour) ? hour : 0) * 60 + (Number.isFinite(minute) ? minute : 0);
};

/**
 * How long a focus session on this habit runs, in minutes, or null when the
 * habit has no time to focus on.
 *
 * Its own length when it has one; otherwise the slot it is planned in
 * (09:00–10:30 is ninety minutes). A slot that crosses midnight wraps.
 */
export function focusMinutesFor(habit: Pick<Habit, 'durationMinutes' | 'startTime' | 'endTime'>): number | null {
    if (habit.durationMinutes && habit.durationMinutes > 0) return habit.durationMinutes;
    if (!habit.startTime || !habit.endTime) return null;
    const span = minutesOf(habit.endTime) - minutesOf(habit.startTime);
    const length = span > 0 ? span : span + 24 * 60;
    return length > 0 && length < 24 * 60 ? length : null;
}

/**
 * How long focusing on a habit or task should run: the one answer the focus
 * page, the habit page and anything that starts a session all read.
 *
 * - A timed habit ("30 minutes of reading") or a task measured in time can
 *   only be finished by running that time, so its length is fixed: focus
 *   goes straight to the timer, no timer-or-stopwatch question.
 * - If today's timeline had to cut it short to fit, the length is the cut
 *   one, and `cutFrom` says what it was meant to be.
 * - Time already banked today comes off what is left.
 * - Anything else with a length (a habit's slot, a task's estimate) offers it
 *   as the timer's default; with none of its own, the length of its place on
 *   today's timeline; with nothing at all, `seconds` is null.
 */
export interface FocusPlan {
    /** Seconds the timer runs for, or null when there is nothing to go on. */
    seconds: number | null;
    /** Finished only by running the time: start the timer directly. */
    fixed: boolean;
    /** The full length in seconds, when today's timeline cut it short. */
    cutFrom: number | null;
    /** The whole length for today (cut or not), before banked time comes off. */
    length: number | null;
}

export function focusPlan(input: {
    habit?: Pick<Habit, 'durationMinutes' | 'startTime' | 'endTime' | 'unit' | 'goalValue' | 'type' | 'trackingMethod'> | null;
    task?: { measure?: string; target?: number; amount?: number; estimatedMinutes?: number | string } | null;
    /** Today's place on the timeline (lib/todayFlow.ts todayTimes). */
    slot?: { start: number; end: number; cutFrom?: number } | null;
    /** Seconds already done today. */
    banked?: number;
}): FocusPlan {
    const { measurementFor } = require('./habitMeasurement') as typeof import('./habitMeasurement');
    let full: number | null = null;
    let fixed = false;
    let banked = Math.max(0, input.banked ?? 0);
    if (input.habit) {
        const measure = measurementFor(input.habit);
        if (measure.kind === 'timer') { full = Math.round(measure.target * measure.secondsPerUnit); fixed = true; }
        else { const minutes = focusMinutesFor(input.habit); full = minutes ? minutes * 60 : null; banked = 0; }
    } else if (input.task) {
        if (input.task.measure === 'time' && input.task.target) {
            full = input.task.target * 60; fixed = true;
            banked = Math.max(banked, (input.task.amount ?? 0) * 60);
        } else if (Number(input.task.estimatedMinutes) > 0) {
            full = Number(input.task.estimatedMinutes) * 60; banked = 0;
        }
    }
    // No length of its own (a task nobody sized, a habit without a time): the
    // length today's timeline gave it, so 5:00–5:30 focuses for 30 minutes.
    if (full === null && input.slot && input.slot.end > input.slot.start) full = (input.slot.end - input.slot.start) * 60;
    const cut = input.slot?.cutFrom ? Math.max(60, (input.slot.end - input.slot.start) * 60) : null;
    const length = cut !== null && (full === null || cut < full) ? cut : full;
    if (length === null) return { seconds: null, fixed, cutFrom: null, length: null };
    return { seconds: Math.max(60, length - banked), fixed, cutFrom: cut !== null && length === cut ? (full ?? input.slot!.cutFrom! * 60) : null, length };
}

/**
 * Where the clock stands when focus opens. Focus always begins now: only time
 * actually spent focusing is counted, never time that passed before you
 * started (opening a 9:00 task at 11:00 used to start a stopwatch at two
 * hours, and finishing it banked them as focus).
 *
 * The timer still keeps to today's timeline where it can: opened inside its
 * slot (`since`, ms, is when the slot began), it runs to the slot's end, so a
 * 5:00–5:30 task opened at 5:10 has 20 minutes. Opened after its slot is
 * over, it gets its whole length again, from now. Not begun yet (or no
 * `since`): the full timer from now. A stopwatch (an endless length) starts
 * at zero.
 */
export function focusClock(lengthSeconds: number, since: number | null | undefined, now: number): { began: number; stopwatch: boolean; seconds: number } {
    if (!Number.isFinite(lengthSeconds)) return { began: now, stopwatch: true, seconds: 0 };
    const intoSlot = since && since < now ? Math.floor((now - since) / 1000) : 0;
    const left = intoSlot > 0 && intoSlot < lengthSeconds ? lengthSeconds - intoSlot : lengthSeconds;
    return { began: now, stopwatch: false, seconds: Math.max(60, left) };
}
