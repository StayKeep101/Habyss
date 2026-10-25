import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Focus mode is quiet: while a focus session is on, nothing from Habyss
 * shows, sounds or vibrates. FocusTimeContext switches it.
 *
 * - With the app open, the notification handler (lib/notificationService.ts)
 *   hides everything.
 * - With the app in the background, a scheduled reminder would still fire, so
 *   every one due before the session ends is held back when it starts, and
 *   reminders being planned skip that window (`quietUntil`). When it ends, the
 *   held ones still ahead go back in.
 * - Friends' pushes are held by the server while you focus (the
 *   push_notification trigger reads your focus status).
 */
let quiet = false;
let until = 0;
const HELD_KEY = 'habyss_focus_held_notifications';
/** A session with no end (the stopwatch) keeps things quiet this long, at most. */
const OPEN_ENDED_MS = 12 * 3600 * 1000;

export const focusQuiet = () => quiet;
/** Until when reminders must not fire (ms), or 0 when not focusing. */
export const quietUntil = () => (quiet ? until : 0);

interface Held { identifier: string; content: Record<string, unknown>; date: number }

/** Focus started (or its end moved): hold back whatever would fire before `endsAt`. */
export async function startFocusQuiet(endsAt: number | null): Promise<void> {
    quiet = true;
    until = endsAt && endsAt > Date.now() ? endsAt : Date.now() + OPEN_ENDED_MS;
    try {
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        const held: Held[] = JSON.parse((await AsyncStorage.getItem(HELD_KEY)) ?? '[]');
        for (const request of scheduled) {
            const trigger = request.trigger as { type?: string; value?: number; date?: number | string } | null;
            const date = typeof trigger?.value === 'number' ? trigger.value : trigger?.date ? new Date(trigger.date).getTime() : null;
            if (date === null || date > until) continue;
            await Notifications.cancelScheduledNotificationAsync(request.identifier);
            held.push({ identifier: request.identifier, content: request.content as unknown as Record<string, unknown>, date });
        }
        await AsyncStorage.setItem(HELD_KEY, JSON.stringify(held));
    } catch { /* quiet in the app at least */ }
}

/** Focus ended: what was held and is still ahead goes back, and reminders are planned again. */
export async function endFocusQuiet(): Promise<void> {
    quiet = false;
    until = 0;
    try {
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        const held: Held[] = JSON.parse((await AsyncStorage.getItem(HELD_KEY)) ?? '[]');
        await AsyncStorage.removeItem(HELD_KEY);
        for (const item of held) {
            if (item.date <= Date.now() + 30000) continue;
            await Notifications.scheduleNotificationAsync({
                identifier: item.identifier,
                content: item.content as never,
                trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(item.date) },
            }).catch(() => undefined);
        }
    } catch { /* nothing held */ }
    const { NotificationService } = require('./notificationService') as typeof import('./notificationService');
    void NotificationService.refreshReminders().catch(() => undefined);
}

/** Kept for callers that only switch the in-app part. */
export function setFocusQuiet(next: boolean): void { quiet = next; }
