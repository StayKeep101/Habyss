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
 * The one thing the app asks Health for: sleep. Read-only — Habyss writes
 * nothing into Health.
 */
const READ = ['SleepAnalysis'];
const WRITE: string[] = [];

const buildPermissions = () => ({
    permissions: {
        read: READ.map(permission).filter(Boolean) as string[],
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
    static async authorised(): Promise<boolean> {
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

    static async init(): Promise<boolean> {
        if (!has('initHealthKit')) return false;
        return new Promise(resolve => {
            AppleHealthKit.initHealthKit(buildPermissions(), (error: string | null) => {
                if (error) console.warn('HealthKit init error:', error);
                else void AsyncStorage.setItem(CONNECTED_KEY, '1').catch(() => undefined);
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
        return metric === 'sleep' ? this.sleep(date) : null;
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
