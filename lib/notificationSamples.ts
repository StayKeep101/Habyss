import type { PersonalityModeId } from '@/constants/AIPersonalities';

/**
 * Developer → Test notifications: one of each notification Habyss sends, built
 * the way the real one is (title, words, Echo's clip, buttons, how urgent), so
 * they can be seen on the Lock Screen and in a banner and improved. Each comes
 * five seconds after the tap, time to lock the phone or leave the app. Marked
 * as samples: their buttons do nothing (lib/notificationService.ts ignores the
 * kind), so testing never ticks anything.
 */
export interface NotificationSample {
    id: string;
    label: string;
    title: string;
    body: string;
    /** Which of Echo's clips (lib/echoSounds.ts), when it is said in Echo's voice. */
    clip?: 'start' | 'end' | 'leave' | 'review';
    /** Its buttons (lib/notificationActions.ts CATEGORIES). */
    category?: string;
    /** Breaks through Focus modes and is read out on AirPods, like the day's own. */
    urgent?: boolean;
}

export function notificationSamples(name?: string): NotificationSample[] {
    const you = name ? `${name}, ` : '';
    return [
        { id: 'now', label: 'A task or habit starts', title: 'Study midterm', body: '', clip: 'start', urgent: true },
        { id: 'end', label: "Time's up, with free time after", title: "⏰ Time's up: Emails", body: 'Free until 12:00 PM · then Lunch', clip: 'end', category: 'HABYSS_DONE', urgent: true },
        { id: 'leave', label: 'Leave now for an event', title: '🚶 Leave now for Class', body: 'Starts at 2:00 PM', clip: 'leave', urgent: true },
        { id: 'meal', label: 'A meal starts', title: '🥗 Lunch time', body: '', clip: 'start', urgent: true },
        { id: 'before', label: 'A reminder before (10 min)', title: '⏳ Gym in 10 min', body: 'At 5:00 PM', urgent: true },
        { id: 'bedtime', label: 'Bedtime', title: '😴 Bedtime', body: 'Time to wind down.', urgent: true },
        { id: 'scroll', label: 'Echo: 30 minutes of scrolling', title: 'Echo', body: `${you}30 minutes of brainrot today. That's 30 minutes further from your goals. Study midterm. Now.`, urgent: true },
        { id: 'gate-open', label: 'Apps open for an hour', title: '🔓 Your apps are open', body: 'Until 3:14 PM. Then they lock again. 100 Shards spent.' },
        { id: 'nudge', label: 'Community: a nudge', title: '👊 Alex nudged you', body: 'Your move today.', category: 'HABYSS_FRIEND_NUDGE' },
        { id: 'comment', label: 'Community: a comment', title: '💬 Mia commented', body: '"8 of 15 before noon?? who are you"', category: 'HABYSS_COMMENT' },
        { id: 'duel', label: 'Community: a duel challenge', title: '⚔️ Sam challenged you', body: '7 days · 50 Shards each', category: 'HABYSS_DUEL' },
        { id: 'passed', label: 'Community: a friend passed you', title: '🏁 Alex passed you', body: "You're #3. Take it back." },
    ];
}

/** Sends one, five seconds from now. Never asks for permission (Settings → Notifications does). */
export async function sendSample(sample: NotificationSample, voice: PersonalityModeId, echoVoice: boolean): Promise<'sent' | 'not-allowed'> {
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) return 'not-allowed';
    const { echoSound } = require('./echoSounds') as typeof import('./echoSounds');
    await Notifications.scheduleNotificationAsync({
        identifier: `sample:${sample.id}:${Date.now()}`,
        content: {
            title: sample.title,
            body: sample.body,
            sound: sample.clip && echoVoice ? echoSound(sample.clip, voice) : 'default',
            ...(sample.urgent ? { interruptionLevel: 'timeSensitive' as const } : null),
            ...(sample.category ? { categoryIdentifier: sample.category } : null),
            data: { kind: 'sample', sample: sample.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
    });
    return 'sent';
}

/** The Live Activities, to look at: a task under way, and the hour of open apps. Two minutes each. */
export async function sampleLiveActivity(kind: 'task' | 'gate'): Promise<boolean> {
    const { Platform } = require('react-native') as typeof import('react-native');
    if (Platform.OS !== 'ios') return false;
    const LiveActivity = (require('@/modules/habyss-live-activity') as typeof import('@/modules/habyss-live-activity')).default;
    if (!LiveActivity?.startActivity) return false;
    const until = Date.now() + 2 * 60_000;
    LiveActivity.startActivity(
        { name: 'Habyss Live Activity', totalDurationSeconds: 120 },
        kind === 'task'
            ? { title: 'Study midterm', subtitle: 'Now · then Emails', timerEndDateInMilliseconds: until, progress: 0 }
            : { title: 'Your apps are open', subtitle: 'Locked again in 2 min', timerEndDateInMilliseconds: until, progress: 0 },
    );
    return true;
}

/** Ends every Live Activity this app has on screen. */
export async function endLiveActivities(): Promise<void> {
    const LiveActivity = (require('@/modules/habyss-live-activity') as typeof import('@/modules/habyss-live-activity')).default;
    if (!LiveActivity?.listActivities || !LiveActivity?.stopActivity) return;
    for (const id of LiveActivity.listActivities()) {
        await LiveActivity.stopActivity(id, { title: '', subtitle: '', progress: 1 }).catch(() => undefined);
    }
}
