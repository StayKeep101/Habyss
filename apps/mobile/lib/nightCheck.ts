import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The morning's look back at the night (components/Echo/MorningPopup.tsx):
 * asked once, the first time the app opens in the morning; whether the phone
 * came to bed (0 no, 1 a little, 2 a lot), kept by the morning it was asked,
 * for Echo to see what late screens do to the next day. On this phone only.
 */
export type PhoneInBed = 0 | 1 | 2;
export const PHONE_IN_BED = ['No', 'A little', 'A lot'] as const;

const KEY = 'habyss_night_checks';
const ASKED = 'habyss_night_asked';
const KEEP_DAYS = 120;
/** A morning, for asking: from 4 am until noon. */
const MORNING = { from: 4 * 60, until: 12 * 60 };

export function isMorning(now: Date): boolean {
    const minutes = now.getHours() * 60 + now.getMinutes();
    return minutes >= MORNING.from && minutes < MORNING.until;
}

/** Whether to ask now: a morning, and not asked yet today. */
export async function shouldAskNight(now: Date, day: string): Promise<boolean> {
    if (!isMorning(now)) return false;
    try { return (await AsyncStorage.getItem(ASKED)) !== day; } catch { return false; }
}

/** Asked (answered or not): not again until tomorrow morning. */
export async function markNightAsked(day: string): Promise<void> {
    await AsyncStorage.setItem(ASKED, day).catch(() => undefined);
}

export async function nightChecks(): Promise<Record<string, PhoneInBed>> {
    try { return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') as Record<string, PhoneInBed>; } catch { return {}; }
}

export async function savePhoneInBed(day: string, value: PhoneInBed): Promise<void> {
    const all = await nightChecks();
    all[day] = value;
    const floor = new Date(`${day}T12:00:00`);
    floor.setDate(floor.getDate() - KEEP_DAYS);
    const oldest = `${floor.getFullYear()}-${String(floor.getMonth() + 1).padStart(2, '0')}-${String(floor.getDate()).padStart(2, '0')}`;
    for (const key of Object.keys(all)) if (key < oldest) delete all[key];
    await AsyncStorage.setItem(KEY, JSON.stringify(all)).catch(() => undefined);
}
