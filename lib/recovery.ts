import type { Habit } from './habitsSQLite';
import { localDateKey } from './habitSchedule';
import { habitDays, type HistoryDay } from './habitDays';

export interface HabitRecovery {
    id: string;
    name: string;
    /** Misses a verdict is already in on. */
    judged: number;
    /** Of those, answered on the very next day the habit was due. */
    recovered: number;
    /** Of those, missed twice running. */
    doubles: number;
    rate: number | null;
    /** Missed last time, due again today, not done yet — still savable. */
    atRisk: boolean;
    lastMiss: string | null;
    /** Days the habit was due and not kept, most recent last. */
    misses: string[];
}

export interface Recovery {
    rate: number | null;
    recovered: number;
    doubles: number;
    judged: number;
    /** Weakest first, with anything savable today at the very top. */
    perHabit: HabitRecovery[];
    atRisk: HabitRecovery[];
    days: number;
}

/**
 * How often a miss stayed a single miss.
 *
 * "Never miss twice" is the one rule in Atomic Habits that survives a bad week,
 * and no number on the home screen could express it: a rate tells you how much
 * you did, never whether you got back up. This one asks, of every day a habit
 * was due and not kept, whether it was kept on the very next day it came round.
 *
 * It is also the only statistic here that cannot be gamed by tracking less —
 * missing is the denominator, so deleting habits removes the credit along with
 * the blame.
 *
 * Three things are deliberately not counted as misses: a day deliberately
 * skipped, today (it is not over), and a miss whose next occurrence has not
 * arrived yet — a verdict nobody has had the chance to answer is not a failure.
 */
export function recovery(
    habits: Habit[],
    history: HistoryDay[],
    completions: Record<string, boolean>,
    days = 90,
    today: string = localDateKey(new Date()),
): Recovery {
    const window = habitDays(habits, history, completions, days, today, today);
    const active = habits.filter(habit => !habit.isArchived);

    let recovered = 0;
    let doubles = 0;
    const perHabit: HabitRecovery[] = [];

    for (const habit of active) {
        // Every day this habit was actually due, in order. A skip leaves the
        // sequence untouched, so the day after a skip answers the day before it.
        const occurrences = window
            .filter(day => day.scheduled.includes(habit.id) && !day.skipped.includes(habit.id))
            .map(day => ({ date: day.date, done: day.done.includes(habit.id) }));
        if (occurrences.length === 0) continue;

        let judged = 0, won = 0, lost = 0;
        const misses: string[] = [];

        for (let index = 0; index < occurrences.length; index++) {
            const here = occurrences[index];
            if (here.done) continue;
            // The day is not over, so not yet is not a miss.
            if (here.date === today) continue;
            misses.push(here.date);

            const next = occurrences[index + 1];
            if (!next) continue;                              // nothing has answered it yet
            if (next.date === today && !next.done) continue;  // still answerable — no verdict
            judged++;
            if (next.done) won++; else lost++;
        }

        const last = occurrences[occurrences.length - 1];
        const prior = occurrences[occurrences.length - 2];
        const atRisk = !!last && last.date === today && !last.done && !!prior && !prior.done;

        recovered += won;
        doubles += lost;
        perHabit.push({
            id: habit.id,
            name: habit.name,
            judged, recovered: won, doubles: lost,
            rate: judged ? Math.round((won / judged) * 100) : null,
            atRisk,
            lastMiss: misses.length ? misses[misses.length - 1] : null,
            misses,
        });
    }

    // Savable today first, then the habits least likely to get back up.
    perHabit.sort((a, b) => {
        if (a.atRisk !== b.atRisk) return a.atRisk ? -1 : 1;
        if ((a.rate === null) !== (b.rate === null)) return a.rate === null ? 1 : -1;
        if (a.rate !== null && b.rate !== null && a.rate !== b.rate) return a.rate - b.rate;
        return b.doubles - a.doubles;
    });

    const judged = recovered + doubles;
    return {
        rate: judged ? Math.round((recovered / judged) * 100) : null,
        recovered, doubles, judged,
        perHabit,
        atRisk: perHabit.filter(item => item.atRisk),
        days,
    };
}
