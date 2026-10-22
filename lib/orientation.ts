import { Platform } from 'react-native';

/**
 * Which way up the app may be.
 *
 * An iPhone stays upright (Focus turns sideways for its clock and puts it
 * back). An iPad turns freely, as every iPad app is expected to, and has to
 * for Split View and Stage Manager. Needs a build with the module; without
 * it nothing changes.
 */
function module(): typeof import('expo-screen-orientation') | null {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
    try {
        const { requireOptionalNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core');
        if (!requireOptionalNativeModule('ExpoScreenOrientation')) return null;
        return require('expo-screen-orientation');
    } catch {
        return null;
    }
}

export const isTablet = () => Platform.OS === 'ios' && Platform.isPad;

/** The app's normal rule: free on an iPad, upright on a phone. */
export function applyDefaultOrientation(): void {
    const rotate = module();
    if (!rotate) return;
    if (isTablet()) void rotate.unlockAsync().catch(() => undefined);
    else void rotate.lockAsync(rotate.OrientationLock.PORTRAIT_UP).catch(() => undefined);
}

/** Any way round, for as long as a screen needs it (Focus's sideways clock). */
export function allowAnyOrientation(): void {
    void module()?.unlockAsync().catch(() => undefined);
}
