import AppleHealthKit, {
    HealthValue,
    HealthKitPermissions,
} from 'react-native-health';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';

const PERMISSIONS: HealthKitPermissions = {
    permissions: {
        read: [
            AppleHealthKit.Constants.Permissions.Steps,
            AppleHealthKit.Constants.Permissions.SleepAnalysis,
            AppleHealthKit.Constants.Permissions.Workout,
            AppleHealthKit.Constants.Permissions.MindfulSession,
        ],
        write: [
            AppleHealthKit.Constants.Permissions.Workout,
            AppleHealthKit.Constants.Permissions.MindfulSession,
        ],
    },
};

export class HealthKitService {
    static isAvailable = Platform.OS === 'ios';

    static async init(): Promise<boolean> {
        if (!this.isAvailable) return false;

        return new Promise((resolve) => {
            AppleHealthKit.initHealthKit(PERMISSIONS, (err: string, results: any) => {
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
        if (!this.isAvailable) return 0;

        const options = {
            date: date.toISOString(),
            includeManuallyAdded: true,
        };

        return new Promise((resolve) => {
            AppleHealthKit.getStepCount(options, (err: Object, results: HealthValue) => {
                if (err) {
                    // console.warn('Could not get steps:', err);
                    resolve(0);
                    return;
                }
                resolve(results.value || 0);
            });
        });
    }

    static async getSleep(date: Date = new Date()): Promise<number> {
        if (!this.isAvailable) return 0;

        // Fetch sleep for the 24h window ending at 'date' end-of-day
        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        // Look back 24 hours from start of today to catch last night's sleep? 
        // Or usually sleep is attributed to the day you woke up.
        // Let's query from yesterday 6pm to today 6pm to catch the "night".
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
            AppleHealthKit.getSleepSamples(options, (err: Object, results: any[]) => {
                if (err) {
                    resolve(0);
                    return;
                }

                // Filter for ASLEEP samples
                const totalMinutes = results
                    .filter(s => s.value === 'ASLEEP' || s.value === 'INBED')
                    .reduce((acc, s) => {
                        const start = new Date(s.startDate).getTime();
                        const end = new Date(s.endDate).getTime();
                        return acc + (end - start) / 1000 / 60;
                    }, 0);

                resolve(Math.round(totalMinutes));
            });
        });
    }
    static async getMindfulness(date: Date = new Date()): Promise<number> {
        if (!this.isAvailable) return 0;

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
            AppleHealthKit.getMindfulSession(options, (err: Object, results: any[]) => {
                if (err) {
                    resolve(0);
                    return;
                }
                const totalMinutes = results.reduce((acc, s) => {
                    const start = new Date(s.startDate).getTime();
                    const end = new Date(s.endDate).getTime();
                    return acc + (end - start) / 1000 / 60;
                }, 0);
                resolve(Math.round(totalMinutes));
            });
        });
    }

    static async getWorkout(date: Date = new Date()): Promise<number> {
        if (!this.isAvailable) return 0;

        const startDate = new Date(date);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);

        const options = {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            input: '', // Empty string required for type?
            type: AppleHealthKit.Constants.Permissions.Workout,
        } as any; // Cast because type defs might differ

        return new Promise((resolve) => {
            // Note: getSamples is generic, often used for workouts if getWorkout is not explicitly available or behaves differently
            AppleHealthKit.getSamples(options, (err: Object, results: any[]) => {
                if (err) {
                    resolve(0);
                    return;
                }
                // Filter for workout type if needed, but we requested Workout permission type
                const totalMinutes = results.reduce((acc, s) => {
                    const duration = s.duration || 0; // Duration in minutes directly? or seconds?
                    // Usually duration is in seconds or minutes depending on lib version. 
                    // react-native-health usually returns duration in seconds for workouts.
                    return acc + (duration / 60);
                }, 0);
                resolve(Math.round(totalMinutes));
            });
        });
    }
}

/**
 * Hook to automatically sync HealthKit data
 */
export function useHealthKit() {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [steps, setSteps] = useState(0);
    const [sleepMinutes, setSleepMinutes] = useState(0);

    const refreshData = async () => {
        if (!HealthKitService.isAvailable) return;

        // Ensure auth
        if (!isAuthorized) {
            const auth = await HealthKitService.init();
            setIsAuthorized(auth);
            if (!auth) return;
        }

        const [s, sl] = await Promise.all([
            HealthKitService.getSteps(),
            HealthKitService.getSleep()
        ]);
        setSteps(s);
        setSleepMinutes(sl);
    };

    useEffect(() => {
        // Initial fetch
        refreshData();

        // Poll every 5 minutes
        const interval = setInterval(refreshData, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [isAuthorized]);

    return {
        isAuthorized,
        steps,
        sleepMinutes,
        refreshData
    };
}
