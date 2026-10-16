import { clearPastWeeks, getThoughts } from './brainDump';
import { getWeekStart, reviewTime, startOfWeek } from './weekStart';

/**
 * The brain dump's weekly rhythm: on the last evening of the week a nudge to
 * sort what is in it (delete, or turn into a task, habit or goal), and when the
 * new week starts, whatever is left from last week is let go.
 *
 * Safe to call any time; it reschedules from scratch. Never asks for
 * notification permission — only uses it if already given.
 */
const ID = 'habyss-brain-dump-review';
let timer: ReturnType<typeof setTimeout> | null = null;

export function syncBrainDumpReview(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void run(); }, 400);
}

async function run(): Promise<void> {
    try {
        const start = await getWeekStart();
        const now = new Date();
        await clearPastWeeks(startOfWeek(now, start));
        const count = (await getThoughts()).length;

        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
        if (count === 0) return;
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;
        const when = reviewTime(now, start);
        if (when.getTime() <= now.getTime()) return;
        await Notifications.scheduleNotificationAsync({
            identifier: ID,
            content: {
                title: 'Sort your brain dump',
                body: `${count} thought${count === 1 ? '' : 's'} clear${count === 1 ? 's' : ''} when the week ends. Keep what matters.`,
                sound: 'default',
                data: { kind: 'brain-dump-review', url: '/brain-dump' },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'default' },
        });
    } catch {
        // The worst case is no reminder this week; nothing is lost early.
    }
}
