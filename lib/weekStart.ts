import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from './habitSchedule';

/**
 * Which day a week starts on, as the person likes it (Settings → Your plan).
 * Monday by default. The brain dump clears when a new week starts.
 */
export type WeekStart = 'sunday' | 'monday';

const KEY = 'habyss_week_start';
export const DEFAULT_WEEK_START: WeekStart = 'monday';

export async function getWeekStart(): Promise<WeekStart> {
    try {
        const stored = await AsyncStorage.getItem(KEY);
        return stored === 'sunday' || stored === 'monday' ? stored : DEFAULT_WEEK_START;
    } catch {
        return DEFAULT_WEEK_START;
    }
}

export async function setWeekStart(start: WeekStart): Promise<void> {
    await AsyncStorage.setItem(KEY, start).catch(() => undefined);
}

/** Midnight at the start of the week `date` is in. */
export function startOfWeek(date: Date, start: WeekStart): Date {
    const first = start === 'sunday' ? 0 : 1;
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const back = (day.getDay() - first + 7) % 7;
    day.setDate(day.getDate() - back);
    return day;
}

/** 7 pm on the last day of the week `date` is in: when the brain dump review is due. */
export function reviewTime(date: Date, start: WeekStart): Date {
    const last = startOfWeek(date, start);
    last.setDate(last.getDate() + 6);
    last.setHours(19, 0, 0, 0);
    return last;
}

export const weekKey = (date: Date, start: WeekStart): string => localDateKey(startOfWeek(date, start));
