import AsyncStorage from '@react-native-async-storage/async-storage';
import { emit } from './appEvents';

/** Turn the phone sideways to open focus on what is due now (hooks/useTiltToFocus.ts). On unless switched off. */
const KEY = 'habyss_tilt_to_focus';

export async function tiltToFocusOn(): Promise<boolean> {
    try { return (await AsyncStorage.getItem(KEY)) !== 'off'; } catch { return true; }
}

export async function setTiltToFocus(on: boolean): Promise<void> {
    await AsyncStorage.setItem(KEY, on ? 'on' : 'off').catch(() => undefined);
    emit('tilt_to_focus_changed');
}
