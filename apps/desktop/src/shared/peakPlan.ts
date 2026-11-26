// Copied from Habyss Mobile lib/peakPlan.ts @0fcd218. Keep in sync; do not re-derive rules.

/**
 * Goals you reach in one go: "run 21 km by January 1", "50 push-ups", "a
 * 5-minute plank". Progress is your best single effort, never the sum: four
 * 5 km runs are not a half marathon.
 *
 * To make it happen with the least thinking, the app plans the build-up: from
 * where you are now (the baseline) to the target, a steady weekly step, with
 * the last week as the attempt. The habit under the goal is set to this
 * week's step, so each week you do one thing: the run the app put there.
 */

const dayNumber = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/** Words that make a number a one-effort target rather than a total. */
const EFFORT = /\b(run|running|jog|jogging|swim|swimming|cycle|cycling|ride|bike|row|rowing|hike|walk|sprint|bench|squat|deadlift|lift|plank|hold|push-?ups?|pull-?ups?|sit-?ups?|dips?|burpees?)\b/i;
/** Words that make it a total after all. */
const TOTAL = /\b(total|in total|altogether|combined|cumulative|overall|this (year|month|week)|a year|per year|a month|per month|a week|per week|every|each|across|over the (year|month|week))\b/i;
const PEAK_UNITS = new Set(['km', 'mi', 'm', 'laps', 'reps', 'minutes', 'kg', 'lb']);

/** "run 21 km by …" reads as reaching 21 km in one go; "run 500 km this year" as a total. */
export function isPeakGoal(text: string, unit: string | null, recurring: boolean): boolean {
    if (!unit || !PEAK_UNITS.has(unit) || recurring) return false;
    if (TOTAL.test(text) || !EFFORT.test(text)) return false;
    // A weight is only a one-effort target when it is lifted.
    if ((unit === 'kg' || unit === 'lb') && !/\b(bench|squat|deadlift|lift|press|clean)\b/i.test(text)) return false;
    return true;
}

/** Race names, as the distance they mean. */
export function raceDistance(text: string): number | null {
    if (/\bhalf[ -]?marathon\b/i.test(text)) return 21.1;
    if (/\bmarathon\b/i.test(text)) return 42.2;
    return null;
}

/** A sensible start when nobody said where they are: a quarter of the way, never nothing. */
export const defaultBaseline = (target: number) => Math.max(target * 0.25, Math.min(target, 1));

/**
 * The amount planned for the week `day` falls in: a straight build from the
 * baseline in the first week to the target in the final week, in steps of
 * `step` (half a km, one rep). Before the start it is the baseline; after the
 * end, the target.
 */
export function plannedFor(day: string, start: string, end: string, baseline: number, target: number, step = 0.5): number {
    const weeks = Math.max(1, Math.floor((dayNumber(end) - dayNumber(start)) / 7));
    const week = Math.floor((dayNumber(day) - dayNumber(start)) / 7);
    if (week <= 0) return roundTo(baseline, step);
    if (week >= weeks) return roundTo(target, step);
    return roundTo(baseline + (target - baseline) * (week / weeks), step);
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/** The step that fits a unit: half a km or mile, whole reps, minutes and laps. */
export const stepFor = (unit: string) => (unit === 'km' || unit === 'mi') ? 0.5 : (unit === 'kg' || unit === 'lb') ? 2.5 : 1;

/* ---------------------------------------------------------------------------
 * The habit's target over time, so past efforts count at what they were.
 * When the plan raises a run from 8 km to 9 km, last week's runs stay 8 km.
 * ------------------------------------------------------------------------- */

type TargetLog = Record<string, { from: string; value: number }[]>;
let log: TargetLog = {};

/**
 * Replaces the target history. On mobile this is loadTargetLog() reading
 * AsyncStorage; here the caller supplies it. Empty until set.
 */
export function setTargetLog(next: TargetLog): void {
    log = next;
}

/** What one check-in of this habit was worth on `day`: its target then. */
export function targetOn(habitId: string, day: string, current: number): number {
    const entries = log[habitId];
    if (!entries?.length) return current;
    let value: number | null = null;
    for (const entry of entries) if (entry.from <= day) value = entry.value;
    return value ?? entries[0].value;
}
