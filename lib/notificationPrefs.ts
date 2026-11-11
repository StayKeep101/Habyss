import AsyncStorage from '@react-native-async-storage/async-storage';
import { emit } from './appEvents';

/**
 * Which of the social notices somebody actually wants.
 *
 * Separate from the reminder settings on purpose: a reminder is the app talking
 * to you about your own day, and these are other people arriving in it. Turning
 * one off should never turn the other off.
 *
 * Everything starts on. A social feature nobody is ever notified about is a
 * social feature nobody discovers, and each of these is the direct consequence
 * of something the person themselves set up.
 */

export interface NotificationPrefs {
    /** A friend finished a habit or task you share with them. */
    sharedDone: boolean;
    /** Somebody offers you a habit, task or goal. */
    shareOffers: boolean;
    /** Somebody reacts to your day or leaves a note on it. */
    reactions: boolean;
    /** Friend requests, and their answers. */
    friendRequests: boolean;
    /** Guided through the day: what is on now, what is next, meals and events (lib/dayGuide.ts). */
    dayGuide: boolean;
    /** Leave now and Start now ring as alarms, through Silent and on the Watch (iOS 26+). */
    alarms: boolean;
    /** The day's notifications are said in Echo's voice (lib/echoSounds.ts), not the plain sound. */
    echoVoice: boolean;
}

export const DEFAULT_PREFS: NotificationPrefs = {
    sharedDone: true,
    shareOffers: true,
    reactions: true,
    friendRequests: true,
    dayGuide: true,
    alarms: true,
    echoVoice: true,
};

export const PREF_LABELS: { id: Exclude<keyof NotificationPrefs, 'dayGuide' | 'alarms' | 'echoVoice'>; label: string; detail: string }[] = [
    { id: 'sharedDone', label: 'A friend finishes', detail: 'When somebody completes their half of something you share' },
    { id: 'shareOffers', label: 'Shared with you', detail: 'When a friend offers you a habit, task or goal' },
    { id: 'reactions', label: 'Reactions and notes', detail: 'When somebody responds to your day' },
    { id: 'friendRequests', label: 'Friend requests', detail: 'When somebody asks to be friends, or answers you' },
];

const KEY = 'habyss_notification_prefs';

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
    try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        // Merged rather than trusted, so a preference added later is on by
        // default instead of arriving as `undefined` and reading as off.
        return parsed && typeof parsed === 'object' ? { ...DEFAULT_PREFS, ...parsed } : DEFAULT_PREFS;
    } catch {
        return DEFAULT_PREFS;
    }
}

export async function setNotificationPrefs(changes: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
    const next = { ...(await getNotificationPrefs()), ...changes };
    try {
        await AsyncStorage.setItem(KEY, JSON.stringify(next));
        emit('engagement_settings_changed');
    } catch {
        // A preference that did not save is worth a retry, not a crash.
    }
    return next;
}

/** The one the completion path asks, on a tick, so it is its own function. */
export const sharedDoneAlerts = async (): Promise<boolean> => (await getNotificationPrefs()).sharedDone;
