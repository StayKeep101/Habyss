import AsyncStorage from '@react-native-async-storage/async-storage';
import { clockLabel, flowDay, GRACE, type DayFlow, type DayWindowMinutes, type FlowInput } from './dayFlow';

/**
 * Echo, when the plan moves because something was not done in time
 * (Settings → Notifications → Plan changes).
 *
 * The app is not running when it happens, so the message is worked out ahead:
 * the thing you are on (or the next one) has a moment it counts as missed —
 * its end, plus a little grace. The day is laid out as it would be at that
 * moment, and the notification says where the thing went. Finishing it, or
 * anything else changing the plan, replaces the notification.
 */
export interface PlanAlert { at: number; body: string }

export function planAlert(items: FlowInput[], flow: DayFlow, now: number, window: DayWindowMinutes): PlanAlert | null {
    const open = (item: { done: boolean; fixed?: boolean }) => !item.done && !item.fixed;
    const target = flow.current && open(flow.current) ? flow.current : flow.timeline.find(item => open(item) && item.start >= now);
    if (!target) return null;
    const at = target.end + GRACE;
    if (at >= 24 * 60) return null;
    const later = flowDay(items, at, window);
    const moved = later.timeline.find(item => item.id === target.id);
    const by = clockLabel(target.end);
    if (!moved) return { at, body: `${target.title} didn't get done by ${by}, and there's no room left for it before bedtime.` };
    if (moved.start === target.start) return null;
    return { at, body: `${target.title} didn't get done by ${by}, so I moved it to ${clockLabel(moved.start)}.` };
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
