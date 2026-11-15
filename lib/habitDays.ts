import type { Habit } from './habitsSQLite';
import { createHabitRequirement, isQuotaHabit, localDateKey, parseHabitDate } from './habitSchedule';
import { offDays } from './timeOff';

export interface HistoryDay { date: string; completedIds: string[]; skippedIds?: string[] }

/** One calendar day, and what the habits due on it actually did. */
export interface HabitDay {
    date: string;
    /** Habit ids the schedule asked for that day. */
    scheduled: string[];
    /** Of those, the ones ticked. */
    done: string[];
    /** Of those, the ones deliberately skipped — neither kept nor missed. */
    skipped: string[];
}

/** Moves a date key, anchored at noon so a DST day cannot shift the calendar. */
export function shiftDay(key: string, delta: number): string {
    const parsed = parseHabitDate(key);
    if (!parsed) return key;
    const moved = new Date(parsed);
    moved.setDate(moved.getDate() + delta);
    return localDateKey(moved);
}

/**
 * The window of days every statistic on the home screen is read from.
 *
 * Two things it does that the older per-goal reading did not. It walks the
 * calendar rather than the rows that happen to exist, so a day nothing was
 * recorded on counts as a day missed instead of vanishing — which is what made
 * the old consistency number flattering. And it keeps each habit separate
 * rather than collapsing a day to all-or-nothing, so four kept out of five is
 * worth four, not zero.
 *
 * `liveToday` is the only day read from the live completions record; history is
 * authoritative for everything before it. Passing `end` in the past is therefore
 * safe — today's ticks cannot leak backwards onto it.
 */
export function habitDays(
    habits: Habit[],
    history: HistoryDay[],
    completions: Record<string, boolean>,
    days: number,
    end: string = localDateKey(new Date()),
    liveToday: string = localDateKey(new Date()),
): HabitDay[] {
    const active = habits.filter(habit => !habit.isGoal && !habit.isArchived);
    const doneBy = new Map(history.map(day => [day.date, day.completedIds ?? []]));
    const skipBy = new Map(history.map(day => [day.date, day.skippedIds ?? []]));
    doneBy.set(liveToday, Object.keys(completions).filter(id => completions[id]));

    // Due that day (a "3 times a week" one only once it could not wait); a
    // quota one done on a day it was free to skip still counts as kept.
    const due = active.map(habit => ({ habit, required: createHabitRequirement(habit), quota: isQuotaHabit(habit) }));
    // Off sick or on vacation (lib/timeOff.ts): what was left undone was rested, not missed.
    const off = offDays();
    const out: HabitDay[] = [];
    for (let back = days - 1; back >= 0; back--) {
        const date = shiftDay(end, -back);
        const when = parseHabitDate(date);
        const scheduled = when ? due.filter(({ habit, required, quota }) => {
            const doneOn = (key: string) => (doneBy.get(key) ?? []).includes(habit.id);
            return required(date, doneOn) || (quota && doneOn(date));
        }).map(({ habit }) => habit.id) : [];
        const doneIds = doneBy.get(date) ?? [];
        const skipIds = skipBy.get(date) ?? [];
        out.push({
            date,
            scheduled,
            done: scheduled.filter(id => doneIds.includes(id)),
            skipped: scheduled.filter(id => skipIds.includes(id) || (off.has(date) && !doneIds.includes(id))),
        });
    }
    return out;
}

/** Kept out of asked-for, with deliberate skips taken off both sides. */
export function keptRate(days: HabitDay[]): { kept: number; countable: number; rate: number } {
    let kept = 0, countable = 0;
    for (const day of days) {
        countable += day.scheduled.length - day.skipped.length;
        kept += day.done.length;
    }
    return { kept, countable, rate: countable ? Math.round((kept / countable) * 100) : 0 };
}
