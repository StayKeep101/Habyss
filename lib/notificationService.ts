import { DONE_CATEGORY, HANDOVER_CATEGORY } from './notificationActions';
import { DEFAULT_PREFS, getNotificationPrefs, setNotificationPrefs } from './notificationPrefs';
import { echoSound } from './echoSounds';
import * as Notifications from 'expo-notifications';
import {Platform} from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// LOCATION_TASK_NAME is now defined in LocationService.ts
// We import it in _layout.tsx to ensure it's registered.

import { LocationService } from './LocationService';
import type { Habit } from './habitsSQLite';
import { buildTaskReminderPlan } from './taskReminders';
import { buildHabitReminderPlan } from './habitReminders';
import { localDateKey } from './habitSchedule';
import { emit, onAny } from './appEvents';
import { engagementLifecycle } from './engagementLifecycle';
import { focusQuiet, quietUntil } from './focusQuiet';
import { isAsleep } from './sleepWindow';
import { KEEP_ALIVE_CONTENT, KEEP_ALIVE_ID, keepAliveAt } from './reminderKeepAlive';
let reminderQueue: Promise<void> = Promise.resolve();
let refreshPromise: Promise<void> | null = null;
let refreshAgain = false;

// IMPORTANT: Do NOT call Notifications APIs at module scope - it crashes iOS!
// setNotificationHandler is now called inside init()

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'habit' | 'streak' | 'achievement' | 'nudge' | 'friend_request' | 'shared_habit' | 'shared_goal';
  timestamp: number;
  read: boolean;
  icon?: string;
  data?: any;
  fromUserId?: string;
}

let isHandlerSet = false;
let watchingTasks = false;
const INBOX_NOTIFICATIONS_KEY = 'habyss_inbox_notifications';

function sortNotifications(items: InAppNotification[]) {
  return [...items].sort((a, b) => b.timestamp - a.timestamp);
}

async function readInbox(): Promise<InAppNotification[]> {
  try {
    const raw = await AsyncStorage.getItem(INBOX_NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? sortNotifications(parsed) : [];
  } catch (e) {
    console.warn('Failed to read inbox notifications:', e);
    return [];
  }
}

async function writeInbox(items: InAppNotification[]) {
  const sorted = sortNotifications(items);
  await AsyncStorage.setItem(INBOX_NOTIFICATIONS_KEY, JSON.stringify(sorted));
  emit('notifications_updated', {
    unreadCount: sorted.filter((item) => !item.read).length,
  });
}

/** True when a push names the signed-in account as its sender. */
export async function sentByMe(from: unknown): Promise<boolean> {
  if (typeof from !== 'string' || !from) return false;
  try {
    const { getSupabase } = require('./supabase') as typeof import('./supabase');
    const { data } = await getSupabase()?.auth.getSession() ?? { data: null };
    return data?.session?.user.id === from;
  } catch {
    return false;
  }
}

/** How long after the last change reminders are rescheduled. */
const REMINDER_SETTLE_MS = 1000;

/** Today's Leave now / Start now alarms, replaced only when they change. */
let lastAlarms = '';
async function syncMomentAlarms(moments: { at: number; title: string }[]): Promise<void> {
  const key = JSON.stringify(moments);
  if (key === lastAlarms) return;
  lastAlarms = key;
  try {
    const module = (require('@/modules/habyss-live-activity') as typeof import('@/modules/habyss-live-activity')).default;
    if (!module?.scheduleMomentAlarms) return;
    await module.scheduleMomentAlarms(moments.slice(0, 24));
  } catch { lastAlarms = ''; }
}

export class NotificationService {
  static async init() {
    // Set notification handler ONLY inside init, never at module scope
    if (!isHandlerSet) {
      try {
        Notifications.setNotificationHandler({
          handleNotification: async (notification) => {
            // Focus mode: nothing at all, not a banner, a sound or the list.
            // The break Echo suggests in a long session is the one exception (lib/focusBreak.ts).
            if (focusQuiet() && notification.request.content.data?.kind !== 'focus-break') return { shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: false, shouldShowList: false };
            // A push about something you did yourself (a nudge you sent, a
            // share you made) never rings your own phone, even if the server
            // still holds this phone's token on the other account.
            const mine = await sentByMe(notification.request.content.data?.from);
            return { shouldPlaySound: !mine, shouldSetBadge: false, shouldShowBanner: !mine, shouldShowList: !mine };
          },
        });
        isHandlerSet = true;
      } catch (e) {
        console.warn('Failed to set notification handler:', e);
      }
    }

    // A task's reminder follows its due date, so any change to a task has to
    // rewrite what is scheduled: created, rescheduled, finished or deleted.
    if (!watchingTasks) {
      watchingTasks = true;
      // Once a run of changes is over, not on each one: rescheduling every
      // reminder reads the whole day and talks to iOS, and doing it under each
      // tick was what the next tick's animation waited behind.
      let pending: ReturnType<typeof setTimeout> | null = null;
      onAny(['tasks_changed', 'habit_created', 'habit_updated', 'habit_deleted', 'goal_deleted', 'habit_completion_updated', 'cloud_restored', 'engagement_settings_changed'], () => {
        if (pending) clearTimeout(pending);
        pending = setTimeout(() => { pending = null; void this.refreshReminders().catch(() => undefined); }, REMINDER_SETTLE_MS);
      });
    }

    // Done, Start focus, In 10 minutes, Skip today on every habit or task (lib/notificationActions.ts).
    const { CATEGORIES }: typeof import('./notificationActions') = require('./notificationActions');
    for (const category of CATEGORIES) await Notifications.setNotificationCategoryAsync(category.id, category.buttons);

    // Setup channels for Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  }

  static async registerForPushNotificationsAsync(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return null;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return null;

      // Get Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) {
        console.warn('Missing EAS projectId — cannot register for push');
        return null;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      const pushToken = tokenData.data;
      console.log('Expo push token:', pushToken);

      await AsyncStorage.setItem('habyss_push_token', pushToken);
      return pushToken;
    } catch (e) {
      console.warn('Failed to register for push notifications:', e);
      return null;
    }
  }

  static async requestPermissions() {
    await this.init();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  }

  static async requestLocationPermissions() {
    try {
      return await LocationService.requestPermissions();
    } catch (e) {
      console.warn('Error requesting location permissions:', e);
      return false;
    }
  }

  static async scheduleHabitReminder(_habit: Pick<Habit, 'id'>) {
    await this.refreshHabitReminders();
  }

  static refreshHabitReminders(): Promise<void> {
    if (engagementLifecycle.paused) return Promise.resolve();
    if (refreshPromise) { refreshAgain = true; return refreshPromise; }
    // Serialize refreshes so rapid edits cannot create duplicate notification queues.
    const refresh = async () => {
      const { getHabits, getCompletions, getSkipped }: typeof import('./habitsSQLite') = require('./habitsSQLite');
      try {
        // A widget intent can wake the app in the background. Apply its check-in
        // before planning, otherwise startup could recreate the cancelled nudge.
        const { drainWidgetToggles }: typeof import('./widgetSync') = require('./widgetSync');
        const applied = await drainWidgetToggles();
        if (applied.tasks) emit('tasks_changed');
        const now = new Date();
        const todayKey = localDateKey(now);
        const { getTasks }: typeof import('./tasks') = require('./tasks');
        const echo: typeof import('./echo') = require('./echo');
        const writer: typeof import('./echoWriter') = require('./echoWriter');
        const [habits, tasks, today, skipped, pending, permission, config, dayWindow, voice, person, settingsRaw] = await Promise.all([
          getHabits(), getTasks(), getCompletions(todayKey), getSkipped(todayKey),
          Notifications.getAllScheduledNotificationsAsync(), Notifications.getPermissionsAsync(),
          echo.getEchoConfig(), echo.getDayWindow(), echo.getEchoPersonality(), echo.getName(),
          AsyncStorage.getItem('app_settings'),
        ]);
        let settings: { notificationsEnabled?: boolean } = {};
        try { settings = JSON.parse(settingsRaw ?? '{}'); } catch { /* use defaults */ }
        const allowed = settings?.notificationsEnabled !== false && (permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
        // Habit reminders have no switch of their own any more: they follow Notifications.
        const habitsAllowed = true;
        const name = config.useName ? person : undefined;
        // Anything about a habit or a task is ours to replace. Builds from late
        // 2025 booked repeating daily reminders tagged with only a habitId; they
        // were never recognised here, so they kept firing beside the new ones
        // and every reminder arrived twice.
        const ours = (item: Notifications.NotificationRequest) =>
          ['habit-reminder', 'task-reminder', 'echo-check-in', 'echo-alive', 'keep-alive', 'day-guide', 'streak-guard', 'echo-energy', 'day-review'].includes(String(item.content.data?.kind))
          || typeof item.content.data?.habitId === 'string' || typeof item.content.data?.taskId === 'string';
        const old = pending.filter(ours);
        // One budget includes Echo, regular reminders, and daily check-ins.
        const budget = Math.max(0, 56 - pending.filter(item => !ours(item)).length);
        const candidates: { identifier: string; date: Date; content: Notifications.NotificationContentInput }[] = [];
        // What a habit asked for itself: its reminder times ("08:00"). Everything else
        // comes from the day as it happens (lib/dayGuide.ts), below: no check-ins,
        // energy questions, streak guards or follow-ups (Settings → Notifications).
        const taskPlan: ReturnType<typeof buildTaskReminderPlan> = [];
        const plan = allowed && habitsAllowed
          ? buildHabitReminderPlan(habits.filter(habit => (habit.reminders?.length ?? 0) > 0 && !habit.reminderOffset), now, { ...today, ...skipped }, 48, undefined)
          : [];
        for (const { habit, date, scheduledDate } of plan) candidates.push({
          identifier: `habit:${habit.id}:${date.getTime()}`, date,
          content: { title: habit.name, body: habit.reminderMessage?.trim() || 'Your reminder.',
            sound: habit.ringtone === 'silent' || habit.ringtone === 'vibrate' ? false : 'default', categoryIdentifier: DONE_CATEGORY,
            data: { kind: 'habit-reminder', habitId: habit.id, scheduledDate, url: '/habit-detail?habitId=' + encodeURIComponent(habit.id) } },
        });
        // What a task asked for itself, as a habit does: its reminder time on its day.
        if (allowed) {
          const { buildTaskTimeReminders }: typeof import('./taskReminders') = require('./taskReminders');
          for (const { task, date } of buildTaskTimeReminders(tasks, now, 48)) candidates.push({
            identifier: `task-time:${task.id}:${date.getTime()}`, date,
            content: { title: task.title, body: 'Your reminder.', sound: 'default', categoryIdentifier: DONE_CATEGORY,
              data: { kind: 'task-reminder', taskId: task.id, url: '/(root)/(tabs)/roadmap' } },
          });
        }
        // The day as it happens (lib/dayGuide.ts): as each thing begins, one ending into the
        // next as one notification (its Done ticks the one that ended), time's up before a gap,
        // bedtime, and each habit's or task's own reminders before it.
        const prefs = await getNotificationPrefs().catch(() => DEFAULT_PREFS);
        let clearAlarms = false;
        if (allowed && prefs.dayGuide) {
          const { currentTodayFlow }: typeof import('./todayFlow') = require('./todayFlow');
          const { guideMoments }: typeof import('./dayGuide') = require('./dayGuide');
          const { morningAlarmAvailable }: typeof import('./morningAlarm') = require('./morningAlarm');
          const { loadItemAlerts }: typeof import('./itemAlerts') = require('./itemAlerts');
          const flow = await currentTodayFlow(now).catch(() => null);
          if (flow) {
            const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
            const [sh, sm] = dayWindow.sleep.split(':').map(Number);
            const [wh, wm] = dayWindow.wake.split(':').map(Number);
            const sleep = sh * 60 + sm + (sh * 60 + sm <= wh * 60 + wm ? 24 * 60 : 0);
            const before = await loadItemAlerts(habits, tasks);
            // Never alarms: AlarmKit rings through Silent and cannot just vibrate. As notifications
            // they follow the silent switch (a vibration on Silent) and tap the Watch.
            // A phone an earlier version booked alarms on clears them, once.
            const alarmCall = !!(require('@/modules/habyss-live-activity') as typeof import('@/modules/habyss-live-activity')).default?.scheduleMomentAlarms;
            if (prefs.alarms && alarmCall && morningAlarmAvailable()) {
              clearAlarms = true;
              void setNotificationPrefs({ alarms: false });
            }
            for (const moment of guideMoments(flow, now.getHours() * 60 + now.getMinutes(), { sleep, before })) {
              const date = new Date(midnight.getTime() + moment.at * 60000);
              if (isAsleep(date, dayWindow)) continue;
              // Done ticks the one whose time just ended; a tap opens what is on now.
              const ticks = moment.done ? { [moment.done.kind === 'task' ? 'taskId' : 'habitId']: moment.done.id, scheduledDate: todayKey } : null;
              // Echo says it, when chosen (Settings → Notifications → Echo announces): start, time's up, leave.
              const spoken = moment.kind === 'leave' ? 'leave' : moment.kind === 'end' ? 'end' : moment.kind === 'now' || moment.kind === 'handover' ? 'start' : null;
              candidates.push({ identifier: moment.id, date, content: {
                title: moment.title, body: moment.body,
                sound: prefs.echoVoice && spoken ? echoSound(spoken, voice) : 'default',
                // The moments you truly need break through Focus modes, reach the Watch, and are read out on AirPods.
                interruptionLevel: 'timeSensitive' as const,
                ...(ticks ? { categoryIdentifier: moment.kind === 'handover' ? HANDOVER_CATEGORY : DONE_CATEGORY } : null),
                data: { kind: 'day-guide', moment: moment.kind, url: moment.itemId && (moment.kind === 'now' || moment.kind === 'handover') ? '/(root)/focus?day=1' : '/(root)/(tabs)/roadmap', ...ticks },
              } });
            }
          }
        }
        // Halfway through the day (lib/middayRecap.ts): at the middle of your waking hours, what
        // is done so far. Rebuilt on every tick, so its words are the day's as it arrives.
        const { halfwayPoint, middayRecap }: typeof import('./middayRecap') = require('./middayRecap');
        const halfway = allowed && config.midday !== false ? halfwayPoint(dayWindow, now) : null;
        if (halfway && localDateKey(halfway) === todayKey) {
          const { isHabitScheduledForDate }: typeof import('./habitSchedule') = require('./habitSchedule');
          const { tasksForDay }: typeof import('./tasks') = require('./tasks');
          const focus: typeof import('./focusStats') = require('./focusStats');
          await focus.loadFocusRecords().catch(() => undefined);
          const due = habits.filter(habit => !habit.isGoal && !habit.isArchived && !skipped[habit.id] && isHabitScheduledForDate(habit, now));
          const dayTasks = tasksForDay(await getTasks({ includeDone: true }).catch(() => tasks), todayKey, todayKey);
          const { title, body } = middayRecap({
            habitsDue: due.length, habitsDone: due.filter(habit => today[habit.id]).length,
            tasksDue: dayTasks.length, tasksDone: dayTasks.filter(task => task.status === 'done').length,
            focused: focus.currentFocusRecords().filter(row => row.date === todayKey).reduce((sum, row) => sum + row.seconds, 0),
          }, name);
          candidates.push({ identifier: `day-review:${todayKey}`, date: halfway, content: {
            title, body, sound: 'default', data: { kind: 'day-review', url: '/(root)/(tabs)/home' },
          } });
        }
        if (clearAlarms) void syncMomentAlarms([]);
        // The same words at the same minute are one notification, even when two
        // copies of a habit or task (a restore, a share) asked for it.
        const seen = new Set<string>();
        const desired = candidates.sort((a, b) => a.date.getTime() - b.date.getTime())
          .filter(item => {
            const key = Math.floor(item.date.getTime() / 60000) + '|' + item.content.title + '|' + item.content.body;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          // Never in the past: iOS delivers a past date at once, and every
          // refresh would deliver it again. Focusing: nothing may fire before
          // the session ends (lib/focusQuiet.ts).
          .filter(item => item.date.getTime() > Math.max(now.getTime(), quietUntil()))
          // Never while you sleep (Day & calendar): bedtime rings, nothing after it until you wake.
          .filter(item => !isAsleep(item.date, dayWindow))
          // Off sick or on vacation (lib/timeOff.ts): nothing about habits or the day; a task's own reminder, set by you, still rings.
          .filter(item => item.content.data?.kind === 'task-reminder' || !(require('./timeOff') as typeof import('./timeOff')).isDayOff(localDateKey(item.date)))
          // One place kept for the note after the last of them.
          .slice(0, Math.max(0, budget - 1));
        const pauseAt = keepAliveAt(desired);
        if (pauseAt) desired.push({ identifier: KEEP_ALIVE_ID, date: pauseAt,
          content: { ...KEEP_ALIVE_CONTENT, sound: false, data: { kind: 'keep-alive', url: '/(root)/(tabs)/home' } } });
        const wanted = new Set(desired.map(item => item.identifier));
        for (const item of old) if (!wanted.has(item.identifier)) await Notifications.cancelScheduledNotificationAsync(item.identifier);
        for (const item of desired) {
          const previous = old.find(old => old.identifier === item.identifier);
          if (previous && previous.content.title === item.content.title && previous.content.body === item.content.body
            && previous.content.sound === item.content.sound && JSON.stringify(previous.content.data) === JSON.stringify(item.content.data)) continue;
          if (previous) await Notifications.cancelScheduledNotificationAsync(item.identifier);
          await Notifications.scheduleNotificationAsync({ identifier: item.identifier, content: item.content,
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.date, channelId: 'default' } });
        }
        if (allowed && config.writeReminders) void writer.topUpWrittenLines([
          ...plan.map(item => ({ key: 'habit:' + item.habit.id, kind: 'habit' as const, name: item.habit.name, person: name })),
          ...taskPlan.map(item => ({ key: 'task:' + item.task.id, kind: 'task' as const, name: item.task.title, person: name })),
        ], voice).catch(() => undefined);
      } finally {
        // Arrival reminders are independent of time reminders, including on failure.
        await LocationService.refreshGeofences();
      }
    };
    const work = async () => {
      do { refreshAgain = false; await refresh(); } while (refreshAgain);
    };
    reminderQueue = reminderQueue.catch(() => undefined).then(work);
    refreshPromise = reminderQueue.finally(() => { refreshPromise = null; });
    return refreshPromise;
  }

  /** Habits and tasks are planned together; this is the one entry point. */
  static refreshReminders(): Promise<void> {
    return this.refreshHabitReminders();
  }

  static async waitForReminderSync() { await reminderQueue.catch(() => undefined); }

  /** Notification actions are explicit check-ins, never evidence the activity happened. */
  /**
   * A button pressed on a habit or task notification (lib/notificationActions.ts):
   * Done ticks it, Start focus or Just 5 minutes opens focus on it running, In
   * 10 minutes asks again, Skip today sets a habit aside for today or moves a
   * task to tomorrow. Anything already done or skipped is left alone.
   */
  static async handleEchoResponse(response: Notifications.NotificationResponse): Promise<boolean> {
    const { ACTION, ACTIONS, ITEM_KINDS, SNOOZE_MINUTES, STARTER_MINUTES, MORE_MINUTES, ENERGY_VALUE }: typeof import('./notificationActions') = require('./notificationActions');
    const action = response.actionIdentifier;
    // Echo asked how your energy is; the button is the answer (lib/checkIns.ts feeds lib/energyCurve.ts).
    if (ENERGY_VALUE[action]) {
      const { answer }: typeof import('./checkIns') = require('./checkIns');
      await answer('energy', ENERGY_VALUE[action], new Date(response.notification.date || Date.now()));
      return true;
    }
    if (!ACTIONS.includes(action)) return false;
    const { content, identifier } = response.notification.request;
    const data = content.data;
    if (!data || !ITEM_KINDS.includes(String(data.kind))) return false;
    const habits: typeof import('./habitsSQLite') = require('./habitsSQLite');
    const tasks: typeof import('./tasks') = require('./tasks');
    const date = typeof data.scheduledDate === 'string' ? data.scheduledDate : localDateKey(new Date());
    let unfinished = false;
    let focusOn: { kind: 'habit' | 'task'; id: string; title: string } | null = null;
    if (typeof data.taskId === 'string') {
      const task = (await tasks.getTasks({ includeDone: true })).find(task => task.id === data.taskId);
      unfinished = task?.status === 'open';
      if (task) focusOn = { kind: 'task', id: task.id, title: task.title };
      // In a challenge or a bet, Done needs proof the notification can't take: held, and asked for in Habyss.
      const held = unfinished && action === ACTION.done && task && await (require('./challengeProof') as typeof import('./challengeProof')).holdForProof({ kind: 'task', task });
      if (unfinished && action === ACTION.done && !held) { await tasks.setTaskStatus(data.taskId, 'done'); emit('tasks_changed'); }
      if (unfinished && action === ACTION.skip) {
        // Not today: tomorrow, and the timeline closes the gap it leaves.
        const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
        await tasks.updateTask(data.taskId, { dueDate: localDateKey(tomorrow) });
        emit('tasks_changed');
      }
    } else if (typeof data.habitId === 'string') {
      const habit = (await habits.getHabits()).find(habit => habit.id === data.habitId && !habit.isArchived && !habit.isGoal);
      const [done, skipped] = await Promise.all([habits.getCompletions(date), habits.getSkipped(date)]);
      unfinished = !!habit && !done[data.habitId] && !skipped[data.habitId];
      if (habit) focusOn = { kind: 'habit', id: habit.id, title: habit.name };
      // "Done" from a notification ticks it, timed habits included.
      const { measurementFor }: typeof import('./habitMeasurement') = require('./habitMeasurement');
      const held = unfinished && action === ACTION.done && await (require('./challengeProof') as typeof import('./challengeProof')).holdForProof({ kind: 'habit', habit: habit! });
      if (unfinished && action === ACTION.done && !held) await habits.setCompletionValue(data.habitId, measurementFor(habit!).target, date);
      // A skip neither counts nor breaks the run.
      if (unfinished && action === ACTION.skip) await habits.setSkipped(data.habitId, true, date);
    }
    if (unfinished && focusOn && (action === ACTION.start || action === ACTION.five)) {
      const params = { day: '1', kind: focusOn.kind, id: focusOn.id, title: focusOn.title, ...(action === ACTION.five ? { minutes: String(STARTER_MINUTES) } : null) };
      setTimeout(() => { require('expo-router').router.navigate({ pathname: '/(root)/focus', params }); }, 500);
    }
    // In 10 minutes, or (at Time's up) +10 / +30 min: asked again then, the same way.
    const wait = action === ACTION.snooze ? SNOOZE_MINUTES : MORE_MINUTES[action];
    if (unfinished && wait) {
      const until = Date.now() + wait * 60000;
      await Notifications.scheduleNotificationAsync({ identifier: identifier + ':snooze',
        content: { title: content.title ?? 'Echo', body: content.body, sound: content.sound ?? 'default',
          categoryIdentifier: content.categoryIdentifier ?? 'ECHO_ALIVE', data: { ...data, snoozedUntil: until } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(until), channelId: 'default' } });
    }
    // Ticked from the notification, the app only half awake: the Live Activity moves on to what is
    // on now straight away, read fresh from the day, not when Habyss next opens.
    if (unfinished && (action === ACTION.done || action === ACTION.skip)) {
      const live: typeof import('./scheduledActivities') = require('./scheduledActivities');
      live.forgetTodayFlow();
      await live.refreshScheduledActivities().catch(() => undefined);
    }
    await this.refreshReminders();
    return true;
  }

  static async cancelHabitReminder(habitId: string) {
    const cancel = async () => {
      const pending = await Notifications.getAllScheduledNotificationsAsync();
      for (const notification of pending) {
        if (notification.content.data?.habitId === habitId) await Notifications.cancelScheduledNotificationAsync(notification.identifier);
      }
      await LocationService.refreshGeofences();
    };
    reminderQueue = reminderQueue.catch(() => undefined).then(cancel);
    return reminderQueue;
  }

  static async sendCompletionNotification(habitName: string) {
    try {
      const config = JSON.parse((await AsyncStorage.getItem('app_settings')) ?? '{}');
      if (config.notificationsEnabled === false) return;
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Session complete',
          body: `${habitName} is done.`,
          sound: 'default',
          data: { type: 'completion', habitName },
        },
        trigger: null,
      });
    } catch (e) {
      console.warn('Failed to send completion notification:', e);
    }
  }

  // --- Inbox Methods (local stubs — cloud inbox re-enabled with premium) ---

  static async getUnreadCount(): Promise<number> {
    const notifications = await readInbox();
    return notifications.filter((notification) => !notification.read).length;
  }

  static async getInboxNotifications(): Promise<InAppNotification[]> {
    return await readInbox();
  }

  static async markAllNotificationsRead() {
    const notifications = await readInbox();
    await writeInbox(notifications.map((notification) => ({ ...notification, read: true })));
  }

  static async clearAllNotifications(): Promise<boolean> {
    await AsyncStorage.removeItem(INBOX_NOTIFICATIONS_KEY);
    emit('notifications_updated', { unreadCount: 0 });
    return true;
  }

  static async markNotificationRead(id: string) {
    const notifications = await readInbox();
    await writeInbox(
      notifications.map((notification) =>
        notification.id === id ? { ...notification, read: true } : notification
      )
    );
  }

  static async addNotification(notification: { id?: string; title: string; body: string; type: string; data?: any; fromUserId?: string }) {
    const notifications = await readInbox();
    const nextNotification: InAppNotification = {
      id: notification.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title: notification.title,
      message: notification.body,
      type: notification.type as InAppNotification['type'],
      timestamp: Date.now(),
      read: false,
      data: notification.data,
      fromUserId: notification.fromUserId,
    };

    const deduped = notifications.filter((item) => item.id !== nextNotification.id);
    await writeInbox([nextNotification, ...deduped]);
  }

  // --- Realtime Subscription (disabled — premium feature) ---
  static async subscribeToRealtimeNotifications(_onNotification: (notification: any) => void) {
    return null;
  }

  static async unsubscribe(_channel: any) {
    // No-op
  }
}
