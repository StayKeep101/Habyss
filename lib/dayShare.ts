import AsyncStorage from '@react-native-async-storage/async-storage';
import { emit } from './appEvents';

/** How much of the free waking day the timeline plans (lib/dayCapacity.ts): Settings → Day & calendar. */
export type DayShare = 0.6 | 0.7 | 0.8 | 1;
export const DAY_SHARES: DayShare[] = [0.6, 0.7, 0.8, 1];
export const DEFAULT_SHARE: DayShare = 0.7;
export const SHARE_CHANGED = 'day_share_changed';
const KEY = 'habyss_day_share';

let cached: DayShare | null = null;
export const cachedDayShare = (): DayShare => cached ?? DEFAULT_SHARE;

export async function getDayShare(): Promise<DayShare> {
    try {
        const raw = Number(await AsyncStorage.getItem(KEY));
        cached = (DAY_SHARES as number[]).includes(raw) ? (raw as DayShare) : DEFAULT_SHARE;
    } catch { cached = DEFAULT_SHARE; }
    return cached;
}

export async function setDayShare(share: DayShare): Promise<void> {
    cached = share;
    emit(SHARE_CHANGED, share);
    await AsyncStorage.setItem(KEY, String(share)).catch(() => undefined);
}


