import { Platform } from 'react-native';

type HealthValue = { value?: number };
type HealthKitPermissions = {
    permissions: {
        read: string[];
        write: string[];
    };
};

let AppleHealthKit: any = null;

try {
    AppleHealthKit = require('react-native-health');
} catch {
    AppleHealthKit = null;
}

const getPermission = (key: string): string | null => {
    return AppleHealthKit?.Constants?.Permissions?.[key] ?? null;
};

const buildPermissions = (): HealthKitPermissions => {
    const read = [
        getPermission('Steps'),
        getPermission('SleepAnalysis'),
        getPermission('Workout'),
        getPermission('MindfulSession'),
    ].filter(Boolean) as string[];

    const write = [
        getPermission('Workout'),
        getPermission('MindfulSession'),
    ].filter(Boolean) as string[];

    return { permissions: { read, write } };
};

const hasNativeMethod = (methodName: string): boolean => {
    return Platform.OS === 'ios' && !!AppleHealthKit && typeof AppleHealthKit[methodName] === 'function';
};

export class HealthKitService {
    static get isAvailable(): boolean {
        return Platform.OS === 'ios' && !!AppleHealthKit;
    }

    static async init(): Promise<boolean> {
        if (!hasNativeMethod('initHealthKit')) return false;

        return new Promise((resolve) => {
            AppleHealthKit.initHealthKit(buildPermissions(), (err: string | null) => {
                if (err) {
                    console.warn('HealthKit init error:', err);
                    resolve(false);
                    return;
                }
                resolve(true);
            });
        });
    }

    static async getSteps(date: Date = new Date()): Promise<number> {
        if (!hasNativeMethod('getStepCount')) return 0;

        const options = {
            date: date.toISOString(),
            includeManuallyAdded: true,
        };

        return new Promise((resolve) => {
            AppleHealthKit.getStepCount(options, (_err: object, results: HealthValue) => {
                resolve(results?.value || 0);
            });
        });
    }

    static async getSleep(date: Date = new Date()): Promise<number> {
        if (!hasNativeMethod('getSleepSamples')) return 0;

        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);

        const queryStart = new Date(startDate);
        queryStart.setDate(queryStart.getDate() - 1);
        queryStart.setHours(18, 0, 0, 0);

        const queryEnd = new Date(startDate);
        queryEnd.setHours(18, 0, 0, 0);

        const options = {
            startDate: queryStart.toISOString(),
            endDate: queryEnd.toISOString(),
            limit: 100,
        };

        return new Promise((resolve) => {
            AppleHealthKit.getSleepSamples(options, (_err: object, results: any[] = []) => {
                const totalMinutes = results
                    .filter((sample) => sample?.value === 'ASLEEP' || sample?.value === 'INBED')
                    .reduce((acc, sample) => {
                        const start = new Date(sample.startDate).getTime();
                        const end = new Date(sample.endDate).getTime();
                        return acc + (end - start) / 1000 / 60;
                    }, 0);

                resolve(Math.round(totalMinutes));
            });
        });
    }

    static async getMindfulness(date: Date = new Date()): Promise<number> {
        if (!hasNativeMethod('getMindfulSession')) return 0;

        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        const options = {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            limit: 100,
        };

        return new Promise((resolve) => {
            AppleHealthKit.getMindfulSession(options, (_err: object, results: any[] = []) => {
                const totalMinutes = results.reduce((acc, sample) => {
                    const start = new Date(sample.startDate).getTime();
                    const end = new Date(sample.endDate).getTime();
                    return acc + (end - start) / 1000 / 60;
                }, 0);
                resolve(Math.round(totalMinutes));
            });
        });
    }

    static async getWorkout(date: Date = new Date()): Promise<number> {
        if (!hasNativeMethod('getSamples')) return 0;

        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        const options = {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            input: '',
            type: getPermission('Workout') || 'Workout',
        };

        return new Promise((resolve) => {
            AppleHealthKit.getSamples(options, (_err: object, results: any[] = []) => {
                const totalMinutes = results.reduce((acc, sample) => {
                    const duration = sample?.duration || 0;
                    return acc + duration / 60;
                }, 0);
                resolve(Math.round(totalMinutes));
            });
        });
    }
}
