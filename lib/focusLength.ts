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
