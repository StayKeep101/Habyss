import { useCallback, useEffect } from 'react';
import { useAppSettings } from '@/context/AppSettingsContext';
import { playSound, preloadSound } from '@/lib/soundService';

/**
 * The interface's sounds, by kind of control (lib/soundService.ts maps each kind
 * to its file and volume, so changing one there changes every control of that kind).
 *
 *   tap         a button (silent: no file mapped)
 *   select      a choice: a switch, a chip, a tab, a menu item (silent: no file mapped)
 *   open        a window appearing over the page: a sheet, a popup, a menu (the whoosh)
 *   transition  a whole new place: entering Focus (the whoosh)
 *
 * Silent when Sound is off (Settings → Appearance) or the ringer is on Silent.
 */
export type UISound = 'tap' | 'select' | 'open' | 'transition';

export function useUISound(kind?: UISound): (sound?: UISound) => void {
    let soundsEnabled = true;
    try {
        soundsEnabled = useAppSettings().soundsEnabled;
    } catch {
        // Outside the settings (a screen before the app is set up): on, like the setting's default.
    }
    // Ready before the first press, so it is never late or silent.
    useEffect(() => { if (kind && soundsEnabled) void preloadSound(kind); }, [kind, soundsEnabled]);
    return useCallback((sound?: UISound) => {
        const effect = sound ?? kind;
        if (!soundsEnabled || !effect) return;
        void playSound(effect);
    }, [kind, soundsEnabled]);
}
