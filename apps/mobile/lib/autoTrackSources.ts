import { guessHealthMetric } from './autoTrackGuess';
import { HEALTH_METRICS, isWorkoutMetric, type HealthMetric } from './healthMetrics';
import { APP_TIME_IDEAS, type AppTimeIdea } from './appTime';

/**
 * What could tick a habit by itself, read from what it is called while it is
 * being written: Apple Health (and every app that saves into it: Strava,
 * Bevel, Oura, Garmin, the Watch), time spent in apps (Read → Libby, Kindle,
 * Books), or time at a place (Gym → 30 minutes there). The habit sheet shows
 * these under the sentence; the first is chosen unless turned off. Pure.
 */
export type AutoTrackOption =
    | { kind: 'health'; key: string; metric: HealthMetric; label: string; detail: string }
    | { kind: 'app'; key: string; idea: AppTimeIdea; label: string; detail: string }
    | { kind: 'place'; key: string; place: string; label: string; detail: string };

/** Apps people actually use that save into Apple Health, by what they count. */
const HEALTH_FROM: Partial<Record<HealthMetric, { label: string; apps: string }>> = {
    sleep: { label: 'Sleep from Apple Health', apps: 'Watch, Bevel, Oura, Whoop, AutoSleep' },
    steps: { label: 'Steps from Apple Health', apps: 'iPhone, Watch, Garmin, Fitbit' },
    flights: { label: 'Flights climbed from Apple Health', apps: 'iPhone, Watch' },
    mindful: { label: 'Mindful minutes from Apple Health', apps: 'Calm, Headspace, Bevel, Breathe' },
    run: { label: 'Runs from Apple Health', apps: 'Watch, Strava, Nike Run Club, Garmin, Runna' },
    cycle: { label: 'Rides from Apple Health', apps: 'Watch, Strava, Zwift, Peloton, Garmin' },
    swim: { label: 'Swims from Apple Health', apps: 'Watch, Strava, MySwimPro, Garmin' },
    yoga: { label: 'Yoga from Apple Health', apps: 'Watch, Fitness+, Down Dog, Peloton' },
    hiit: { label: 'Workouts from Apple Health', apps: 'Watch, Fitness+, Peloton, Strava' },
    strength: { label: 'Strength workouts from Apple Health', apps: 'Watch, Bevel, Strong, Hevy, Fitbod' },
    workout: { label: 'Workouts from Apple Health', apps: 'Watch, Strava, Bevel, Peloton, Whoop' },
    exercise: { label: 'Exercise minutes from Apple Health', apps: 'Watch, Whoop, Oura' },
};

/** Time in apps: what the habit is, the apps it means. */
const BY_APP: [RegExp, AppTimeIdea['id'], string][] = [
    [/\b(read\w*|book\w*|novel|pages?|audiobook|libby|kindle)\b/, 'read', 'Libby, Kindle, Books, Audible'],
    [/\b(duolingo|language|spanish|french|german|italian|japanese|korean|mandarin|chinese|portuguese|arabic|vocab\w*)\b/, 'language', 'Duolingo, Babbel, Busuu'],
    [/\b(meditat\w*|mindful\w*|breath(e|ing|work))\b/, 'learn', 'Calm, Headspace, Insight Timer'],
    [/\b(course|lesson|class(es)?|learn\w*|podcast|chess|piano|guitar)\b/, 'learn', 'Coursera, Brilliant, Simply Piano, Chess'],
];
const QUIT_APP: [RegExp, AppTimeIdea['id'], string][] = [
    [/\b(social|instagram|tiktok|twitter|x\.com|facebook|snapchat|reddit|scroll\w*|doom ?scroll\w*)\b/, 'social', 'Instagram, TikTok, X, Reddit'],
    [/\b(games?|gaming)\b/, 'games', 'Your games'],
];

/** Places a habit happens at: the word to name it by. */
const BY_PLACE: [RegExp, string][] = [
    [/\b(gym|lift\w*|weights?|strength|bench|squats?|crossfit|climb\w*|boulder\w*)\b/, 'the gym'],
    [/\b(swim\w*|pool|laps)\b/, 'the pool'],
    [/\b(library)\b/, 'the library'],
    [/\b(church|mass|mosque|temple|synagogue|pray\w*)\b/, 'church'],
    [/\b(office|go to work|commute)\b/, 'the office'],
    [/\b(park|outside|outdoors|nature)\b/, 'the park'],
    [/\b(yoga|pilates)\b/, 'the studio'],
    [/\b(class(es)?|school|campus|lecture)\b/, 'school'],
];

/** Minutes in apps or at a place it takes: what the habit says, else a sensible default. */
export function trackMinutes(option: AutoTrackOption, said?: { amount?: number; unit?: string; durationMinutes?: number }): number {
    const unit = said?.unit?.toLowerCase() ?? '';
    if (said?.amount && /^(min|mins|minutes?)$/.test(unit)) return Math.round(said.amount);
    if (said?.amount && /^(h|hr|hrs|hours?)$/.test(unit)) return Math.round(said.amount * 60);
    if (said?.durationMinutes) return Math.round(said.durationMinutes);
    return 30;
}

const minutesSaid = (minutes: number) => (minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`);

/**
 * Every way this habit could track itself, best first (at most two, so the
 * line under the sentence stays a line). Nothing when nothing could.
 */
export function autoTrackOptions(name: string, said?: { amount?: number; unit?: string; durationMinutes?: number; quit?: boolean }): AutoTrackOption[] {
    const text = name.toLowerCase().trim();
    if (!text) return [];
    const options: AutoTrackOption[] = [];

    if (said?.quit) {
        const quit = QUIT_APP.find(([pattern]) => pattern.test(text));
        const idea = quit && APP_TIME_IDEAS.find(item => item.id === quit[1]);
        if (quit && idea) {
            const option: AutoTrackOption = { kind: 'app', key: 'app', idea, label: `Time in ${quit[2]}`, detail: '' };
            option.detail = `Kept when the day ends under ${minutesSaid(trackMinutes(option, said))}`;
            options.push(option);
        }
        return options;
    }

    // Reading, a language: time in the app is the truest count, so it comes first.
    const app = BY_APP.find(([pattern]) => pattern.test(text));
    const idea = app && APP_TIME_IDEAS.find(item => item.id === app[1]);
    const appOption: AutoTrackOption | null = app && idea ? { kind: 'app', key: 'app', idea, label: `Time in ${app[2]}`, detail: '' } : null;
    if (appOption) appOption.detail = `Ticks itself after ${minutesSaid(trackMinutes(appOption, said))} in them`;

    const metric = guessHealthMetric(text, said?.unit);
    const from = metric ? HEALTH_FROM[metric] : undefined;
    const healthOption: AutoTrackOption | null = metric && from
        ? { kind: 'health', key: `health:${metric}`, metric, label: from.label, detail: `${from.apps}, anything that saves to Health` }
        : null;

    const place = BY_PLACE.find(([pattern]) => pattern.test(text));
    const placeOption: AutoTrackOption | null = place ? { kind: 'place', key: 'place', place: place[1], label: `At ${place[1]}`, detail: '' } : null;
    if (placeOption) placeOption.detail = `Ticks itself after ${minutesSaid(trackMinutes(placeOption, said))} there`;

    // Meditation counts best from Health (the apps write mindful minutes); a workout from
    // Health too, then the place it happens at for whoever never logs one.
    const order = metric && (metric === 'mindful' || isWorkoutMetric(metric) || metric === 'sleep' || metric === 'steps')
        ? [healthOption, placeOption, appOption]
        : [appOption, healthOption, placeOption];
    for (const option of order) if (option && options.length < 2) options.push(option);
    return options;
}

/** What feeds a Health metric: the apps that save it, else what it counts. */
export function healthSource(metric: HealthMetric): string {
    const from = HEALTH_FROM[metric];
    if (from) return `${from.apps}, anything that saves to Health`;
    return HEALTH_METRICS.find(item => item.id === metric)?.detail ?? 'From Apple Health';
}

/**
 * Every way a habit can track itself, for the Tracking chip: each Health
 * metric, each kind of app time (the ones for breaking a habit when it is
 * being broken), and a place. Keys match autoTrackOptions', so a suggestion
 * and the chip agree on what is chosen.
 */
export function allTrackOptions(quit: boolean): AutoTrackOption[] {
    const health: AutoTrackOption[] = quit ? [] : HEALTH_METRICS.map(info => ({
        kind: 'health' as const, key: `health:${info.id}`, metric: info.id, label: info.label, detail: healthSource(info.id),
    }));
    // Time in apps: one way; which apps is chosen in Apple's picker, how long comes from the habit.
    const idea = APP_TIME_IDEAS.find(item => item.quit === quit) ?? APP_TIME_IDEAS[0];
    const apps: AutoTrackOption[] = [{ kind: 'app', key: 'app', idea, label: 'Apps', detail: idea.detail }];
    const place: AutoTrackOption = { kind: 'place', key: 'place', place: 'a place', label: 'A place', detail: 'Ticks itself after time there' };
    return [...health, ...apps, place];
}
