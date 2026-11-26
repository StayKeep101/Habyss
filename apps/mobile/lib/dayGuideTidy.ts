import type { Notification } from 'expo-notifications';

/**
 * One "what's on now" at a time in Notification Center: the start of each
 * habit, task or event (lib/dayGuide.ts) replaces the one before, rather than
 * a pile of them building up through the day. Delivered ones are tidied
 * whenever Habyss is opened or one arrives while it is open; with 1.0.8 the
 * Screen Time monitor delivers them under one name, so iOS replaces them itself.
 */
export function staleDayGuide(notifications: Pick<Notification, 'date' | 'request'>[]): string[] {
    const guide = notifications
        .filter(item => (item.request.content.data as { kind?: string } | undefined)?.kind === 'day-guide')
        .sort((a, b) => b.date - a.date);
    return guide.slice(1).map(item => item.request.identifier);
}

export async function tidyDayGuide(): Promise<number> {
    try {
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        const stale = staleDayGuide(await Notifications.getPresentedNotificationsAsync());
        await Promise.all(stale.map(id => Notifications.dismissNotificationAsync(id).catch(() => undefined)));
        return stale.length;
    } catch { return 0; }
}

/** Keeps it tidy while the app runs: on coming to the front, and as each one arrives. */
export function watchDayGuide(): () => void {
    const { AppState } = require('react-native') as typeof import('react-native');
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    void tidyDayGuide();
    const app = AppState.addEventListener('change', state => { if (state === 'active') void tidyDayGuide(); });
    const arrived = Notifications.addNotificationReceivedListener(() => { setTimeout(() => void tidyDayGuide(), 500); });
    return () => { app.remove(); arrived.remove(); };
}
