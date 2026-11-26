/**
 * Everything that can fill a habit in without being asked, and how.
 *
 * ── The thing worth understanding before reading the list ─────────────────
 *
 * On iOS, Apple Health is a hub, not another app. Garmin Connect, Whoop, Oura,
 * Fitbit, Strava, Peloton, Zwift, Nike Run Club, AutoSleep, MyFitnessPal and
 * most of the rest all write into it. Reading Health deeply is therefore not a
 * substitute for integrating with those services — it *is* the integration, and
 * it is the one that survives them changing an API, an OAuth flow or a partner
 * programme while nobody is watching.
 *
 * Talking to each service directly would need a partner agreement, a server to
 * hold the OAuth secrets, and a public URL for their webhooks. None of those
 * can live inside an app, so where a direct connection is the only way, it is
 * listed as `needsServer` rather than quietly implied.
 *
 * Nothing here pretends. A service that cannot reach Habyss today says so, and
 * says what it would take.
 */

export type ConnectionRoute =
    /** Habyss reads it directly. */
    | 'direct'
    /** It writes to Apple Health, and Habyss reads Health. */
    | 'health'
    /** No automatic route exists; the in-app timer is the honest proof. */
    | 'timer'
    /** Would need a server Habyss does not have yet. */
    | 'needsServer'
    /** Would need a permission Apple grants case by case. */
    | 'needsEntitlement';

export interface Integration {
    id: string;
    name: string;
    /** What it can answer for, in the user's words. */
    covers: string;
    route: ConnectionRoute;
    icon: string;
    /** What the person has to do, if anything. */
    step?: string;
}

export const INTEGRATIONS: Integration[] = [
    {
        id: 'apple_health',
        name: 'Apple Health',
        covers: 'Steps, distance, exercise, workouts, sleep, mindful minutes, water, calories',
        route: 'direct',
        icon: 'heart',
        step: 'Turn it on below. One prompt covers everything.',
    },
    {
        id: 'apple_watch',
        name: 'Apple Watch',
        covers: 'Rings, workouts, stand hours, sleep',
        route: 'health',
        icon: 'watch',
    },
    {
        id: 'garmin',
        name: 'Garmin',
        covers: 'Runs, rides, swims, steps, sleep',
        route: 'health',
        icon: 'fitness',
        step: 'Garmin Connect → Settings → Apple Health → allow all categories.',
    },
    {
        id: 'whoop',
        name: 'Whoop',
        covers: 'Strain, workouts, sleep',
        route: 'health',
        icon: 'pulse',
        step: 'Whoop → Settings → Integrations → Apple Health.',
    },
    {
        id: 'oura',
        name: 'Oura',
        covers: 'Sleep, activity, readiness',
        route: 'health',
        icon: 'moon',
        step: 'Oura → Settings → Apple Health → enable.',
    },
    {
        id: 'fitbit',
        name: 'Fitbit',
        covers: 'Steps, workouts, sleep',
        route: 'health',
        icon: 'walk',
        step: 'Fitbit does not write to Health on its own — use a bridge such as Health Sync.',
    },
    {
        id: 'strava',
        name: 'Strava',
        covers: 'Runs, rides, swims',
        route: 'health',
        icon: 'bicycle',
        step: 'Strava → Settings → Applications → Health → write all.',
    },
    {
        id: 'peloton',
        name: 'Peloton',
        covers: 'Classes, workout minutes',
        route: 'health',
        icon: 'barbell',
        step: 'Peloton → Settings → Apple Health.',
    },
    {
        id: 'nike',
        name: 'Nike Run Club',
        covers: 'Runs and distance',
        route: 'health',
        icon: 'walk',
        step: 'Nike Run Club → Settings → Health.',
    },
    {
        id: 'myfitnesspal',
        name: 'MyFitnessPal',
        covers: 'Calories, protein, water',
        route: 'health',
        icon: 'restaurant',
        step: 'MyFitnessPal → Settings → Apple Health.',
    },
    {
        id: 'reading',
        name: 'Kindle and reading',
        covers: 'Reading time',
        route: 'timer',
        icon: 'book',
        step: 'Amazon publishes no reading data to any app. Run the timer while you read and it counts as proof.',
    },
    {
        id: 'screen_time',
        name: 'Screen Time',
        covers: 'Time in an app, time off your phone',
        route: 'needsEntitlement',
        icon: 'hourglass',
        step: 'Needs Apple’s Family Controls entitlement, which is granted case by case.',
    },
    {
        id: 'garmin_direct',
        name: 'Garmin, directly',
        covers: 'Everything Garmin records, without Health in the middle',
        route: 'needsServer',
        icon: 'cloud-download',
        step: 'Needs a Garmin partner agreement and a server for their webhooks.',
    },
    {
        id: 'spotify',
        name: 'Spotify and podcasts',
        covers: 'Listening time',
        route: 'needsServer',
        icon: 'headset',
        step: 'Needs a server to hold the OAuth secret.',
    },
];

export const ROUTE_LABEL: Record<ConnectionRoute, string> = {
    direct: 'Connect',
    health: 'Through Apple Health',
    timer: 'Use the timer',
    needsServer: 'Not yet',
    needsEntitlement: 'Not yet',
};

/** Anything that works today, and anything that does not. */
export const workingToday = (integration: Integration): boolean =>
    integration.route === 'direct' || integration.route === 'health' || integration.route === 'timer';
