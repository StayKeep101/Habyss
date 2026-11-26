import AsyncStorage from '@react-native-async-storage/async-storage';
import { emit } from './appEvents';
// Shared with the Mac: packages/core/src/dailyFocus.ts (the rules). What stays here is the phone's own part.
import { DEFAULT_TARGET, type DailyTarget } from '@habyss/core/dailyFocus';
export * from '@habyss/core/dailyFocus';

const KEY = 'habyss_daily_focus_target';
/** Fired when the target changes, so open screens follow it. */
export const TARGET_CHANGED = 'daily_focus_target_changed';

export async function getDailyTarget(): Promise<DailyTarget> {
    try {
        const stored = Number(await AsyncStorage.getItem(KEY));
        return stored === 5 ? 5 : DEFAULT_TARGET;
    } catch {
        return DEFAULT_TARGET;
    }
}

export async function saveDailyTarget(target: DailyTarget): Promise<void> {
    try {
        await AsyncStorage.setItem(KEY, String(target));
    } catch {
        // The target is a preference; failing to store it is not worth an error.
    }
    emit(TARGET_CHANGED, target);
}
