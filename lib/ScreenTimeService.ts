import { NativeModules } from 'react-native';

const { ScreenTimeModule } = NativeModules;

export interface ScreenTimeInterface {
    requestAuthorization: () => Promise<boolean>;
    presentPicker: () => void;
    setShieldEnabled: (enabled: boolean) => void;
}

export const ScreenTimeService: ScreenTimeInterface = {
    requestAuthorization: async () => {
        try {
            if (!ScreenTimeModule) return false;
            return await ScreenTimeModule.requestAuthorization();
        } catch (e) {
            console.error("Screen Time Auth Error:", e);
            return false;
        }
    },

    presentPicker: () => {
        if (ScreenTimeModule) {
            ScreenTimeModule.presentPicker();
        }
    },

    setShieldEnabled: (enabled: boolean) => {
        if (ScreenTimeModule) {
            ScreenTimeModule.setShieldEnabled(enabled);
        }
    }
};
