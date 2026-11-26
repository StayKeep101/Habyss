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

export type HealthMetric = 'sleep' | 'steps' | 'exercise' | 'mindful' | 'distance' | 'flights' | 'energy'
    | 'workout' | 'strength' | 'run' | 'cycle' | 'swim' | 'yoga' | 'hiit'
    // Sports, each from its own workouts.
    | 'walk' | 'hike' | 'row' | 'badminton' | 'tennis' | 'squash' | 'tabletennis' | 'pickleball' | 'soccer' | 'basketball'
    | 'volleyball' | 'hockey' | 'football' | 'rugby' | 'baseball' | 'cricket' | 'golf' | 'climb' | 'ski' | 'snowboard'
    | 'skate' | 'surf' | 'paddle' | 'boxing' | 'martial' | 'dance' | 'jumprope' | 'elliptical' | 'stairs'
    // Gym and studio.
    | 'pilates' | 'core' | 'stretch';

/** Workouts by kind, as Health names them (react-native-health activityName); empty means any workout. */
export const WORKOUT_KINDS: Partial<Record<HealthMetric, readonly string[]>> = {
    workout: [],
    strength: ['TraditionalStrengthTraining', 'FunctionalStrengthTraining', 'CrossTraining'],
    run: ['Running', 'TrackAndField', 'WheelchairRunPace'],
    walk: ['Walking', 'WheelchairWalkPace'],
    hike: ['Hiking'],
    cycle: ['Cycling'],
    swim: ['Swimming', 'WaterFitness'],
    row: ['Rowing'],
    yoga: ['Yoga', 'MindAndBody'],
    pilates: ['Pilates', 'Barre'],
    core: ['CoreTraining'],
    stretch: ['Flexibility', 'PreparationAndRecovery', 'Cooldown'],
    hiit: ['HighIntensityIntervalTraining', 'MixedMetabolicCardioTraining', 'MixedCardio', 'StepTraining'],
    badminton: ['Badminton'],
    tennis: ['Tennis'],
    squash: ['Squash', 'Racquetball'],
    tabletennis: ['TableTennis'],
    pickleball: ['Pickleball'],
    soccer: ['Soccer'],
    basketball: ['Basketball'],
    volleyball: ['Volleyball'],
    hockey: ['Hockey'],
    football: ['AmericanFootball', 'AustralianFootball'],
    rugby: ['Rugby'],
    baseball: ['Baseball', 'Softball'],
    cricket: ['Cricket'],
    golf: ['Golf'],
    climb: ['Climbing'],
    ski: ['DownhillSkiing', 'CrossCountrySkiing', 'SnowSports'],
    snowboard: ['Snowboarding'],
    skate: ['SkatingSports'],
    surf: ['SurfingSports'],
    paddle: ['PaddleSports', 'Sailing', 'WaterSports'],
    boxing: ['Boxing', 'Kickboxing'],
    martial: ['MartialArts', 'Wrestling', 'Fencing'],
    dance: ['Dance', 'SocialDance', 'CardioDance', 'DanceInspiredTraining'],
    jumprope: ['JumpRope'],
    elliptical: ['Elliptical'],
    stairs: ['StairClimbing', 'Stairs'],
};
export const isWorkoutMetric = (metric: HealthMetric): boolean => metric in WORKOUT_KINDS;

/** How the Health list is sorted into groups (the chips over it). */
export type HealthGroup = 'activity' | 'sport' | 'gym' | 'body';
export const HEALTH_GROUPS: { id: HealthGroup; label: string; icon: string }[] = [
    { id: 'activity', label: 'Activity', icon: 'footsteps' },
    { id: 'sport', label: 'Sports', icon: 'trophy' },
    { id: 'gym', label: 'Gym & studio', icon: 'barbell' },
    { id: 'body', label: 'Sleep & mind', icon: 'moon' },
];

export interface HealthMetricInfo {
    id: HealthMetric;
    label: string;
    /** The unit the reader returns, in the app's own vocabulary. */
    unit: string;
    /** Other units it can be counted in: a run in km as well as minutes, any workout as sessions. */
    units?: readonly string[];
    detail: string;
    /** Roughly what a day (or a night) of it looks like, for a sensible first target. */
    suggested: number;
    group: HealthGroup;
    /** As an automatic habit (Settings → Automatic habits): its name, icon, unit and the targets offered. */
    habit: { name: string; icon: string; unit: string; target: number; targets: readonly number[] };
}

const MINUTE_TARGETS = [10, 15, 20, 30, 45, 60, 90] as const;
/** A workout: counted in minutes or sessions, and in km when it covers ground. */
const sport = (id: HealthMetric, label: string, name: string, icon: string, group: HealthGroup, target = 30, km = false): HealthMetricInfo => ({
    id, group, label, unit: 'minutes', units: km ? ['km', 'times'] : ['times'], detail: `${label} today`, suggested: target,
    habit: { name, icon, unit: 'minutes', target, targets: MINUTE_TARGETS },
});

export const HEALTH_METRICS: HealthMetricInfo[] = [
    // The day's numbers.
    { id: 'steps', group: 'activity', label: 'Steps', unit: 'steps', detail: 'Steps today, from your iPhone and Watch', suggested: 8000,
        habit: { name: 'Walk', icon: 'footsteps', unit: 'steps', target: 8000, targets: [3000, 5000, 6000, 7000, 8000, 10000, 12000, 15000] } },
    { id: 'distance', group: 'activity', label: 'Distance', unit: 'km', detail: 'Distance walked or run today', suggested: 5,
        habit: { name: 'Walk or run', icon: 'walk', unit: 'km', target: 5, targets: [1, 2, 3, 5, 8, 10, 15] } },
    { id: 'exercise', group: 'activity', label: 'Exercise minutes', unit: 'minutes', detail: 'Exercise minutes today (the green ring)', suggested: 30,
        habit: { name: 'Exercise', icon: 'fitness', unit: 'minutes', target: 30, targets: MINUTE_TARGETS } },
    { id: 'energy', group: 'activity', label: 'Active calories', unit: 'kcal', detail: 'Active calories burned today (the red ring)', suggested: 500,
        habit: { name: 'Move', icon: 'flame', unit: 'kcal', target: 500, targets: [200, 300, 400, 500, 600, 800, 1000] } },
    { id: 'flights', group: 'activity', label: 'Flights climbed', unit: 'flights', detail: 'Flights of stairs climbed today', suggested: 10,
        habit: { name: 'Take the stairs', icon: 'trending-up', unit: 'flights', target: 10, targets: [3, 5, 10, 15, 20] } },
    // Sports, each from its own workouts (Watch, Strava, Garmin, Whoop…).
    sport('run', 'Running', 'Run', 'speedometer', 'sport', 20, true),
    sport('walk', 'Walking', 'Walk', 'walk', 'sport', 30, true),
    sport('hike', 'Hiking', 'Hike', 'trail-sign', 'sport', 60, true),
    sport('cycle', 'Cycling', 'Ride', 'bicycle', 'sport', 30, true),
    sport('swim', 'Swimming', 'Swim', 'water', 'sport', 20, true),
    sport('row', 'Rowing', 'Row', 'boat', 'sport', 20, true),
    sport('badminton', 'Badminton', 'Badminton', 'tennisball', 'sport', 60),
    sport('tennis', 'Tennis', 'Tennis', 'tennisball', 'sport', 60),
    sport('squash', 'Squash', 'Squash', 'tennisball', 'sport', 45),
    sport('tabletennis', 'Table tennis', 'Table tennis', 'tennisball', 'sport', 45),
    sport('pickleball', 'Pickleball', 'Pickleball', 'tennisball', 'sport', 60),
    sport('soccer', 'Soccer', 'Soccer', 'football', 'sport', 60),
    sport('basketball', 'Basketball', 'Basketball', 'basketball', 'sport', 60),
    sport('volleyball', 'Volleyball', 'Volleyball', 'baseball', 'sport', 60),
    sport('hockey', 'Hockey', 'Hockey', 'snow', 'sport', 60),
    sport('football', 'Football', 'Football', 'american-football', 'sport', 60),
    sport('rugby', 'Rugby', 'Rugby', 'american-football', 'sport', 60),
    sport('baseball', 'Baseball', 'Baseball', 'baseball', 'sport', 60),
    sport('cricket', 'Cricket', 'Cricket', 'baseball', 'sport', 60),
    sport('golf', 'Golf', 'Golf', 'golf', 'sport', 90),
    sport('climb', 'Climbing', 'Climb', 'trending-up', 'sport', 60),
    sport('ski', 'Skiing', 'Ski', 'snow', 'sport', 90),
    sport('snowboard', 'Snowboarding', 'Snowboard', 'snow', 'sport', 90),
    sport('skate', 'Skating', 'Skate', 'snow', 'sport', 30),
    sport('surf', 'Surfing', 'Surf', 'water', 'sport', 60),
    sport('paddle', 'Paddling and sailing', 'Paddle', 'boat', 'sport', 45),
    sport('boxing', 'Boxing', 'Boxing', 'hand-left', 'sport', 30),
    sport('martial', 'Martial arts', 'Martial arts', 'hand-left', 'sport', 45),
    sport('dance', 'Dance', 'Dance', 'musical-notes', 'sport', 30),
    // Gym and studio.
    sport('strength', 'Strength', 'Gym', 'barbell', 'gym', 30),
    sport('hiit', 'HIIT and cardio', 'HIIT', 'flash', 'gym', 15),
    sport('core', 'Core', 'Core', 'body', 'gym', 15),
    sport('yoga', 'Yoga', 'Yoga', 'body', 'gym', 15),
    sport('pilates', 'Pilates and barre', 'Pilates', 'body', 'gym', 30),
    sport('stretch', 'Stretching', 'Stretch', 'body', 'gym', 10),
    sport('jumprope', 'Jump rope', 'Jump rope', 'fitness', 'gym', 10),
    sport('elliptical', 'Elliptical', 'Elliptical', 'fitness', 'gym', 20),
    sport('stairs', 'Stair climber', 'Stair climber', 'trending-up', 'gym', 20),
    sport('workout', 'Any workout', 'Work out', 'fitness', 'gym', 30),
    // Sleep and mind.
    { id: 'sleep', group: 'body', label: 'Sleep', unit: 'minutes', detail: 'Time asleep last night', suggested: 450,
        habit: { name: 'Sleep', icon: 'moon', unit: 'hours', target: 7.5, targets: [6, 6.5, 7, 7.5, 8, 8.5, 9] } },
    { id: 'mindful', group: 'body', label: 'Mindful minutes', unit: 'minutes', detail: 'Mindful minutes today, from any meditation app', suggested: 10,
        habit: { name: 'Meditate', icon: 'leaf', unit: 'minutes', target: 10, targets: [3, 5, 10, 15, 20, 30] } },
];

const BY_ID = new Map(HEALTH_METRICS.map(metric => [metric.id, metric]));

/** Every unit a metric can be counted in, its own first. */
export const unitsOf = (metric: HealthMetricInfo): string[] => [metric.unit, ...(metric.units ?? [])];
/**
 * The units a habit linked to this metric can be measured in, as the Measure
 * panel names them: a run in minutes, hours, km, miles or sessions; steps in steps.
 */
export function measureUnits(metric: HealthMetric): string[] {
    const info = BY_ID.get(metric);
    if (!info) return [];
    return unitsOf(info).flatMap(unit => (unit === 'minutes' ? ['minutes', 'hours'] : unit === 'km' ? ['km', 'miles'] : unit === 'times' ? ['sessions'] : [unit]));
}

/** Whether a habit's unit asks for a count of sessions ("1 time", "3 sessions"). */
export const isSessionsUnit = (unit?: string | null): boolean => /^(time|times|sessions?)$/i.test(unit?.trim() ?? '');
/**
 * Which of a metric's own units answers for a habit's unit: km for a habit in
 * km or miles, sessions for one counted in times, else its own (minutes).
 */
export function readingUnit(metric: HealthMetric, unit?: string | null): string {
    const info = BY_ID.get(metric);
    if (!info) return healthUnit(metric);
    const wanted = unit?.trim().toLowerCase() ?? '';
    if (!wanted) return info.unit;
    if (isSessionsUnit(wanted) && info.units?.includes('times')) return 'times';
    return unitsOf(info).find(own => own === wanted || canConvert(own, wanted)) ?? info.unit;
}

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
    const raw = unit?.trim().toLowerCase() ?? '';
    if (!raw) return [];
    // "1 time", "3 sessions": how many workouts.
    const wanted = isSessionsUnit(raw) ? 'times' : raw;
    return HEALTH_METRICS
        .filter(metric => unitsOf(metric).some(unit => unit === wanted || canConvert(unit, wanted)))
        .map(metric => metric.id);
}

/**
 * A reading, in the unit the habit is actually measured in.
 *
 * Null when the two do not convert, which the caller must treat as "Health did
 * not answer" rather than as a zero.
 */
export function inHabitUnit(value: number, metric: HealthMetric, unit?: string | null): number | null {
    const from = readingUnit(metric, unit);
    const to = unit?.trim().toLowerCase() ?? '';
    if (!to || from === to) return value;
    if (from === 'times' && isSessionsUnit(to)) return value;
    return convert(value, from, to);
}

/** Whether a habit's unit and its linked metric still measure the same thing. */
export const metricFits = (unit: string | null | undefined, metric: HealthMetric): boolean =>
    metricsForUnit(unit).includes(metric);

/**
 * What to store after asking Health, given what is already stored.
 *
 * Health is a floor, never a ceiling. Somebody who walked on a second phone, or
 * logged a workout the watch missed, has a number Health cannot see, and
 * replacing theirs with a smaller one would be taking work away from them.
 */
export const mergeHealth = (stored: number, fromHealth: number | null): number =>
    fromHealth === null ? stored : Math.max(stored, fromHealth);
