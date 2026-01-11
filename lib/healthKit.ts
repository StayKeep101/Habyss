import AppleHealthKit, {
    HealthValue,
    HealthKitPermissions,
} from 'react-native-health';
import { Platform } from 'react-native';

const PERMISSIONS: HealthKitPermissions = {
    permissions: {
        read: [AppleHealthKit.Constants.Permissions.MindfulSession],
        write: [AppleHealthKit.Constants.Permissions.MindfulSession],
    },
};

export const HealthKitService = {
    isAvailable: async (): Promise<boolean> => {
        if (Platform.OS !== 'ios') return false;
        return new Promise((resolve) => {
            AppleHealthKit.isAvailable((err, available) => {
                if (err) resolve(false);
                resolve(available);
            });
        });
    },

    requestPermissions: async (): Promise<boolean> => {
        if (Platform.OS !== 'ios') return false;
        return new Promise((resolve) => {
            AppleHealthKit.initHealthKit(PERMISSIONS, (err) => {
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
        if (Platform.OS !== 'ios') return false;

        const options: any = {
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
        };

        return new Promise((resolve) => {
            AppleHealthKit.saveMindfulSession(options, (err, res) => {
                if (err) {
                    console.log('Error saving mindful session:', err);
                    resolve(false);
                } else {
                    console.log('Saved mindful session:', res);
                    resolve(true);
                }
            });
        });
    }
};
