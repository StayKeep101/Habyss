import AsyncStorage from '@react-native-async-storage/async-storage';
import { emit } from './appEvents';
import { PERSONALITY_MODES, type PersonalityModeId } from '@/constants/AIPersonalities';
import { PROFILE_NICKNAME_KEY } from './localUser';

/**
 * Echo: the voice of Habyss. It writes the line on the home screen and the
 * reminder notifications, in the personality the user picked. This file holds
 * what Echo needs to know about the user outside React: their name, their
 * chosen voice, and when their day starts and ends.
 */

export const ECHO_NAME = 'Echo';

const SETTINGS_KEY = 'app_settings';
const DAY_KEY = 'habyss_day_window';

export interface DayWindow {
    /** "HH:MM", local time. */
    wake: string;
    sleep: string;
}

export const DEFAULT_DAY: DayWindow = { wake: '07:00', sleep: '23:00' };
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function getDayWindow(): Promise<DayWindow> {
    try {
        const stored = JSON.parse((await AsyncStorage.getItem(DAY_KEY)) ?? 'null');
        if (stored && TIME.test(stored.wake) && TIME.test(stored.sleep)) return stored;
    } catch { /* fall through to the default */ }
    return DEFAULT_DAY;
}

export async function saveDayWindow(day: DayWindow): Promise<void> {
    if (!TIME.test(day.wake) || !TIME.test(day.sleep)) return;
    await AsyncStorage.setItem(DAY_KEY, JSON.stringify(day));
}

export const minutesOf = (time: string): number => {
    const [hour, minute] = time.split(':').map(Number);
    return hour * 60 + minute;
};

export const timeOf = (minutes: number): string => {
    const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
    return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`;
};

/**
 * The reminder time Habyss suggests: half an hour after waking, so it lands
 * once the day has started rather than at an arbitrary 8:00. If that would
 * fall after bedtime (a very short day), it is the wake time itself.
 */
export function suggestedReminder(day: DayWindow): string {
    const wake = minutesOf(day.wake);
    let sleep = minutesOf(day.sleep);
    if (sleep <= wake) sleep += 1440;
    return timeOf(wake + 30 < sleep ? wake + 30 : wake);
}

/** Awake hours between two times, across midnight if bedtime is after it. */
export function hoursAwake(day: DayWindow): number {
    let span = minutesOf(day.sleep) - minutesOf(day.wake);
    if (span <= 0) span += 1440;
    return Math.round((span / 60) * 10) / 10;
}

export async function getName(): Promise<string | undefined> {
    const name = (await AsyncStorage.getItem(PROFILE_NICKNAME_KEY).catch(() => null))?.trim();
    return name || undefined;
}

export async function saveName(name: string): Promise<void> {
    const trimmed = name.trim().slice(0, 40);
    if (trimmed) await AsyncStorage.setItem(PROFILE_NICKNAME_KEY, trimmed);
}

/** The voice the user picked in onboarding or Settings. */
export async function getEchoPersonality(): Promise<PersonalityModeId> {
    try {
        const stored = JSON.parse((await AsyncStorage.getItem(SETTINGS_KEY)) ?? '{}')?.aiPersonality;
        if (PERSONALITY_MODES.some(mode => mode.id === stored)) return stored;
    } catch { /* default below */ }
    // Matches the app's own default in AppSettingsContext.
    return 'friendly';
}

/* -------------------------------------------------------------------------- */
/*  What Echo is allowed to do                                                 */
/* -------------------------------------------------------------------------- */

export interface EchoConfig {
    /** Opt-in advance encouragement for timed habits and tasks. */
    alive?: boolean;
    /** At most one check-in after the planned session, if still unfinished. */
    aliveFollowUp?: boolean;
    /** A nudge shortly after waking, with what the day asks of you. */
    morning: boolean;
    /** A nudge before bed, with whatever is still open. */
    evening: boolean;
    /** Use the user's name in what Echo writes. */
    useName: boolean;
    /**
     * Let the on-device model write the reminder wording, rather than the
     * built-in line bank. Off until the user asks, since it only works once a
     * model is on the phone.
     */
    writeReminders: boolean;
}

export const DEFAULT_ECHO: EchoConfig = { morning: false, evening: false, useName: true, writeReminders: false, alive: false, aliveFollowUp: true };

const ECHO_KEY = 'habyss_echo_config';

export async function getEchoConfig(): Promise<EchoConfig> {
    try {
        const stored = JSON.parse((await AsyncStorage.getItem(ECHO_KEY)) ?? 'null');
        if (stored && typeof stored === 'object') return { ...DEFAULT_ECHO, ...stored };
    } catch { /* fall through to the defaults */ }
    return DEFAULT_ECHO;
}

export async function saveEchoConfig(config: EchoConfig): Promise<void> {
    await AsyncStorage.setItem(ECHO_KEY, JSON.stringify(config));
    emit('engagement_settings_changed');
}

/** When the morning check-in lands: shortly after they said they wake. */
export const morningCheckIn = (day: DayWindow): string => suggestedReminder(day);

/** When the evening check-in lands: an hour before they said they sleep. */
export function eveningCheckIn(day: DayWindow): string {
    const sleep = minutesOf(day.sleep);
    const wake = minutesOf(day.wake);
    const before = sleep - 60;
    // Never before they are awake, on a very short day.
    return timeOf(before > wake ? before : Math.max(wake + 30, sleep - 15));
}
