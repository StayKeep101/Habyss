import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import HabyssLiveActivity from '@/modules/habyss-live-activity';
import type { DayFlow } from './dayFlow';
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
/**
 * One Live Activity, from the timeline: what you are on now, or (where iOS
 * can start a card on its own) the next thing. The timeline is the one truth,
 * so a habit or task Habyss placed gets its card at the time it was placed,
 * not at the time it was first planned, and two cards never overlap: iOS does
 * not end a card by itself when its time is over, so there is only ever one.
 */
export interface FlowSlot { key: string; kind: 'habit' | 'task' | 'meal' | 'event'; id: string; title: string; start: number; end: number; color?: string }

/**
 * Everything still ahead on today's timeline, as times: open habits and tasks,
 * and meals and calendar events too, so the card always says what the day is
 * on, from waking to bed.
 */
export function slotsFromFlow(flow: DayFlow, day: string): FlowSlot[] {
    const midnight = new Date(`${day}T00:00:00`).getTime();
    return flow.timeline
        .filter(item => !item.done && item.state !== 'done' && (item.kind === 'habit' || item.kind === 'task' || item.kind === 'meal' || item.kind === 'event'))
        .map(item => ({
            key: `${item.kind}:${item.id}${item.part ? `#${item.part.index}` : ''}:${day}`, kind: item.kind as FlowSlot['kind'], id: item.id, title: item.title,
            start: midnight + item.start * 60000, end: midnight + item.end * 60000, color: item.color,
        }));
}

/**
 * The one card: what the day is on now, else what comes next (counting down
 * to it). Where iOS can start a card on its own, the next one is scheduled for
 * its time; elsewhere it shows now, as "up next".
 */
export function activityPlan(slots: FlowSlot[], now: Date, _supportsScheduling: boolean) {
    const at = now.getTime();
    const slot = slots.find(item => item.start <= at && at < item.end)
        ?? slots.filter(item => item.start > at).sort((a, b) => a.start - b.start)[0];
    if (!slot) return [];
    const urlOf = (item: FlowSlot) => item.kind === 'habit' ? `habyss://habit-detail?habitId=${encodeURIComponent(item.id)}` : 'habyss://roadmap';
    const doable = (item: FlowSlot) => item.kind === 'habit' || item.kind === 'task';
    // What follows it: the card shows it once this one's time is up (and its
    // Done button moves straight to it), so it never sits on a finished thing.
    const next = slots.filter(item => item.key !== slot.key && item.start >= slot.end - 1).sort((a, b) => a.start - b.start)[0];
    return [{
        key: slot.key, title: slot.title, start: slot.start, end: slot.end, url: urlOf(slot), color: slot.color,
        itemId: doable(slot) ? `${slot.kind}:${slot.id}` : null,
        ...(next ? { nextTitle: next.title, nextStart: next.start, nextEnd: next.end, nextItemId: doable(next) ? `${next.kind}:${next.id}` : null, nextUrl: urlOf(next) } : null),
    }];
}

/** The Roadmap's own timeline, the freshest truth, while it is from today. */
let latest: { day: string; slots: FlowSlot[] } | null = null;
/**
 * Something changed (a tick, an edit, a new task): the copy the Roadmap last drew is out of
 * date. A tick from a notification or the Lock Screen happens with the Roadmap not drawing, so
 * the card was rebuilt from that old copy and stayed on the finished thing until the app opened.
 * Now the day is read again instead.
 */
export function forgetTodayFlow() { latest = null; }
try {
    (require('./appEvents') as typeof import('./appEvents')).onAny(
        ['habit_completion_updated', 'tasks_changed', 'habit_created', 'habit_updated', 'habit_deleted'], forgetTodayFlow);
} catch { /* no events in this environment */ }
let reminderTimer: ReturnType<typeof setTimeout> | null = null;
export function setTodayFlow(day: string, flow: DayFlow) {
    (require('./todayFlow') as typeof import('./todayFlow')).rememberTodayFlow(day, flow);
    const slots = slotsFromFlow(flow, day);
    if (latest?.day === day && JSON.stringify(latest.slots) === JSON.stringify(slots)) return;
    latest = { day, slots };
    void refreshScheduledActivities();
    // Reminders follow the timeline too: re-timed shortly after it settles.
    if (reminderTimer) clearTimeout(reminderTimer);
    reminderTimer = setTimeout(() => {
        reminderTimer = null;
        const { NotificationService } = require('./notificationService') as typeof import('./notificationService');
        void NotificationService.refreshReminders().catch(() => undefined);
    }, 3000);
}

let queue: Promise<unknown> = Promise.resolve();
let lastSent = '';
export function refreshScheduledActivities() {
    if (engagementLifecycle.paused) return Promise.resolve();
    const next = queue.catch(() => undefined).then(async () => {
        if (scheduledActivitiesCapability() === 'unavailable') return;
        const { localDateKey } = require('./habitSchedule') as typeof import('./habitSchedule');
        const now = new Date();
        const today = localDateKey(now);
        const [enabled, accent, focusing] = await Promise.all([scheduledActivitiesEnabled(), readAccent(), focusCardLive()]);
        // A focus session has its own card (the timer): then that is the one.
        let plan: ReturnType<typeof activityPlan> = [];
        if (enabled && !focusing) {
            const slots = latest?.day === today ? latest.slots
                : slotsFromFlow(await (require('./todayFlow') as typeof import('./todayFlow')).todayFlow(now), today);
            plan = activityPlan(slots, now, scheduledActivitiesCapability() === 'scheduled');
        }
        const payload = plan.map(({ color, ...item }) => ({ ...item, accentHex: color ?? mixHex(accent.from, accent.to) }));
        const signature = JSON.stringify(payload);
        if (signature === lastSent) return;
        const result = await HabyssLiveActivity!.reconcileScheduledActivities!(payload);
        lastSent = signature;
        if (result.failed) console.warn(`[Live Activities] iOS could not schedule ${result.failed} card(s).`);
        return result;
    });
    queue = next;
    return next;
}

/** Whether the focus timer's card is on the Lock Screen right now. */
async function focusCardLive(): Promise<boolean> {
    try {
        const id = await AsyncStorage.getItem('@habyss_live_activity_id');
        return !!id && !!HabyssLiveActivity?.listActivities?.().includes(id);
    } catch {
        return false;
    }
}

export async function waitForScheduledActivitySync() { await queue.catch(() => undefined); }
