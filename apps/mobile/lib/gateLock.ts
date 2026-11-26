import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Removing a blocked app waits (App blocking). Adding one, or blocking more, is
 * always free: only loosening the block asks for patience. You ask; 24 hours
 * later you get one hour to remove apps (or turn the bedtime block off), and
 * then it locks again by itself. The craving passes long before then; a real
 * reason to change it does not. The request can be taken back at any time.
 */

/** How long a request to remove takes. */
export const UNLOCK_WAIT_MS = 24 * 3600_000;
/** How long removing stays open once the wait is over. */
export const UNLOCK_OPEN_MS = 3600_000;

const KEY = 'habyss_gate_unlock_asked';
const NOTICE_ID = 'habyss-gate-removal-open';

export type LockState =
    | { kind: 'locked' }
    | { kind: 'waiting'; opensAt: number }
    | { kind: 'open'; closesAt: number };

/** Where the lock stands, from when removing was asked (or null). Past the hour, locked again. */
export function lockState(askedAt: number | null, now: number): LockState {
    if (askedAt == null || !Number.isFinite(askedAt)) return { kind: 'locked' };
    const opensAt = askedAt + UNLOCK_WAIT_MS;
    if (now < opensAt) return { kind: 'waiting', opensAt };
    const closesAt = opensAt + UNLOCK_OPEN_MS;
    if (now < closesAt) return { kind: 'open', closesAt };
    return { kind: 'locked' };
}

/** "23h 12m", "54 min": how long until a moment, for the row that shows it. */
export function timeLeft(at: number, now: number = Date.now()): string {
    const minutes = Math.max(1, Math.ceil((at - now) / 60_000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
}

async function askedAt(): Promise<number | null> {
    try {
        const stored = await AsyncStorage.getItem(KEY);
        const value = stored == null ? NaN : Number(stored);
        return Number.isFinite(value) ? value : null;
    } catch { return null; }
}

export async function currentLock(now = Date.now()): Promise<LockState> {
    return lockState(await askedAt(), now);
}

/** Starts the wait, and a notification for when removing opens. Asking again while waiting or open changes nothing. */
export async function askToUnlock(now = Date.now()): Promise<LockState> {
    const state = await currentLock(now);
    if (state.kind !== 'locked') return state;
    await AsyncStorage.setItem(KEY, String(now)).catch(() => undefined);
    const opensAt = now + UNLOCK_WAIT_MS;
    try {
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        await Notifications.scheduleNotificationAsync({
            identifier: NOTICE_ID,
            content: { title: 'You can remove apps now', body: 'For the next hour, in App blocking. Then it locks again.',
                sound: 'default', data: { kind: 'gate-removal', url: '/(root)/app-blocking' } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(opensAt), channelId: 'default' },
        });
    } catch { /* the page still shows when it opens */ }
    return { kind: 'waiting', opensAt };
}

/** Takes the request back, or locks again early. */
export async function relock(): Promise<void> {
    await AsyncStorage.removeItem(KEY).catch(() => undefined);
    try {
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        await Notifications.cancelScheduledNotificationAsync(NOTICE_ID);
    } catch { /* nothing booked */ }
}
