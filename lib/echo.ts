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

/** How Echo carries itself (components/ui/Echo.tsx): what it is doing, never what it says. */
export type EchoMood = 'appear' | 'idle' | 'listen' | 'speak' | 'curious' | 'think' | 'empathetic' | 'excited' | 'encourage' | 'celebrate';

export interface DayWindow {
    /** "HH:MM", local time. */
    wake: string;
    sleep: string;
}

export const DEFAULT_DAY: DayWindow = { wake: '07:00', sleep: '23:00' };
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * One copy, read once and kept: every screen that shows your day starts from
 * what you saved, never from the default for a moment (which used to flash
 * 07:00–23:00, and a tap in that moment saved the default over your times).
 */
let dayCache: DayWindow | null = null;
export const cachedDayWindow = (): DayWindow | null => dayCache;

export async function getDayWindow(): Promise<DayWindow> {
    if (dayCache) return dayCache;
    try {
        const stored = JSON.parse((await AsyncStorage.getItem(DAY_KEY)) ?? 'null');
        if (stored && TIME.test(stored.wake) && TIME.test(stored.sleep)) { const day: DayWindow = { wake: stored.wake, sleep: stored.sleep }; dayCache = day; return day; }
    } catch { /* fall through to the default */ }
    return DEFAULT_DAY;
}

/**
 * Changes one end of the day and keeps the other exactly as saved: a screen
 * that had not read your day yet used to send the default with it, so
 * moving your wake time quietly put bedtime back to 11 PM.
 */
export async function updateDayWindow(patch: Partial<DayWindow>): Promise<DayWindow> {
    const next = { ...(await getDayWindow()), ...patch };
    await saveDayWindow(next);
    return dayCache ?? next;
}

/** A restore wrote the stored day: read it again rather than keep the old copy. */
export function forgetDayWindow(): void {
    dayCache = null;
}

export async function saveDayWindow(day: DayWindow): Promise<void> {
    if (!TIME.test(day.wake) || !TIME.test(day.sleep)) return;
    dayCache = { wake: day.wake, sleep: day.sleep };
    await AsyncStorage.setItem(DAY_KEY, JSON.stringify(dayCache));
    // The morning alarm rings at wake time, so it moves with it.
    void (require('./morningAlarm') as typeof import('./morningAlarm')).syncMorningAlarm().catch(() => undefined);
    // So does the Bedtime lock's night.
    void (require('./bedtimeLock') as typeof import('./bedtimeLock')).syncBedtime().catch(() => undefined);
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
    /** Halfway through the day: a recap of it so far, at the middle of the waking hours (lib/middayRecap.ts). On unless turned off. */
    midday?: boolean;
    /** The weekly review notification on the week's last evening. On unless turned off. */
    weeklyReview?: boolean;
    /**
     * Falling far behind on tasks turns Echo into demon mode: the edge of the
     * screen goes red and Echo goes at you (lib/taskPressure.ts). On unless
     * turned off.
     */
    demonMode?: boolean;
    /** A real alarm at wake time with Echo's line (AlarmKit, iOS 26+; lib/morningAlarm.ts). Off unless turned on. */
    morningAlarm?: boolean;
    /**
     * Smarter Echo: a few times a day (opening Habyss in the morning and
     * evening, and replying to your answer), Echo's line is written by Claude
     * on Habyss's server from a short summary of today (lib/echoCloud.ts).
     * Off unless turned on, after being told what is sent.
     */
    cloudVoice?: boolean;
}

export const DEFAULT_ECHO: EchoConfig = { morning: false, evening: false, useName: true, writeReminders: false, alive: false, aliveFollowUp: true, weeklyReview: true };

const ECHO_KEY = 'habyss_echo_config';

/** Echo's settings, one copy kept once read (see the day window above). */
let echoCache: EchoConfig | null = null;
export const cachedEchoConfig = (): EchoConfig | null => echoCache;

export async function getEchoConfig(): Promise<EchoConfig> {
    if (echoCache) return echoCache;
    try {
        const stored = JSON.parse((await AsyncStorage.getItem(ECHO_KEY)) ?? 'null');
        if (stored && typeof stored === 'object') { const config: EchoConfig = { ...DEFAULT_ECHO, ...stored }; echoCache = config; return config; }
    } catch { /* fall through to the defaults */ }
    return DEFAULT_ECHO;
}

export async function saveEchoConfig(config: EchoConfig): Promise<void> {
    echoCache = config;
    await AsyncStorage.setItem(ECHO_KEY, JSON.stringify(config));
    emit('engagement_settings_changed');
}

/** Changes only the settings named, on top of what is stored, never on top of defaults. */
export async function updateEchoConfig(patch: Partial<EchoConfig>): Promise<EchoConfig> {
    const next = { ...(await getEchoConfig()), ...patch };
    await saveEchoConfig(next);
    return next;
}

/** Read at launch, so the settings screens open on your values straight away. */
export function warmEchoSettings(): void {
    void getDayWindow();
    void getEchoConfig();
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
