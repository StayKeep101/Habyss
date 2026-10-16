import type { Habit } from './habitsSQLite';
import { localDateKey } from './habitSchedule';
import { habitDays, keptRate, shiftDay, type HabitDay, type HistoryDay } from './habitDays';

export interface Momentum {
    /** Kept-rate over the recent window, as a percentage. */
    rate: number;
    /** The same window immediately before it. */
    previous: number;
    /** rate − previous. Zero when there is nothing to compare against. */
    delta: number;
    kept: number;
    countable: number;
    days: number;
    /** False until the earlier window has something in it. */
    comparable: boolean;
    direction: 'up' | 'down' | 'flat';
    /** The recent window, oldest first — what the chart draws. */
    window: HabitDay[];
}

export interface HabitMomentum {
    id: string;
    name: string;
    kept: number;
    countable: number;
    rate: number;
    delta: number;
    comparable: boolean;
}

/**
 * Whether the habits are getting stronger, not how close to perfect they are.
 *
 * A bare percentage is a grade, and a grade discourages at exactly the moment
 * someone needs the opposite: adding a habit enlarges the denominator, so
 * ambition reads as decline. Pairing the rate with its own recent past fixes
 * the framing — direction is honest at any absolute level, and it is the thing
 * a person can actually move this week.
 *
 * Today is left out on purpose. A day in progress would drag the number down
 * every morning and lift it back every evening, which is noise; today already
 * has the ring and the focus card to itself.
 */
export function momentum(
    habits: Habit[],
    history: HistoryDay[],
    completions: Record<string, boolean>,
    days = 30,
    today: string = localDateKey(new Date()),
): Momentum {
    const window = habitDays(habits, history, completions, days * 2, shiftDay(today, -1), today);
    const recent = window.slice(days);
    const earlier = window.slice(0, days);
    const now = keptRate(recent);
    const before = keptRate(earlier);
    const comparable = before.countable > 0 && now.countable > 0;
    const delta = comparable ? now.rate - before.rate : 0;

    return {
        rate: now.rate,
        previous: before.rate,
        delta,
        kept: now.kept,
        countable: now.countable,
        days,
        comparable,
        direction: delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down',
        window: recent,
    };
}

/**
 * The same question asked of each habit, so the headline number can be
 * explained rather than only restated. Sorted weakest first: one habit quietly
 * failing is the usual reason a whole goal looks bad.
 */
export function habitMomentum(
    habits: Habit[],
    history: HistoryDay[],
    completions: Record<string, boolean>,
    days = 30,
    today: string = localDateKey(new Date()),
): HabitMomentum[] {
    const window = habitDays(habits, history, completions, days * 2, shiftDay(today, -1), today);
    const recent = window.slice(days);
    const earlier = window.slice(0, days);
    const active = habits.filter(habit => !habit.isGoal && !habit.isArchived);

    const forHabit = (source: HabitDay[], id: string) => keptRate(source.map(day => ({
        date: day.date,
        scheduled: day.scheduled.filter(each => each === id),
        done: day.done.filter(each => each === id),
        skipped: day.skipped.filter(each => each === id),
    })));

    return active
        .map(habit => {
            const now = forHabit(recent, habit.id);
            const before = forHabit(earlier, habit.id);
            const comparable = before.countable > 0;
            return {
                id: habit.id,
                name: habit.name,
                kept: now.kept,
                countable: now.countable,
                rate: now.rate,
                delta: comparable ? now.rate - before.rate : 0,
                comparable,
            };
        })
        .filter(item => item.countable > 0)
        .sort((a, b) => a.rate - b.rate || b.countable - a.countable);
}

/**
 * Habits kept, week by week, oldest first: the shape of the trend. Each week
 * ends the day before the next; the last one ends yesterday (today is still
 * in progress). A week with nothing scheduled has no rate.
 */
export function weeklyKept(
    habits: Habit[],
    history: HistoryDay[],
    completions: Record<string, boolean>,
    weeks = 8,
    today: string = localDateKey(new Date()),
): { start: string; rate: number | null }[] {
    const window = habitDays(habits, history, completions, weeks * 7, shiftDay(today, -1), today);
    return Array.from({ length: weeks }, (_, index) => {
        const slice = window.slice(index * 7, index * 7 + 7);
        const { countable, rate } = keptRate(slice);
        return { start: slice[0]?.date ?? '', rate: countable ? rate : null };
    });
}
