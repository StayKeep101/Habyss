import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import HabyssLiveActivity from '@/modules/habyss-live-activity';
import { scheduledMoments, type ScheduledMoment } from './scheduledMoments';
import { emit } from './appEvents';
import { engagementLifecycle } from './engagementLifecycle';
import { readAccent } from './widgetSync';
import { mixHex } from './colorContrast';

const KEY = 'habyss_scheduled_live_activities';
export async function scheduledActivitiesEnabled() { return (await AsyncStorage.getItem(KEY)) !== 'false'; }
export async function setScheduledActivitiesEnabled(enabled: boolean) {
    await AsyncStorage.setItem(KEY, String(enabled));
    emit('engagement_settings_changed');
}
export function scheduledActivitiesCapability(): 'scheduled' | 'foreground' | 'unavailable' {
    if (Platform.OS !== 'ios' || !HabyssLiveActivity?.reconcileScheduledActivities) return 'unavailable';
    return HabyssLiveActivity.supportsScheduledActivities?.() ? 'scheduled' : 'foreground';
}
export function activityPlan(moments: ScheduledMoment[], now: Date, supportsScheduling: boolean) {
    return moments.filter(moment => moment.end > now && (supportsScheduling || moment.start <= now))
        .slice(0, 4).map(moment => ({
            key: moment.key, title: moment.title, start: moment.start.getTime(), end: moment.end.getTime(),
            url: moment.kind === 'habit' ? `habyss://${moment.url.slice(1)}` : 'habyss://roadmap',
        }));
}

let queue: Promise<unknown> = Promise.resolve();
export function refreshScheduledActivities() {
    if (engagementLifecycle.paused) return Promise.resolve();
    const next = queue.catch(() => undefined).then(async () => {
        if (scheduledActivitiesCapability() === 'unavailable') return;
        const { getHabits, getCompletions, getSkipped } = require('./habitsSQLite') as typeof import('./habitsSQLite');
        const { getTasks } = require('./tasks') as typeof import('./tasks');
        const { localDateKey } = require('./habitSchedule') as typeof import('./habitSchedule');
        const now = new Date();
        const today = localDateKey(now);
        const [habits, tasks, completed, skipped, enabled, accent] = await Promise.all([
            getHabits(), getTasks(), getCompletions(today), getSkipped(today), scheduledActivitiesEnabled(), readAccent(),
        ]);
        const plan = enabled ? activityPlan(scheduledMoments(habits, tasks, now, completed, skipped), now, scheduledActivitiesCapability() === 'scheduled') : [];
        const result = await HabyssLiveActivity!.reconcileScheduledActivities!(plan.map(item => ({ ...item,
            // A habit's own colour, otherwise the app's accent (the gradient's middle, as in the app).
            accentHex: habits.find(habit => item.key.startsWith(`habit:${habit.id}:`))?.color ?? mixHex(accent.from, accent.to) })));
        if (result.failed) console.warn(`[Live Activities] iOS could not schedule ${result.failed} card(s).`);
        return result;
    });
    queue = next;
    return next;
}

export async function waitForScheduledActivitySync() { await queue.catch(() => undefined); }
