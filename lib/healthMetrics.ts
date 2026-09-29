import { canConvert, convert } from './unitKind';

/**
 * Everything Apple Health can answer a habit with.
 *
 * ── Why this is also the Garmin integration ───────────────────────────────
 *
 * On iOS, Garmin Connect, Whoop, Oura, Fitbit, Strava, Peloton, Zwift, Nike Run
 * Club, AutoSleep and most of the rest all write into Apple Health. Reading
 * Health deeply is therefore not a substitute for integrating with those apps —
 * it *is* the integration, and it is the one that keeps working when any of
 * them changes an API, an OAuth flow or a partner programme. One permission
 * prompt buys every device the person already owns.
 *
 * The alternative — talking to each service directly — needs a partner
 * agreement, an OAuth server to hold the secrets, and a public URL for their
 * webhooks. None of those can live inside the app, and every one of them is a
 * thing that breaks while you are asleep. Where a service genuinely cannot
 * reach Health, that is written down in `lib/integrations.ts` rather than
 * pretended otherwise.
 *
 * ── What belongs here ─────────────────────────────────────────────────────
 *
 * A metric earns its place if a person would plausibly make a habit of it and
 * a phone or watch records it without being asked. Blood glucose and vitamin K
 * are in HealthKit; neither is a habit.
 */

export type HealthMetric =
    // Movement
    | 'steps' | 'walkRun' | 'cycling' | 'swimming' | 'flights'
    // Effort
    | 'exercise' | 'stand' | 'activeEnergy' | 'workout'
    // Recovery
    | 'sleep' | 'mindfulness'
    // Intake
    | 'water' | 'protein' | 'caffeine' | 'calories';

export interface HealthMetricInfo {
    id: HealthMetric;
    label: string;
    /** The unit the reader returns, in the app's own vocabulary. */
    unit: string;
    detail: string;
    /** Roughly what a day of it looks like, for a sensible first target. */
    suggested: number;
    group: 'Movement' | 'Effort' | 'Recovery' | 'Intake';
}

export const HEALTH_METRICS: HealthMetricInfo[] = [
    { id: 'steps', label: 'Steps', unit: 'steps', detail: 'Today’s step count', suggested: 8000, group: 'Movement' },
    { id: 'walkRun', label: 'Walk or run', unit: 'km', detail: 'Distance on foot today', suggested: 5, group: 'Movement' },
    { id: 'cycling', label: 'Cycling', unit: 'km', detail: 'Distance ridden today', suggested: 15, group: 'Movement' },
    { id: 'swimming', label: 'Swimming', unit: 'm', detail: 'Distance swum today', suggested: 1000, group: 'Movement' },
    { id: 'flights', label: 'Flights climbed', unit: 'times', detail: 'Flights of stairs today', suggested: 10, group: 'Movement' },

    { id: 'exercise', label: 'Exercise minutes', unit: 'minutes', detail: 'Apple exercise minutes today', suggested: 30, group: 'Effort' },
    { id: 'stand', label: 'Stand hours', unit: 'times', detail: 'Hours you stood and moved', suggested: 12, group: 'Effort' },
    { id: 'activeEnergy', label: 'Active calories', unit: 'calories', detail: 'Calories burned moving today', suggested: 500, group: 'Effort' },
    { id: 'workout', label: 'Workouts', unit: 'minutes', detail: 'Minutes of recorded workouts', suggested: 45, group: 'Effort' },

    { id: 'sleep', label: 'Sleep', unit: 'minutes', detail: 'Minutes asleep last night', suggested: 450, group: 'Recovery' },
    { id: 'mindfulness', label: 'Mindful minutes', unit: 'minutes', detail: 'Mindful minutes today', suggested: 10, group: 'Recovery' },

    { id: 'water', label: 'Water', unit: 'ml', detail: 'Water logged today', suggested: 2000, group: 'Intake' },
    { id: 'protein', label: 'Protein', unit: 'g', detail: 'Protein logged today', suggested: 100, group: 'Intake' },
    { id: 'caffeine', label: 'Caffeine', unit: 'mg', detail: 'Caffeine logged today', suggested: 200, group: 'Intake' },
    { id: 'calories', label: 'Calories eaten', unit: 'calories', detail: 'Energy logged today', suggested: 2000, group: 'Intake' },
];

const BY_ID = new Map(HEALTH_METRICS.map(metric => [metric.id, metric]));

export const healthInfo = (metric: HealthMetric): HealthMetricInfo | undefined => BY_ID.get(metric);
export const healthLabel = (metric: HealthMetric): string => BY_ID.get(metric)?.label ?? 'Health';
export const healthDetail = (metric: HealthMetric): string => BY_ID.get(metric)?.detail ?? '';
export const healthUnit = (metric: HealthMetric): string => BY_ID.get(metric)?.unit ?? 'times';

/** Whether a string off a database row is a metric this build knows. */
export const isHealthMetric = (value: unknown): value is HealthMetric =>
    typeof value === 'string' && BY_ID.has(value as HealthMetric);

/**
 * Which metrics could answer for a habit measured in this unit.
 *
 * Only ones whose reading can be stated *exactly* in the habit's own unit.
 * Being the same kind of thing is not enough: a step count and a glass of water
 * are both counts of something, and filling "8 glasses" from a step count would
 * be worse than offering nothing at all, because the number would look right.
 * `convert` is what makes "8 hours of sleep" work against a reading in minutes.
 */
export function metricsForUnit(unit?: string | null): HealthMetric[] {
    const wanted = unit?.trim().toLowerCase() ?? '';
    if (!wanted) return [];
    return HEALTH_METRICS
        .filter(metric => metric.unit === wanted || canConvert(metric.unit, wanted))
        .map(metric => metric.id);
}

/**
 * A reading, in the unit the habit is actually measured in.
 *
 * Null when the two do not convert, which the caller must treat as "Health did
 * not answer" rather than as a zero.
 */
export function inHabitUnit(value: number, metric: HealthMetric, unit?: string | null): number | null {
    const from = healthUnit(metric);
    const to = unit?.trim().toLowerCase() ?? '';
    if (!to || from === to) return value;
    return convert(value, from, to);
}

/** Whether a habit's unit and its linked metric still measure the same thing. */
export const metricFits = (unit: string | null | undefined, metric: HealthMetric): boolean =>
    metricsForUnit(unit).includes(metric);

/**
 * Today's number from Health, or null when it cannot be had.
 *
 * Null rather than zero, and the difference matters: zero is "you have not
 * moved today", null is "Health did not answer", and only one of those should
 * ever be written over what somebody logged by hand.
 */
export async function readHealth(metric: HealthMetric, date = new Date()): Promise<number | null> {
    try {
        const { HealthKitService } = require('./HealthKitService') as typeof import('./HealthKitService');
        if (!HealthKitService.isAvailable) return null;
        if (!await HealthKitService.init()) return null;
        const value = await HealthKitService.read(metric, date);
        return value === null || !Number.isFinite(value) ? null : Math.max(0, Math.round(value * 100) / 100);
    } catch {
        return null;
    }
}

/**
 * What to store after asking Health, given what is already stored.
 *
 * Health is a floor, never a ceiling. Somebody who walked on a second phone, or
 * logged a workout the watch missed, has a number Health cannot see, and
 * replacing theirs with a smaller one would be taking work away from them.
 */
export const mergeHealth = (stored: number, fromHealth: number | null): number =>
    fromHealth === null ? stored : Math.max(stored, fromHealth);
