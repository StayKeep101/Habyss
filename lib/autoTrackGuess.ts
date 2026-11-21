import { HEALTH_METRICS, metricsForUnit, type HealthMetric } from './healthMetrics';

/**
 * Every new habit tracks itself when something can count it: what it is, from
 * its name (and its unit, when it has one), matched to what Apple Health
 * already counts. "Run" ticks itself from runs, "Walk 8000 steps" from steps,
 * "Meditate" from mindful minutes. Nothing matched: it stays ticked by hand
 * (with a photo, lib/challengeProof.ts). Pure.
 */
const BY_NAME: [RegExp, HealthMetric][] = [
    [/\bsleep|\bbed ?time|\bin bed\b/, 'sleep'],
    [/\bsteps?\b/, 'steps'],
    [/\bmeditat|\bmindful|\bbreath(e|ing|work)/, 'mindful'],
    [/\b(run|running|jog|jogging)\b/, 'run'],
    [/\b(bike|biking|cycl\w*|ride|spin)\b/, 'cycle'],
    [/\bswim/, 'swim'],
    [/\b(yoga|pilates|stretch\w*|mobility)\b/, 'yoga'],
    [/\b(hiit|cardio|boxing|kickbox\w*)\b/, 'hiit'],
    [/\b(gym|lift\w*|weights?|strength|push ?-?ups?|squats?|bench)\b/, 'strength'],
    [/\b(workout|work out|train(ing)?)\b/, 'workout'],
    [/\b(exercise|move ring)\b/, 'exercise'],
    [/\b(walk|walking|hike|hiking)\b/, 'steps'],
    [/\b(stairs|flights?)\b/, 'flights'],
];

export function guessHealthMetric(name: string, unit?: string | null): HealthMetric | null {
    const text = name.toLowerCase();
    const byName = BY_NAME.find(([pattern]) => pattern.test(text))?.[1] ?? null;
    if (!unit?.trim()) return byName;
    // A unit narrows it: only a source that can be read in that unit.
    const fits = metricsForUnit(unit);
    if (byName && fits.includes(byName)) return byName;
    return fits.length === 1 ? fits[0] : null;
}

/** What a habit takes on when it is linked: the source's unit and a sensible daily target. */
export function autoTrackDefaults(metric: HealthMetric): { unit: string; target: number } {
    const info = HEALTH_METRICS.find(item => item.id === metric);
    return { unit: info?.habit.unit ?? 'minutes', target: info?.habit.target ?? 1 };
}
