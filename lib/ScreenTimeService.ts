import { Platform, NativeModules } from 'react-native';

const { ScreenTimeModule } = NativeModules;

/**
 * ScreenTimeService — Wraps native ScreenTimeModule for app blocking during focus sessions.
 * 
 * Flow:
 * 1. requestAuthorization() — Ask user for Screen Time permission (one-time)
 * 2. presentPicker() — Let user choose which apps to block
 * 3. setShieldEnabled(true/false) — Enable/disable blocking during focus sessions
 */
export const ScreenTimeService = {
    /**
     * Request Screen Time / Family Controls authorization.
     * Returns true if authorized, false if not.
     */
    async requestAuthorization(): Promise<boolean> {
        if (Platform.OS !== 'ios' || !ScreenTimeModule) return false;
        try {
            return await ScreenTimeModule.requestAuthorization();
        } catch (error) {
            console.warn('ScreenTime: Authorization failed', error);
            return false;
        }
    },

    /**
     * Check if Screen Time is currently authorized.
     */
    async isAuthorized(): Promise<boolean> {
        if (Platform.OS !== 'ios' || !ScreenTimeModule) return false;
        try {
            return await ScreenTimeModule.isAuthorized();
        } catch (error) {
            return false;
        }
    },

    /**
     * Present the native app picker to select which apps to block.
     */
    presentPicker(): void {
        if (Platform.OS !== 'ios' || !ScreenTimeModule) return;
        ScreenTimeModule.presentPicker();
    },

    /**
     * Enable or disable shields on selected apps.
     * Called by FocusTimeContext on timer start/stop.
     */
    setShieldEnabled(enabled: boolean): void {
        if (Platform.OS !== 'ios' || !ScreenTimeModule) return;
        ScreenTimeModule.setShieldEnabled(enabled);
    },

    /**
     * Check if user has selected any apps to block.
     */
    async hasSelectedApps(): Promise<boolean> {
        if (Platform.OS !== 'ios' || !ScreenTimeModule) return false;
        try {
            return await ScreenTimeModule.hasSelectedApps();
        } catch (error) {
            return false;
        }
    },
};
