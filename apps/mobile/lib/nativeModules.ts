import { TurboModuleRegistry } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * Whether a native module is in this build, asked without loading it.
 *
 * A build made before a library was added does not contain its native code,
 * and importing that library throws "Cannot find native module". Catching the
 * throw is not enough: it is still reported, so the user sees a red error for
 * something the app handles. Asking first keeps the app quiet, and the feature
 * simply stays hidden until the app is rebuilt.
 */

export function hasExpoModule(name: string): boolean {
    try { return !!requireOptionalNativeModule(name); } catch { return false; }
}

export function hasTurboModule(name: string): boolean {
    try { return !!TurboModuleRegistry.get(name); } catch { return false; }
}
