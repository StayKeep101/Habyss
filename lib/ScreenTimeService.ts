import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { ScreenTimeModule } = NativeModules;

/** Screen Time was allowed on this phone, so a "no" right after launch is iOS not having read it yet. */
const ALLOWED_KEY = 'habyss_screen_time_allowed';
let allowedKnown: boolean | null = null;
function rememberAllowed() {
    if (allowedKnown) return;
    allowedKnown = true;
    void AsyncStorage.setItem(ALLOWED_KEY, '1').catch(() => undefined);
}
async function allowedBefore(): Promise<boolean> {
    if (allowedKnown === null) allowedKnown = (await AsyncStorage.getItem(ALLOWED_KEY).catch(() => null)) === '1';
    return allowedKnown;
}
/** The last known answer, for a screen to start from without flashing "Allow". */
export const screenTimeAllowedBefore = allowedBefore;

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
            const granted = await ScreenTimeModule.requestAuthorization();
            if (granted) rememberAllowed();
            return granted;
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
        const ask = async () => { try { return !!(await ScreenTimeModule.isAuthorized()); } catch { return false; } };
        if (await ask()) { rememberAllowed(); return true; }
        // Just after launch iOS can still say "not decided" before it has read the real answer:
        // once allowed on this phone, ask again for a moment before believing a no.
        if (!(await allowedBefore())) return false;
        for (let attempt = 0; attempt < 6; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 250));
            if (await ask()) return true;
        }
        return false;
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
     * Earn your scroll (lib/appGate.ts): what the block screen says and whether
     * the chosen apps are blocked now. Kept by iOS in the App Group, so the
     * block holds while Habyss is closed.
     */
    /** This build has Earn your scroll's native part (a build from before it does not: the setting stays hidden). */
    gateSupported(): boolean {
        return Platform.OS === 'ios' && typeof ScreenTimeModule?.setGate === 'function';
    },

    setGate(state: { on: boolean; day: string; earned: boolean; remaining: string[]; planned: number; unlockedUntil: number; title?: string; lines?: string[]; primary?: string; secondary?: string }): void {
        if (Platform.OS !== 'ios' || !ScreenTimeModule?.setGate) return;
        ScreenTimeModule.setGate(JSON.stringify(state));
    },

    /** What the server says you can spend, kept for the block screen's "Use 100 Shards". */
    setWallet(spendable: number): void {
        if (Platform.OS !== 'ios' || typeof ScreenTimeModule?.setWallet !== 'function') return;
        ScreenTimeModule.setWallet(Math.max(0, Math.round(spendable)));
    },

    /** Hours bought on the block screen and not yet charged on the server (each a moment, in seconds). */
    async takePendingUnlocks(): Promise<number[]> {
        if (Platform.OS !== 'ios' || typeof ScreenTimeModule?.takePendingUnlocks !== 'function') return [];
        try { const list = await ScreenTimeModule.takePendingUnlocks(); return Array.isArray(list) ? list : []; } catch { return []; }
    },

    /** When the apps lock again after an hour bought (seconds since 1970), or 0. */
    async gateOpenUntil(): Promise<number> {
        if (Platform.OS !== 'ios' || typeof ScreenTimeModule?.gateOpenUntil !== 'function') return 0;
        try { return Number(await ScreenTimeModule.gateOpenUntil()) || 0; } catch { return 0; }
    },

    /** Lifts the block for `minutes` (already paid for); returns when it closes again, in seconds. */
    async unlockGate(minutes: number): Promise<number | null> {
        if (Platform.OS !== 'ios' || !ScreenTimeModule?.unlockGate) return null;
        try { return await ScreenTimeModule.unlockGate(minutes); } catch { return null; }
    },

    /**
     * Minutes spent in the chosen apps today, as Screen Time last told the monitor
     * extension (at 15, 30, 45, 60, 90 and 120 minutes). Null on a build without it.
     */
    /** Echo's lines for each scrolling threshold (lib/echoScroll.ts); also starts the daily watch. */
    setScrollLines(json: string): void {
        if (Platform.OS !== 'ios' || typeof ScreenTimeModule?.setScrollLines !== 'function') return;
        ScreenTimeModule.setScrollLines(json);
    },

    async scrolledToday(): Promise<number | null> {
        if (Platform.OS !== 'ios' || typeof ScreenTimeModule?.scrolledToday !== 'function') return null;
        try { const minutes = await ScreenTimeModule.scrolledToday(); return typeof minutes === 'number' && minutes > 0 ? minutes : null; } catch { return null; }
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

    /** This build checks the picker's result itself: adding is saved at once, a removal only while removing is open. */
    guardedPickerSupported(): boolean {
        return Platform.OS === 'ios' && typeof ScreenTimeModule?.presentGuardedPicker === 'function';
    },

    /**
     * The apps to block (App blocking). Adding is always free; an app taken off
     * the list stays on it unless `allowRemoval` (the hour after the 24-hour
     * wait, lib/gateLock.ts). Resolves once the picker closes:
     * 'saved', 'held' (something was taken off and kept), 'cancelled', 'denied'
     * (no Screen Time access), or 'needsWindow' on a build from before the check,
     * where the picker can only open while removing is open (or nothing is chosen yet).
     */
    async pickApps(allowRemoval: boolean): Promise<'saved' | 'held' | 'cancelled' | 'denied' | 'needsWindow'> {
        if (Platform.OS !== 'ios' || !ScreenTimeModule) return 'denied';
        const authorized = (await this.isAuthorized()) || (await this.requestAuthorization());
        if (!authorized) return 'denied';
        if (this.guardedPickerSupported()) {
            try { return await ScreenTimeModule.presentGuardedPicker(allowRemoval); } catch { return 'cancelled'; }
        }
        // A build without the check: adding must never wait, so the plain picker opens
        // (it cannot hold removals back until the next build).
        this.presentPicker();
        return 'saved';
    },

    async armShieldIfPossible(): Promise<'armed' | 'picking' | 'denied' | 'off'> {
        if (Platform.OS !== 'ios' || !ScreenTimeModule) return 'denied';
        // Focus always blocks the chosen apps (App blocking): there is no switch.

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
