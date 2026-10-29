import type { MarkEvent } from './marks';
import { addDays } from './goalInsights';

export interface ChallengeReport {
    /** Days at least one thing was done. */
    daysShownUp: number;
    days: number;
    habitsKept: number;
    tasksDone: number;
    goalsReached: number;
    /** The most days in a row something was done. */
    bestRun: number;
    /** XP earned over the challenge. */
    marksEarned: number;
}

/**
 * What the 14-day challenge came to, from the record the Marks already keep
 * (lib/marks.ts ledger): every habit kept, task finished and goal reached in
 * the last `days` days, the days anything was done, and the longest run of
 * them. Shown on the day it ends, before the price: the proof, in their own
 * numbers.
 */
export function challengeReport(ledger: MarkEvent[], today: string, days = 14): ChallengeReport {
    const from = addDays(today, -(days - 1));
    const done = ledger.filter(event => event.kind === 'complete' && event.date >= from && event.date <= today);
    const active = new Set(done.map(event => event.date));
    let bestRun = 0;
    let run = 0;
    for (let day = from; day <= today; day = addDays(day, 1)) {
        run = active.has(day) ? run + 1 : 0;
        bestRun = Math.max(bestRun, run);
    }
    return {
        daysShownUp: active.size,
        days,
        habitsKept: done.filter(event => event.item === 'habit').length,
        tasksDone: done.filter(event => event.item === 'task').length,
        goalsReached: done.filter(event => event.item === 'goal').length,
        bestRun,
        marksEarned: ledger.filter(event => event.date >= from && event.date <= today && event.points > 0).reduce((sum, event) => sum + event.points, 0),
    };
}
