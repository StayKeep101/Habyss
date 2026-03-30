import { Platform } from 'react-native';

let AppleHealthKit: any = null;

try {
    AppleHealthKit = require('react-native-health');
} catch {
    AppleHealthKit = null;
}

const mindfulPermission = AppleHealthKit?.Constants?.Permissions?.MindfulSession ?? null;

const PERMISSIONS = mindfulPermission
    ? {
        permissions: {
            read: [mindfulPermission],
            write: [mindfulPermission],
        },
    }
    : {
        permissions: {
            read: [],
            write: [],
        },
    };

const hasMethod = (methodName: string): boolean => {
    return Platform.OS === 'ios' && !!AppleHealthKit && typeof AppleHealthKit[methodName] === 'function';
};

export const HealthKitService = {
    isAvailable: async (): Promise<boolean> => {
        if (!hasMethod('isAvailable')) return false;
        return new Promise((resolve) => {
            AppleHealthKit.isAvailable((_err: object, available: boolean) => {
                resolve(!!available);
            });
        });
    },

    requestPermissions: async (): Promise<boolean> => {
        if (!hasMethod('initHealthKit') || !mindfulPermission) return false;
        return new Promise((resolve) => {
            AppleHealthKit.initHealthKit(PERMISSIONS, (err: string | null) => {
                if (err) {
                    console.log('HealthKit Init Error:', err);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    },

    saveMindfulMinutes: async (startDate: number, endDate: number): Promise<boolean> => {
        if (!hasMethod('saveMindfulSession')) return false;

        const options = {
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
        };

        return new Promise((resolve) => {
            AppleHealthKit.saveMindfulSession(options, (err: object | null) => {
                if (err) {
                    console.log('Error saving mindful session:', err);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    }
};
