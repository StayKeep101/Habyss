import { TurboModuleRegistry } from 'react-native';

/**
 * Whether this build has Skia's native side (it arrived with runtime 1.0.5).
 * Skia's own entry point throws without it, so anything drawn with Skia is
 * loaded only when this is true; older builds keep their still pictures.
 */
export const skiaReady: boolean = (() => {
    try { return !!TurboModuleRegistry.get('RNSkiaModule'); } catch { return false; }
})();
