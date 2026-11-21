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
        { id: 'passed', label: 'Community: a friend passed you', title: '🏁 Alex passed you', body: "You're #3. Take it back." },
    ];
}

/** The newer ones: a hand-over, the Community ones with Accept · Decline, and time in apps (Libby). */
export function newNotificationSamples(): NotificationSample[] {
    return [
        { id: 'handover', label: 'Hand-over: one ends, the next starts', title: 'Journal', body: 'Read done? Tap “Last one done”.', clip: 'start', category: 'HABYSS_HANDOVER', urgent: true },
        { id: 'friend-request', label: 'Friend request (Decline · Accept)', title: '👋 Sam wants to be friends', body: '@sam.lee · tap Accept to add them.', category: 'HABYSS_FRIEND_REQUEST' },
        { id: 'challenge', label: 'Challenge invite (Decline · Join)', title: '🏆 Sam invited you to a challenge', body: 'No sugar, 7 days, starting tomorrow. 50 Shards each if you all make it.', category: 'HABYSS_CHALLENGE' },
        { id: 'share', label: 'Shared habit (No thanks · Let’s do it)', title: '🤝 Sam wants to do Read with you', body: 'Every day, 30 min. Do it together?', category: 'HABYSS_SHARE' },
        { id: 'apptime-start', label: 'Libby: tracking started (5 min in)', title: 'Read: tracking started.', body: '5 of 30 min so far. It ticks itself at 30.' },
        { id: 'apptime-done', label: 'Libby: habit completed (30 min)', title: 'Congrats, your Read habit is completed.', body: '30 min, ticked by itself. Not a single tap.' },
    ];
}

/**
 * Three starts back to back, a minute apart, said the way the day's are with
 * 1.0.8: by the Screen Time monitor, one at a time under one name, so each
 * replaces the last in Notification Center, with the phone locked and Habyss
 * closed (NowGuide). Your real starts come back the next time Habyss refreshes
 * its notifications (opening it is enough). False on a build without it, or
 * without Screen Time.
 */
export async function sampleBackToBack(): Promise<boolean> {
    const guide = require('./nowGuide') as typeof import('./nowGuide');
    if (!(await guide.nowGuideReady())) return false;
    const now = Date.now() / 1000;
    const step = (at: number, title: string, body: string, category: string | null) =>
        ({ at: now + at, title, body, category, sound: null, data: { kind: 'sample', sample: 'back-to-back' } });
    guide.setNowPlan([
        step(60, 'Read', 'Now until 9:30 AM', null),
        step(120, 'Journal', 'Read done? Tap “Last one done”.', 'HABYSS_HANDOVER'),
        step(180, 'Stretch', 'Journal done? Tap “Last one done”.', 'HABYSS_HANDOVER'),
    ]);
    return true;
}

/**
 * A Live Activity that drops down in a minute, as a habit's does at its start
 * (iOS 26: a card scheduled to start on its own, with an alert). It takes the
 * card's place for five minutes; the real one returns when Habyss refreshes it.
 */
export async function sampleLiveDrop(): Promise<'scheduled' | 'unsupported'> {
    const LiveActivity = require('@/modules/habyss-live-activity').default as typeof import('@/modules/habyss-live-activity').default;
    if (!LiveActivity?.reconcileScheduledActivities || !LiveActivity.supportsScheduledActivities?.()) return 'unsupported';
    const start = Date.now() + 60_000;
    const { ACCENT_GRADIENTS } = require('@/context/AccentContext') as typeof import('@/context/AccentContext');
    await LiveActivity.reconcileScheduledActivities([{
        key: `sample:${start}`, title: 'Study midterm', start, end: start + 5 * 60_000, url: 'habyss://roadmap', accentHex: ACCENT_GRADIENTS[0].colors[1],
        itemId: null, nextTitle: 'Emails', nextStart: start + 5 * 60_000, nextEnd: start + 20 * 60_000, nextItemId: null, nextUrl: 'habyss://roadmap',
    }]);
    return 'scheduled';
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
