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
    // Sports, most specific first.
    [/\b(hike|hiking|trek\w*)\b/, 'hike'],
    [/\b(run|running|jog|jogging|sprint\w*|5k|10k|marathon)\b/, 'run'],
    [/\b(bike|biking|cycl\w*|ride|spin)\b/, 'cycle'],
    [/\bswim/, 'swim'],
    [/\b(row|rowing|erg)\b/, 'row'],
    [/\bbadminton\b/, 'badminton'],
    [/\b(table tennis|ping ?pong)\b/, 'tabletennis'],
    [/\bpickleball\b/, 'pickleball'],
    [/\btennis\b/, 'tennis'],
    [/\b(squash|racquetball)\b/, 'squash'],
    [/\b(soccer|futsal)\b/, 'soccer'],
    [/\bbasketball\b/, 'basketball'],
    [/\bvolleyball\b/, 'volleyball'],
    [/\bhockey\b/, 'hockey'],
    [/\b(american football|football)\b/, 'football'],
    [/\brugby\b/, 'rugby'],
    [/\b(baseball|softball)\b/, 'baseball'],
    [/\bcricket\b/, 'cricket'],
    [/\bgolf\b/, 'golf'],
    [/\b(climb\w*|boulder\w*)\b/, 'climb'],
    [/\bsnowboard\w*/, 'snowboard'],
    [/\bski(ing)?\b/, 'ski'],
    [/\b(skat\w*)\b/, 'skate'],
    [/\bsurf\w*/, 'surf'],
    [/\b(kayak\w*|canoe\w*|paddl\w*|sail\w*|sup)\b/, 'paddle'],
    [/\b(boxing|kickbox\w*)\b/, 'boxing'],
    [/\b(martial arts?|karate|judo|jiu ?jitsu|bjj|taekwondo|muay thai|wrestl\w*|fencing)\b/, 'martial'],
    [/\b(danc\w*|zumba)\b/, 'dance'],
    [/\b(jump ?rope|skipping)\b/, 'jumprope'],
    [/\belliptical\b/, 'elliptical'],
    [/\b(stair ?master|stair climber)\b/, 'stairs'],
    // Gym and studio.
    [/\b(pilates|barre)\b/, 'pilates'],
    [/\byoga\b/, 'yoga'],
    [/\b(stretch\w*|mobility)\b/, 'stretch'],
    [/\b(core|abs|plank\w*)\b/, 'core'],
    [/\b(hiit|cardio)\b/, 'hiit'],
    [/\b(gym|lift\w*|weights?|strength|push ?-?ups?|squats?|bench|crossfit)\b/, 'strength'],
    [/\b(workout|work out|train(ing)?)\b/, 'workout'],
    [/\b(exercise|move ring)\b/, 'exercise'],
    [/\b(walk|walking)\b/, 'steps'],
    [/\b(stairs|flights?)\b/, 'flights'],
];

export function guessHealthMetric(name: string, unit?: string | null): HealthMetric | null {
    const text = name.toLowerCase();
    const byName = BY_NAME.find(([pattern]) => pattern.test(text))?.[1] ?? null;
    // "time", "times", "sessions": the sheet's way of saying no unit, not a measure.
    if (!unit?.trim() || /^(time|times|sessions?|count|x)$/i.test(unit.trim())) return byName;
    // A unit narrows it: only a source that can be read in that unit.
    const fits = metricsForUnit(unit);
    if (byName && fits.includes(byName)) return byName;
    // A walk in km: the day's distance, workout or not.
    if (byName === 'steps' && fits.includes('distance')) return 'distance';
    return fits.length === 1 ? fits[0] : null;
}

/** What a habit takes on when it is linked: the source's unit and a sensible daily target. */
export function autoTrackDefaults(metric: HealthMetric): { unit: string; target: number } {
    const info = HEALTH_METRICS.find(item => item.id === metric);
    return { unit: info?.habit.unit ?? 'minutes', target: info?.habit.target ?? 1 };
}
