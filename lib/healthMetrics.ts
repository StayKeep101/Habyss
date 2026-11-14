import { canConvert, convert } from './unitKind';

/**
 * What Habyss can track by itself, from Apple Health: a habit linked to one of
 * these fills itself in (lib/habitsSQLite.ts syncHealthKitData), so it is done
 * without a tap. Settings → Automatic habits lists them.
 *
 * Garmin, Oura, Whoop, Fitbit, Strava, the Apple Watch and the iPhone itself
 * all write into Apple Health, so reading Health is the integration with every
 * one of them, and keeps working when any of them changes an API. Read-only.
 */

export type HealthMetric = 'sleep' | 'steps' | 'exercise' | 'mindful' | 'distance' | 'flights' | 'energy';

export interface HealthMetricInfo {
    id: HealthMetric;
    label: string;
    /** The unit the reader returns, in the app's own vocabulary. */
    unit: string;
    detail: string;
    /** Roughly what a day (or a night) of it looks like, for a sensible first target. */
    suggested: number;
    /** As an automatic habit (Settings → Automatic habits): its name, icon, unit and the targets offered. */
    habit: { name: string; icon: string; unit: string; target: number; targets: readonly number[] };
}

export const HEALTH_METRICS: HealthMetricInfo[] = [
    { id: 'sleep', label: 'Sleep', unit: 'minutes', detail: 'Time asleep last night', suggested: 450,
        habit: { name: 'Sleep', icon: 'moon', unit: 'hours', target: 7.5, targets: [6, 6.5, 7, 7.5, 8, 8.5, 9] } },
    { id: 'steps', label: 'Steps', unit: 'steps', detail: 'Steps today, from your iPhone and Watch', suggested: 8000,
        habit: { name: 'Walk', icon: 'footsteps', unit: 'steps', target: 8000, targets: [3000, 5000, 6000, 7000, 8000, 10000, 12000, 15000] } },
    { id: 'exercise', label: 'Exercise', unit: 'minutes', detail: 'Exercise minutes today (the green ring)', suggested: 30,
        habit: { name: 'Exercise', icon: 'fitness', unit: 'minutes', target: 30, targets: [10, 15, 20, 30, 45, 60, 90] } },
    { id: 'mindful', label: 'Mindful minutes', unit: 'minutes', detail: 'Mindful minutes today, from any meditation app', suggested: 10,
        habit: { name: 'Meditate', icon: 'leaf', unit: 'minutes', target: 10, targets: [3, 5, 10, 15, 20, 30] } },
    { id: 'distance', label: 'Walking and running', unit: 'km', detail: 'Distance walked or run today', suggested: 5,
        habit: { name: 'Walk or run', icon: 'walk', unit: 'km', target: 5, targets: [1, 2, 3, 5, 8, 10, 15] } },
    { id: 'flights', label: 'Flights climbed', unit: 'flights', detail: 'Flights of stairs climbed today', suggested: 10,
        habit: { name: 'Take the stairs', icon: 'trending-up', unit: 'flights', target: 10, targets: [3, 5, 10, 15, 20] } },
    { id: 'energy', label: 'Active energy', unit: 'kcal', detail: 'Active calories burned today (the red ring)', suggested: 500,
        habit: { name: 'Move', icon: 'flame', unit: 'kcal', target: 500, targets: [200, 300, 400, 500, 600, 800, 1000] } },
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
