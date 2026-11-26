import { addDays } from './habitSummary';

/**
 * One habit's run, from its days. The one place a single habit's streak is
 * counted: the habit's page (getHabitStats) and the streak widget set to one
 * habit both read it. Pure.
 *
 * Only days the habit was due count; a skipped day counts as not due (never a
 * miss). Today may still be open, so it does not break the run.
 */
export interface HabitDay { date: string; completed: boolean; scheduled: boolean }

export function habitDays(
    from: string, today: string,
    isDue: (date: string) => boolean, completed: Set<string>, skipped: Set<string>,
): HabitDay[] {
    const out: HabitDay[] = [];
    for (let day = from; day <= today; day = addDays(day, 1)) {
        out.push({ date: day, completed: completed.has(day), scheduled: !skipped.has(day) && isDue(day) });
    }
    return out;
}

export function habitRun(days: HabitDay[], today: string): { currentStreak: number; bestStreak: number; totalCompletions: number; totalDaysTracked: number } {
    const relevant = days.filter(day => day.scheduled);
    let currentStreak = 0;
    let bestStreak = 0;
    let run = 0;
    let totalCompletions = 0;
    for (const day of relevant) {
        if (day.completed) { run++; totalCompletions++; } else { bestStreak = Math.max(bestStreak, run); run = 0; }
    }
    bestStreak = Math.max(bestStreak, run);
    for (let i = relevant.length - 1; i >= 0; i--) {
        if (relevant[i].completed) currentStreak++;
        else if (relevant[i].date === today) continue; // only today is still pending
        else break;
    }
    return { currentStreak, bestStreak, totalCompletions, totalDaysTracked: relevant.length };
}
