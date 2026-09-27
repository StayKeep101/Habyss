import { kindOf } from './unitKind';

/**
 * The third way to know a habit is done: Apple Health already knows.
 *
 * `healthKitMetric` has been on the habit table, and in `lib/evidence.ts`, for
 * as long as either existed — but nothing ever set it and nothing ever read
 * Health, so a habit that HealthKit could answer for still had to be ticked by
 * hand. This is the missing middle: which metrics exist, which a habit's unit
 * can be answered by, and what today's number is.
 */

export type HealthMetric = 'steps' | 'sleep' | 'mindfulness' | 'workout';

export const HEALTH_METRICS: { id: HealthMetric; label: string; unit: string; detail: string }[] = [
    { id: 'steps', label: 'Steps', unit: 'steps', detail: 'Today’s step count' },
    { id: 'sleep', label: 'Sleep', unit: 'minutes', detail: 'Minutes asleep last night' },
    { id: 'mindfulness', label: 'Mindful', unit: 'minutes', detail: 'Mindful minutes today' },
    { id: 'workout', label: 'Workouts', unit: 'minutes', detail: 'Minutes worked out today' },
];

const BY_ID = new Map(HEALTH_METRICS.map(metric => [metric.id, metric]));

export const healthLabel = (metric: HealthMetric): string => BY_ID.get(metric)?.label ?? 'Health';
export const healthDetail = (metric: HealthMetric): string => BY_ID.get(metric)?.detail ?? '';

/**
 * Which metrics could answer for a habit measured in this unit.
 *
 * Only ones that measure the same thing: offering to fill "8 glasses" from a
 * step count would be worse than offering nothing, because the number would
 * look like an answer. A step habit gets steps; anything counted in time gets
 * the three that are counted in minutes.
 */
export function metricsForUnit(unit?: string | null): HealthMetric[] {
    const clean = unit?.trim().toLowerCase() ?? '';
    if (!clean) return [];
    if (clean === 'steps' || clean === 'step') return ['steps'];
    if (kindOf(clean) === 'duration') return ['sleep', 'mindfulness', 'workout'];
    return [];
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
        const value = metric === 'steps' ? await HealthKitService.getSteps(date)
            : metric === 'sleep' ? await HealthKitService.getSleep(date)
                : metric === 'mindfulness' ? await HealthKitService.getMindfulness(date)
                    : await HealthKitService.getWorkout(date);
        return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
    } catch {
        return null;
    }
}

/**
 * What to store after asking Health, given what is already stored.
 *
 * Health is a floor, never a ceiling. Somebody who walked on a second phone,
 * or logged a workout the watch missed, has a number Health cannot see, and
 * replacing theirs with a smaller one would be taking work away from them.
 */
export const mergeHealth = (stored: number, fromHealth: number | null): number =>
    fromHealth === null ? stored : Math.max(stored, fromHealth);
