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

    /**
     * Turns blocking on for a focus session. Asks iOS for Screen Time access
     * the first time (the system prompt, like Health or Location), and opens
     * the app picker when nothing is chosen yet: the shield goes up the moment
     * the picker's Done is tapped.
     *
     * 'armed' when apps are blocked now, 'picking' while the picker is open,
     * 'denied' when Screen Time access was refused or is not available.
     */
    /**
     * Puts the shield back up for a session the app was relaunched into,
     * without asking anything: only when access is already given and apps are
     * already chosen.
     */
    async rearmShield(): Promise<boolean> {
        if (Platform.OS !== 'ios' || !ScreenTimeModule) return false;
        try {
            if (!(await this.isAuthorized()) || !(await this.hasSelectedApps())) return false;
            this.setShieldEnabled(true);
            return true;
        } catch {
            return false;
        }
    },

    /** Choosing the apps to block, from Settings: asks for access first if needed. */
    async chooseApps(): Promise<boolean> {
        if (Platform.OS !== 'ios' || !ScreenTimeModule) return false;
        const authorized = (await this.isAuthorized()) || (await this.requestAuthorization());
        if (!authorized) return false;
        this.presentPicker();
        return true;
    },

    async armShieldIfPossible(): Promise<'armed' | 'picking' | 'denied'> {
        if (Platform.OS !== 'ios' || !ScreenTimeModule) return 'denied';

        try {
            const authorized = (await this.isAuthorized()) || (await this.requestAuthorization());
            if (!authorized) return 'denied';

            // Wanted before picking, so Done in the picker raises the shield.
            this.setShieldEnabled(true);
            if (!(await this.hasSelectedApps())) {
                this.presentPicker();
                return 'picking';
            }
            return 'armed';
        } catch (error) {
            console.warn('ScreenTime: Failed to arm shield', error);
            return 'denied';
        }
    },
};
