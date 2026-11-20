import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { HealthMetric } from './healthMetrics';
import { minutesAsleep, type SleepSample } from './sleepMath';

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

/**
 * The native module itself, and the library's constants, kept apart.
 *
 * react-native-health builds its export with `Object.assign({}, NativeModules.AppleHealthKit, …)`.
 * On React Native's new architecture the native module is a host object whose
 * methods are not plain copyable properties, so that copy came out with no
 * methods at all: every check said Health was missing and every request
 * quietly failed. Calling the native module directly works on both.
 */
const AppleHealthKit: any = Platform.OS === 'ios' ? NativeModules.AppleHealthKit ?? null : null;
let Permissions: Record<string, string> = {};
try {
    Permissions = require('react-native-health')?.Constants?.Permissions ?? {};
} catch {
    Permissions = {};
}

/** Set once the Health sheet has been answered on this phone. */
const CONNECTED_KEY = 'habyss_health_connected';
const rememberedConnected = () => AsyncStorage.getItem(CONNECTED_KEY).then(value => value === '1').catch(() => false);

const permission = (key: string): string | null => Permissions[key] ?? null;

/**
 * What the app reads from Health: sleep and the day's activity, for the
 * automatic habits (lib/healthMetrics.ts). Read-only — Habyss writes nothing.
 */
const READ = ['SleepAnalysis', 'AppleExerciseTime', 'StepCount', 'MindfulSession', 'DistanceWalkingRunning', 'FlightsClimbed', 'ActiveEnergyBurned'];
/**
 * Workouts are asked for only once a workout habit exists: Health shows its
 * sheet again for any type not yet answered, and nobody with only a step habit
 * should see one about workouts.
 */
const WORKOUTS_KEY = 'habyss_health_workouts';
let workoutsWanted: boolean | null = null;
const wantsWorkouts = async () => (workoutsWanted ??= (await AsyncStorage.getItem(WORKOUTS_KEY).catch(() => null)) === '1');
const WRITE: string[] = [];

const buildPermissions = (workouts = false) => ({
    permissions: {
        read: [...READ, ...(workouts ? ['Workout'] : [])].map(permission).filter(Boolean) as string[],
        write: WRITE.map(permission).filter(Boolean) as string[],
    },
});

const has = (method: string): boolean =>
    Platform.OS === 'ios' && !!AppleHealthKit && typeof AppleHealthKit[method] === 'function';




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
    /** The last answer of `authorised`, so a screen opens already showing it; undefined before the first. */
    static known: boolean | undefined;

    static async authorised(): Promise<boolean> {
        const answer = await this.askAuthorised();
        HealthKitService.known = answer;
        return answer;
    }

    private static async askAuthorised(): Promise<boolean> {
        if (!has('getAuthStatus')) return false;
        // iOS never says whether *reading* was allowed — for privacy, a refused
        // read looks the same as one never asked. So the app remembers that the
        // sheet was answered, and also accepts a granted write as proof.
        if (await rememberedConnected()) return true;
        return new Promise(resolve => {
            try {
                AppleHealthKit.getAuthStatus(buildPermissions(), (error: unknown, results: any) => {
                    if (error) { resolve(false); return; }
                    // 2 is "sharing authorised"; only writes can ever report it.
                    const states = [...(results?.permissions?.read ?? []), ...(results?.permissions?.write ?? [])];
                    resolve(states.some((state: number) => state === 2));
                });
            } catch {
                resolve(false);
            }
        });
    }

    /** A workout habit was added: workouts are read from now on (and asked for, once). */
    static async wantWorkouts(): Promise<boolean> {
        workoutsWanted = true;
        await AsyncStorage.setItem(WORKOUTS_KEY, '1').catch(() => undefined);
        return this.init();
    }

    static async init(): Promise<boolean> {
        if (!has('initHealthKit')) return false;
        const workouts = await wantsWorkouts();
        return new Promise(resolve => {
            AppleHealthKit.initHealthKit(buildPermissions(workouts), (error: string | null) => {
                if (error) console.warn('HealthKit init error:', error);
                else { HealthKitService.known = true; void AsyncStorage.setItem(CONNECTED_KEY, '1').catch(() => undefined); }
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
        switch (metric) {
            case 'sleep': return this.sleep(date);
            case 'steps': return this.steps(date);
            case 'exercise': return this.exerciseMinutes(date);
            case 'mindful': return this.mindfulMinutes(date);
            case 'distance': return this.distanceKm(date);
            case 'flights': return this.flights(date);
            case 'energy': return this.activeEnergy(date);
            default: {
                const { WORKOUT_KINDS } = require('./healthMetrics') as typeof import('./healthMetrics');
                const kinds = WORKOUT_KINDS[metric];
                return kinds ? this.workoutMinutes(date, kinds) : null;
            }
        }
    }

    /** The day, midnight to midnight, as Health's options want it. */
    private static dayRange(date: Date) {
        const start = new Date(date); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setDate(start.getDate() + 1);
        return { startDate: start.toISOString(), endDate: end.toISOString() };
    }

    /** Minutes of workouts on `date` of these kinds (any kind when empty), from every app that saves them. */
    static async workoutMinutes(date: Date, kinds: readonly string[]): Promise<number | null> {
        if (!(await wantsWorkouts())) return null;
        return ask('getAnchoredWorkouts', { ...this.dayRange(date), type: 'Workout' },
            (results: { data?: { activityName?: string; duration?: number; start?: string }[] }) => Math.round((results?.data ?? [])
                .filter(row => !kinds.length || kinds.includes(String(row.activityName)))
                // Counted on the day it started, so a run past midnight is not counted twice.
                .filter(row => !row.start || new Date(row.start).toDateString() === date.toDateString())
                .reduce((sum, row) => sum + Math.max(0, Number(row.duration) || 0), 0) / 60));
    }

    /** Mindful minutes on `date`, from every meditation app that saves them. */
    static async mindfulMinutes(date: Date): Promise<number | null> {
        return ask('getMindfulSession', { ...this.dayRange(date), limit: 1000 },
            (rows: { startDate: string; endDate: string }[]) => Math.round((rows ?? [])
                .reduce((sum, row) => sum + Math.max(0, Date.parse(row.endDate) - Date.parse(row.startDate)), 0) / 60000));
    }

    /** Kilometres walked or run on `date`. */
    static async distanceKm(date: Date): Promise<number | null> {
        const day = new Date(date); day.setHours(12, 0, 0, 0);
        return ask('getDistanceWalkingRunning', { date: day.toISOString(), unit: 'meter', includeManuallyAdded: true },
            (result: { value: number }) => Math.round((Number(result?.value) || 0) / 10) / 100);
    }

    /** Flights of stairs climbed on `date`. */
    static async flights(date: Date): Promise<number | null> {
        const day = new Date(date); day.setHours(12, 0, 0, 0);
        return ask('getFlightsClimbed', { date: day.toISOString(), includeManuallyAdded: true },
            (result: { value: number }) => Math.round(Number(result?.value) || 0));
    }

    /** Active calories burned on `date` (the red ring). */
    static async activeEnergy(date: Date): Promise<number | null> {
        return ask('getActiveEnergyBurned', { ...this.dayRange(date), ascending: true },
            (rows: { value: number }[]) => Math.round((rows ?? []).reduce((sum, row) => sum + (Number(row.value) || 0), 0)));
    }

    /**
     * Exercise minutes on `date` (Apple's own count: the green ring, from the
     * Watch and from workouts other apps save). Null when Health did not answer.
     */
    static async exerciseMinutes(date: Date): Promise<number | null> {
        const start = new Date(date); start.setHours(0, 0, 0, 0);
        const end = new Date(start); end.setDate(start.getDate() + 1);
        return ask('getAppleExerciseTime', { startDate: start.toISOString(), endDate: end.toISOString(), period: 1440 },
            (rows: { value: number }[]) => Math.round((rows ?? []).reduce((sum, row) => sum + (Number(row.value) || 0), 0) / 60));
    }

    /** Steps on `date`, from every source Health merges; null when it did not answer. */
    static async steps(date: Date): Promise<number | null> {
        const day = new Date(date); day.setHours(12, 0, 0, 0);
        return ask('getStepCount', { date: day.toISOString(), includeManuallyAdded: true },
            (result: { value: number }) => Math.round(Number(result?.value) || 0));
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

        // Every asleep stage, overlapping sources merged (lib/sleepMath.ts).
        return ask('getSleepSamples',
            { startDate: start.toISOString(), endDate: end.toISOString(), limit: 1000 },
            (rows: SleepSample[]) => minutesAsleep(rows));
    }
}
