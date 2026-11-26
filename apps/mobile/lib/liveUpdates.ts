import { AppState, type AppStateStatus } from 'react-native';

/**
 * Keeps the installed app on the newest published update.
 *
 * By default a phone downloads an update on launch and only shows it on the
 * launch after that, so what was just published looked missing on the phone
 * while the simulator already had it. This checks on launch and every time the
 * app comes back to the front, and reloads into the new version as soon as it
 * has downloaded. Off in development, where the code comes from Metro.
 */
let checking = false;

async function applyNewest(): Promise<void> {
    if (__DEV__ || checking) return;
    let Updates: typeof import('expo-updates');
    try { Updates = require('expo-updates'); } catch { return; }
    if (!Updates.isEnabled) return;
    checking = true;
    try {
        const check = await Updates.checkForUpdateAsync();
        if (!check.isAvailable) return;
        const fetched = await Updates.fetchUpdateAsync();
        if (fetched.isNew) await Updates.reloadAsync();
    } catch {
        // Offline or the server is unreachable: keep running what is installed.
    } finally {
        checking = false;
    }
}

export function watchForUpdates(): () => void {
    void applyNewest();
    let last: AppStateStatus = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
        if (last !== 'active' && next === 'active') void applyNewest();
        last = next;
    });
    return () => subscription.remove();
}
