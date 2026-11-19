import type { LengthSample } from './learnedLength';

/**
 * The week's five numbers (Progress → This week): focus hours, the top-3
 * hit rate, goal progress, sleep and how long things take against the plan.
 * The research behind them: tracking you can see is one of the strongest
 * levers there is (Harkin et al. 2016), and planned-vs-actual is the honest
 * answer to the planning fallacy (Buehler et al. 1994). Pure.
 */

/** How many samples it takes before "1.4× the plan" means anything. */
export const MIN_PLAN_SAMPLES = 3;

/**
 * Time taken against time planned, over the days `from` to `to`, across every
 * habit and task: 1.4 means things took 40% longer than planned. Null with too
 * little to go on.
 */
export function planRatio(samples: Record<string, LengthSample[]>, from: string, to: string): number | null {
    let taken = 0;
    let planned = 0;
    let count = 0;
    for (const list of Object.values(samples)) {
        for (const sample of list) {
            if (sample.day < from || sample.day > to || sample.planned <= 0) continue;
            taken += sample.minutes;
            planned += sample.planned;
            count += 1;
        }
    }
    if (count < MIN_PLAN_SAMPLES || planned <= 0) return null;
    return Math.round((taken / planned) * 10) / 10;
}

/** Average hours asleep, from nightly minutes (nights Health could not read are left out). Null with none. */
export function averageSleepHours(minutes: (number | null)[]): number | null {
    const known = minutes.filter((value): value is number => value !== null && value > 0);
    if (!known.length) return null;
    return Math.round((known.reduce((sum, value) => sum + value, 0) / known.length / 60) * 10) / 10;
}

/**
 * What the top-3 rate says about the plan: under 70% the plan is too big,
 * 100% every day it is too small (the research aims for about 70%, not 100%).
 * Nothing until there are a few days to judge.
 */
export function topRateNote(rate: number, days: number): 'Plan less' | 'Plan more' | null {
    if (days < 3) return null;
    if (rate < 70) return 'Plan less';
    if (rate >= 100) return 'Plan more';
    return null;
}

/** Hours to one decimal, for a figure: 6.5 h. */
export const hoursOf = (seconds: number): number => Math.round((seconds / 3600) * 10) / 10;
