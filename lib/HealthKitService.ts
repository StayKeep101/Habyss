import { Platform } from 'react-native';
import type { HealthMetric } from './healthMetrics';

/**
 * Reading Apple Health, which is where every other device already writes.
 *
 * Garmin, Whoop, Oura, Fitbit, Strava, Peloton and the rest all put their data
 * into Health on iOS. This file is therefore the whole of the wearable
 * integration, and adding a metric here adds it for every one of them at once.
 *
 * Everything below is defensive in the same way for the same reason: the native
 * module is absent on Android, absent in Expo Go, and present-but-unauthorised
 * whenever somebody says no. Each reader answers `null` in all three cases,
 * because "Health did not say" and "you did nothing today" are different facts
 * and only one of them should ever be written into a habit.
 */

type HealthValue = { value?: number };

let AppleHealthKit: any = null;
try {
    AppleHealthKit = require('react-native-health');
} catch {
    AppleHealthKit = null;
}

const permission = (key: string): string | null => AppleHealthKit?.Constants?.Permissions?.[key] ?? null;

/**
 * Everything the app ever asks for, in one prompt.
 *
 * iOS shows this sheet once per permission, and a second prompt weeks later
 * reads as an app that has changed its mind about what it wants. Asking for the
 * whole set up front — and only the set that some habit could actually use — is
 * both kinder and more likely to be granted.
 */
const READ = [
    'Steps', 'StepCount', 'DistanceWalkingRunning', 'DistanceCycling', 'DistanceSwimming',
    'FlightsClimbed', 'AppleExerciseTime', 'AppleStandTime', 'ActiveEnergyBurned',
    'Workout', 'SleepAnalysis', 'MindfulSession',
    'Water', 'Protein', 'Caffeine', 'EnergyConsumed',
];

/** The two the app can write back, so a Habyss timer shows up in Health too. */
const WRITE = ['MindfulSession', 'Workout'];

const buildPermissions = () => ({
    permissions: {
        read: READ.map(permission).filter(Boolean) as string[],
        write: WRITE.map(permission).filter(Boolean) as string[],
    },
});

const has = (method: string): boolean =>
    Platform.OS === 'ios' && !!AppleHealthKit && typeof AppleHealthKit[method] === 'function';

/** Start of the day a reading is about, and the moment after it ends. */
function bounds(date: Date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
}

/** Adds up a set of samples, which is what most of these come back as. */
const sum = (rows: any[] | undefined, pick: (row: any) => number): number =>
    (rows ?? []).reduce((total, row) => total + (Number(pick(row)) || 0), 0);

/** Minutes between two timestamps on a sample. */
const minutesOf = (row: any): number =>
    (new Date(row?.endDate).getTime() - new Date(row?.startDate).getTime()) / 60000;

function ask<T>(method: string, options: object, read: (results: any) => T): Promise<T | null> {
    if (!has(method)) return Promise.resolve(null);
    return new Promise(resolve => {
        try {
            AppleHealthKit[method](options, (error: unknown, results: any) => {
                if (error) { resolve(null); return; }
                try { resolve(read(results)); } catch { resolve(null); }
            });
        } catch {
            resolve(null);
        }
    });
}

export class HealthKitService {
    static get isAvailable(): boolean {
        return Platform.OS === 'ios' && !!AppleHealthKit;
    }

    /**
     * Whether access has already been granted, without asking for it.
     *
     * A settings screen that opens a permission sheet just for being looked at
     * is a settings screen people stop opening.
     */
    static async authorised(): Promise<boolean> {
        if (!has('getAuthStatus')) return false;
        return new Promise(resolve => {
            try {
                AppleHealthKit.getAuthStatus(buildPermissions(), (error: unknown, results: any) => {
                    if (error) { resolve(false); return; }
                    // iOS reports 2 for "sharing authorised" per permission; one
                    // granted read is enough to say the connection exists.
                    const read = results?.permissions?.read ?? [];
                    resolve(Array.isArray(read) && read.some((state: number) => state === 2));
                });
            } catch {
                resolve(false);
            }
        });
    }

    static async init(): Promise<boolean> {
        if (!has('initHealthKit')) return false;
        return new Promise(resolve => {
            AppleHealthKit.initHealthKit(buildPermissions(), (error: string | null) => {
                if (error) console.warn('HealthKit init error:', error);
                resolve(!error);
            });
        });
    }

    /**
     * One day of one metric, in the unit the habit expects.
     *
     * The conversions are here rather than at the call site because HealthKit's
     * defaults are not the app's: distance comes back in metres, and a habit
     * measured in kilometres would silently be told it had run five thousand.
     */
    static async read(metric: HealthMetric, date = new Date()): Promise<number | null> {
        const day = bounds(date);
        const onDay = { date: date.toISOString(), includeManuallyAdded: true };

        switch (metric) {
            case 'steps':
                return ask('getStepCount', onDay, (results: HealthValue) => results?.value ?? 0);

            case 'walkRun':
                // Metres to kilometres.
                return ask('getDistanceWalkingRunning', { ...onDay, unit: 'meter' },
                    (results: HealthValue) => (results?.value ?? 0) / 1000);

            case 'cycling':
                return ask('getDistanceCycling', { ...onDay, unit: 'meter' },
                    (results: HealthValue) => (results?.value ?? 0) / 1000);

            case 'swimming':
                // Left in metres: a swim is counted in lengths, not kilometres.
                return ask('getDistanceSwimming', { ...onDay, unit: 'meter' },
                    (results: HealthValue) => results?.value ?? 0);

            case 'flights':
                return ask('getFlightsClimbed', onDay, (results: HealthValue) => results?.value ?? 0);

            case 'exercise':
                return ask('getAppleExerciseTime', day, (rows: any[]) => sum(rows, row => row?.value));

            case 'stand':
                return ask('getAppleStandTime', day, (rows: any[]) => sum(rows, row => row?.value));

            case 'activeEnergy':
                return ask('getActiveEnergyBurned', day, (rows: any[]) => sum(rows, row => row?.value));

            case 'workout':
                return ask('getSamples', { ...day, type: permission('Workout') ?? 'Workout' },
                    (rows: any[]) => sum(rows, row => (row?.duration ? row.duration / 60 : minutesOf(row))));

            case 'sleep':
                return this.sleep(date);

            case 'mindfulness':
                return ask('getMindfulSession', { ...day, limit: 100 },
                    (rows: any[]) => sum(rows, minutesOf));

            case 'water':
                // Litres to millilitres, which is how a glass is counted.
                return ask('getWater', { ...onDay, unit: 'liter' },
                    (results: HealthValue) => (results?.value ?? 0) * 1000);

            case 'protein':
                return ask('getProteinSamples', { ...day, limit: 200 }, (rows: any[]) => sum(rows, row => row?.value));

            case 'caffeine':
                return ask('getSamples', { ...day, type: permission('Caffeine') ?? 'Caffeine' },
                    (rows: any[]) => sum(rows, row => row?.value));

            case 'calories':
                return ask('getEnergyConsumedSamples', { ...day, limit: 200 }, (rows: any[]) => sum(rows, row => row?.value));
        }
    }

    /**
     * Last night's sleep, in minutes.
     *
     * The window runs from six in the evening the day before to six in the
     * evening of the day itself, because sleep belongs to the morning it ends
     * on — a night beginning at 23:40 is not two nights, and asking Health for
     * "today" would split it in half.
     */
    private static async sleep(date: Date): Promise<number | null> {
        const start = new Date(date);
        start.setDate(start.getDate() - 1);
        start.setHours(18, 0, 0, 0);
        const end = new Date(date);
        end.setHours(18, 0, 0, 0);

        return ask('getSleepSamples',
            { startDate: start.toISOString(), endDate: end.toISOString(), limit: 200 },
            (rows: any[]) => Math.round(sum(
                (rows ?? []).filter(row => row?.value === 'ASLEEP' || row?.value === 'INBED'),
                minutesOf,
            )));
    }

    /* ------------------------------------------------- the older callers */

    static getSteps = (date = new Date()) => HealthKitService.read('steps', date).then(value => value ?? 0);
    static getSleep = (date = new Date()) => HealthKitService.read('sleep', date).then(value => value ?? 0);
    static getMindfulness = (date = new Date()) => HealthKitService.read('mindfulness', date).then(value => value ?? 0);
    static getWorkout = (date = new Date()) => HealthKitService.read('workout', date).then(value => value ?? 0);

    /** Writes a finished focus session back, so Habyss shows up in Health too. */
    static async saveMindfulMinutes(startedAt: number, endedAt: number): Promise<boolean> {
        if (!has('saveMindfulSession')) return false;
        return new Promise(resolve => {
            AppleHealthKit.saveMindfulSession(
                { startDate: new Date(startedAt).toISOString(), endDate: new Date(endedAt).toISOString() },
                (error: unknown) => resolve(!error),
            );
        });
    }
}
