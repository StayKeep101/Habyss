import AsyncStorage from '@react-native-async-storage/async-storage';
import { clockLabel, flowDay, GRACE, type DayFlow, type DayWindowMinutes, type FlowInput } from './dayFlow';

/**
 * Echo, when the plan moves because something is taking longer than planned
 * (Settings → Notifications → Plan changes).
 *
 * The thing you are on is never moved: it stays yours however long it runs,
 * and what comes after waits. The app is not running when that happens, so
 * the message is worked out ahead: at the thing's end, plus a little grace,
 * the day is laid out as it would be then, still on it, and the notification
 * says what that pushed back. Finishing it, or anything else changing the
 * plan, replaces the notification.
 */
export interface PlanAlert { at: number; body: string }

export function planAlert(items: FlowInput[], flow: DayFlow, now: number, window: DayWindowMinutes): PlanAlert | null {
    const open = (item: { done: boolean; fixed?: boolean }) => !item.done && !item.fixed;
    const target = flow.current && open(flow.current) ? flow.current : flow.timeline.find(item => open(item) && item.start >= now);
    if (!target) return null;
    const at = target.end + GRACE;
    if (at >= 24 * 60) return null;
    // By then it will have been started, and holds its slot as it runs on.
    const then = items.map(item => (item.id === target.id && !item.locked ? { ...item, kept: { start: target.start, end: target.end } } : item));
    const later = flowDay(then, at, window);
    const running = `${target.title} is taking longer than planned`;
    for (const before of flow.timeline) {
        if (before.id === target.id || !open(before) || before.locked || before.start < target.start) continue;
        const after = later.timeline.find(item => item.id === before.id);
        if (!after) return { at, body: `${running}, so there's no room left for ${before.title} before bedtime.` };
        if (after.cutFrom && after.end - after.start < before.end - before.start) return { at, body: `${running}, so ${before.title} is cut to ${after.end - after.start} min to fit before bedtime.` };
        if (after.start > before.start) return { at, body: `${running}, so ${before.title} now starts at ${clockLabel(after.start)}.` };
    }
    return null;
}

const ID = 'habyss-plan-moved';
const SETTING = 'notif_plan_changes';
let last: string | null = null;

/** On unless switched off. */
export async function planAlertsOn(): Promise<boolean> {
    return (await AsyncStorage.getItem(SETTING).catch(() => null)) !== 'false';
}

export async function setPlanAlertsOn(on: boolean): Promise<void> {
    await AsyncStorage.setItem(SETTING, String(on)).catch(() => undefined);
    last = null;
}

/** Books the one plan-change notification for today, or clears it. Never asks for permission. */
export async function schedulePlanAlert(alert: PlanAlert | null): Promise<void> {
    try {
        const on = await planAlertsOn();
        const key = on && alert ? `${alert.at}|${alert.body}` : '';
        if (key === last) return;
        last = key;
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        await Notifications.cancelScheduledNotificationAsync(ID).catch(() => undefined);
        if (!on || !alert) return;
        const settings = JSON.parse((await AsyncStorage.getItem('app_settings')) ?? '{}') as { notificationsEnabled?: boolean };
        if (settings?.notificationsEnabled === false) return;
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') return;
        const date = new Date();
        date.setHours(0, alert.at, 0, 0);
        if (date.getTime() <= Date.now()) return;
        await Notifications.scheduleNotificationAsync({
            identifier: ID,
            content: { title: 'Echo', body: alert.body, sound: 'default', data: { kind: 'plan-moved', url: '/(root)/(tabs)/roadmap' } },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'default' },
        });
    } catch {
        // No heads-up this time; the timeline still shows the change.
    }
}
