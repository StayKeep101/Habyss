import { getEchoConfig } from './echo';
import { getWeekStart, reviewTime } from './weekStart';

/**
 * One notification a week: on the week's last evening, half an hour after the
 * brain dump nudge, "your week with Echo". Only when the person keeps it on
 * (Echo settings → Weekly review) and notifications are already allowed;
 * never asks for permission itself. Rescheduled from scratch on each call.
 */
const ID = 'habyss-week-review';

export async function syncWeeklyReviewNotice(): Promise<void> {
    try {
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
        const config = await getEchoConfig();
        if (config.weeklyReview === false) return;
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;
        const { humanTime } = require('./echoHuman') as typeof import('./echoHuman');
        const planned = reviewTime(new Date(), await getWeekStart());
        planned.setMinutes(planned.getMinutes() + 30);
        // At a human minute (7:43, not 7:30): Echo is a someone, not a timer.
        const when = humanTime(planned, ID);
        // It can wait: inside your sleep, it comes when you wake.
        const { getDayWindow } = require('./echo') as typeof import('./echo');
        const { whenAwake } = require('./sleepWindow') as typeof import('./sleepWindow');
        const at = whenAwake(when, await getDayWindow());
        when.setTime(at.getTime());
        if (when.getTime() <= Date.now()) return;
        await Notifications.scheduleNotificationAsync({
            identifier: ID,
            content: {
                title: 'Your week with Echo',
                body: 'What held, what got harder, and one thing to try next week.',
                sound: 'default',
                data: { kind: 'week-review', url: '/week-review' },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'default' },
        });
    } catch {
        // No review reminder this week; the page is still there.
    }
}
