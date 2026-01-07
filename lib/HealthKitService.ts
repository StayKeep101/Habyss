import AppleHealthKit, {
    HealthValue,
    HealthKitPermissions,
} from 'react-native-health';
import { Platform } from 'react-native';

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

        return new Promise((resolve, reject) => {
            AppleHealthKit.initHealthKit(PERMISSIONS, (err: string, results: any) => {
                if (err) {
                    console.error('HealthKit init error:', err);
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

        return new Promise((resolve, reject) => {
            AppleHealthKit.getStepCount(options, (err: Object, results: HealthValue) => {
                if (err) {
                    console.warn('Could not get steps:', err);
                    resolve(0);
                    return;
                }
                resolve(results.value || 0);
            });
        });
    }

    static async getSleep(date: Date = new Date()): Promise<number> {
        if (!this.isAvailable) return 0;

        // Logic to calculate total sleep minutes for a given "sleep night"
        // Usually sleep data spans across midnight, so we check a window.
        // For simplicity, let's ask for sleep samples in the last 24h ending at 'date' noon?
        // Or just standard AppleHealthKit getSleepSamples

        const options = {
            startDate: new Date(date.setHours(0, 0, 0, 0)).toISOString(),
            endDate: new Date(date.setHours(23, 59, 59, 999)).toISOString(),
        };

        return new Promise((resolve) => {
            AppleHealthKit.getSleepSamples(options, (err: Object, results: any[]) => {
                if (err) {
                    resolve(0);
                    return;
                }
                // Sum up duration of 'ASLEEP' samples
                // Note: results structure depends on library version, usually array of { value: 'ASLEEP', startDate, endDate }
                const totalMinutes = results
                    .filter(s => s.value === 'ASLEEP' || s.value === 'INBED') // Simplified
                    .reduce((acc, s) => {
                        const start = new Date(s.startDate).getTime();
                        const end = new Date(s.endDate).getTime();
                        return acc + (end - start) / 1000 / 60;
                    }, 0);

                resolve(Math.round(totalMinutes));
            });
        });
    }
}
