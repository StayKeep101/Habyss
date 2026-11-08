import { DEFAULT_PREFS, getNotificationPrefs } from './notificationPrefs';
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
import { longLead } from './leadTime';
import { isHabitScheduledForDate, localDateKey } from './habitSchedule';
import { emit, onAny } from './appEvents';
import { scheduledMoments } from './scheduledMoments';
import { buildAlivePlan } from './echoAlive';
import { engagementLifecycle } from './engagementLifecycle';
import { focusQuiet, quietUntil } from './focusQuiet';
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
        const { coachReminder }: typeof import('./coachMessages') = require('./coachMessages');
        const writer: typeof import('./echoWriter') = require('./echoWriter');
        const [habits, tasks, today, skipped, pending, permission, config, dayWindow, voice, person, settingsRaw, habitPreference] = await Promise.all([
          getHabits(), getTasks(), getCompletions(todayKey), getSkipped(todayKey),
          Notifications.getAllScheduledNotificationsAsync(), Notifications.getPermissionsAsync(),
          echo.getEchoConfig(), echo.getDayWindow(), echo.getEchoPersonality(), echo.getName(),
          AsyncStorage.getItem('app_settings'), AsyncStorage.getItem('notif_habits'),
        ]);
        let settings: { notificationsEnabled?: boolean } = {};
        try { settings = JSON.parse(settingsRaw ?? '{}'); } catch { /* use defaults */ }
        const allowed = settings?.notificationsEnabled !== false && (permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
        const habitsAllowed = habitPreference !== 'false';
        const name = config.useName ? person : undefined;
        const written = allowed && config.writeReminders ? await writer.loadWrittenLines() : {};
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
        // A user-requested snooze survives unrelated edits, but not completion,
        // a skip, deletion, or turning Echo off.
        if (allowed && config.alive) for (const item of old) {
          const data = item.content.data;
          if (typeof data?.snoozedUntil !== 'number' || data.snoozedUntil <= now.getTime()) continue;
          const unfinished = typeof data.taskId === 'string' ? tasks.some(task => task.id === data.taskId && task.status === 'open')
            : typeof data.habitId === 'string' && habitsAllowed && data.scheduledDate === todayKey && !today[data.habitId] && !skipped[data.habitId]
              && habits.some(habit => habit.id === data.habitId && !habit.isArchived);
          if (unfinished) candidates.push({ identifier: item.identifier, date: new Date(data.snoozedUntil),
            content: { title: item.content.title, body: item.content.body, sound: 'default', categoryIdentifier: item.content.categoryIdentifier ?? 'ECHO_ALIVE', data } });
        }
        const aliveHabits = config.alive && habitsAllowed ? habits.filter(habit => habit.startTime) : [];
        const aliveTasks = config.alive ? tasks.filter(task => task.dueTime) : [];
        // Today is timed from the timeline: each reminder and nudge follows where
        // the auto-schedule put the habit or task, not the time it was first given.
        const { todayTimes }: typeof import('./todayFlow') = require('./todayFlow');
        // Undefined when today's timeline could not be read: then the times they were given.
        const placed = allowed ? await todayTimes(now).catch(() => undefined) : undefined;
        const moments = scheduledMoments(aliveHabits, aliveTasks, now, today, skipped, 7, placed);
        const taskPlan = allowed ? buildTaskReminderPlan(tasks.filter(task => !config.alive || !task.dueTime), now, echo.suggestedReminder(dayWindow), 16, placed) : [];
        const plan = allowed && habitsAllowed ? buildHabitReminderPlan(habits.filter(habit => !config.alive || !habit.startTime), now, { ...today, ...skipped }, 48, placed) : [];
        const dayOf = (date: Date) => Math.floor(date.getTime() / 86400000);
        for (const { task, date } of taskPlan) candidates.push({
          identifier: `task:${task.id}:${date.getTime()}`, date,
          // From Echo, like a text: the line names the task itself.
          content: { title: 'Echo', body: writer.pickLine(written, 'task:' + task.id, voice, dayOf(date)) ?? coachReminder(voice, { habitName: task.title, name }),
            sound: 'default', categoryIdentifier: 'ECHO_ALIVE', data: { kind: 'task-reminder', taskId: task.id, url: '/(root)/(tabs)/roadmap' } },
        });
        for (const { habit, date, scheduledDate } of plan) candidates.push({
          identifier: `habit:${habit.id}:${date.getTime()}`, date,
          content: { title: 'Echo', body: (habit.reminderOffset ? `${habit.name} in ${longLead(habit.reminderOffset)}. ` : '')
              // A sentence the user wrote for this habit beats anything Echo
              // or the coach lines would have chosen for them.
              + (habit.reminderMessage?.trim()
                  || writer.pickLine(written, 'habit:' + habit.id, voice, dayOf(date))
                  || coachReminder(voice, { habitName: habit.name, name })),
            sound: habit.ringtone === 'silent' || habit.ringtone === 'vibrate' ? false : 'default', categoryIdentifier: 'ECHO_ALIVE',
            data: { kind: 'habit-reminder', habitId: habit.id, scheduledDate, url: '/habit-detail?habitId=' + encodeURIComponent(habit.id) } },
        });
        if (allowed && config.alive) for (const item of buildAlivePlan(moments, now, dayWindow, voice,
          { followUp: config.aliveFollowUp !== false, useName: config.useName, name, limit: 56 })) {
          const habit = item.moment.kind === 'habit' ? habits.find(habit => habit.id === item.moment.id) : undefined;
          candidates.push({ identifier: item.id, date: item.date,
            // The follow-up (its time went by untouched) offers the smallest start: five minutes.
            content: { title: item.title, body: item.body, categoryIdentifier: item.phase === 'follow-up' ? 'ECHO_NUDGE' : 'ECHO_ALIVE',
              sound: habit?.ringtone === 'silent' || habit?.ringtone === 'vibrate' ? false : 'default',
              data: { kind: 'echo-alive', phase: item.phase, scheduledDate: item.moment.day, url: item.moment.url,
                ...(item.moment.kind === 'habit' ? { habitId: item.moment.id } : { taskId: item.moment.id }) } },
          });
        }
        const { buildCheckInPlan }: typeof import('./echoCheckIns') = require('./echoCheckIns');
        const { checkInLine }: typeof import('./echoLines') = require('./echoLines');
        if (allowed) {
          const scheduled = habits.filter(habit => !habit.isGoal && !habit.isArchived && !skipped[habit.id] && isHabitScheduledForDate(habit, now));
          const { getDailyTarget, dailyFocus }: typeof import('./dailyFocus') = require('./dailyFocus');
          const focus = dailyFocus(tasks, await getDailyTarget(), todayKey, todayKey);
          const facts = { name, total: scheduled.length, left: scheduled.filter(habit => !today[habit.id]).length,
            next: focus.rows.find(task => task.status === 'open')?.title ?? scheduled.find(habit => !today[habit.id])?.name,
            tasksDue: tasks.filter(task => task.status === 'open' && task.dueDate === todayKey).length, focusTarget: focus.target, focusDone: focus.done };
          // One of Echo's patterns each morning, a different one each day.
          const { loadPatternLines }: typeof import('./echoPatterns') = require('./echoPatterns');
          const insights = await loadPatternLines();
          // Keeping the run alive (lib/notificationActions.ts): nothing done today
          // and days behind it, so Echo says so two hours before bed.
          {
            const { loadedData }: typeof import('./dataStore') = require('./dataStore');
            const { streakFrom }: typeof import('./dayComplete') = require('./dayComplete');
            const { doneOnDay }: typeof import('./dailyFocus') = require('./dailyFocus');
            const { streakGuard }: typeof import('./notificationActions') = require('./notificationActions');
            const data = await loadedData().catch(() => null);
            const doneToday = Object.values(today).some(Boolean) || tasks.some(task => doneOnDay(task, todayKey));
            const streak = data ? streakFrom(habits, data.tasks, data.history, data.skips, todayKey).streak : 0;
            const [sh, sm] = dayWindow.sleep.split(':').map(Number);
            const nextTask = focus.rows.find(task => task.status === 'open');
            const nextHabit = nextTask ? undefined : scheduled.find(habit => !today[habit.id]);
            const guard = streakGuard({ streak, doneToday, now: now.getHours() * 60 + now.getMinutes(), sleep: sh * 60 + sm, name, next: nextTask?.title ?? nextHabit?.name });
            if (guard) {
              const date = new Date(now); date.setHours(0, guard.at, 0, 0);
              const item = nextTask ? { taskId: nextTask.id } : nextHabit ? { habitId: nextHabit.id } : null;
              candidates.push({ identifier: `streak-guard:${todayKey}`, date, content: { title: guard.title, body: guard.body, sound: 'default',
                ...(item ? { categoryIdentifier: 'ECHO_NUDGE' } : null),
                data: { kind: 'streak-guard', scheduledDate: todayKey, url: '/(root)/(tabs)/home', ...item } } });
            }
          }
          // With Echo on through the day: it asks about energy once a day,
          // answered on the notification (logging it by hand is gone, see
          // lib/checkIns.ts energyAskAt), and says when the day's review is ready.
          if (config.alive) {
            const [wh, wm] = dayWindow.wake.split(':').map(Number);
            const [bh, bm] = dayWindow.sleep.split(':').map(Number);
            const { loadCheckIns, energyAskAt }: typeof import('./checkIns') = require('./checkIns');
            const { energyCurve }: typeof import('./energyCurve') = require('./energyCurve');
            const { currentFocusRecords }: typeof import('./focusStats') = require('./focusStats');
            const checkIns = await loadCheckIns();
            const curve = energyCurve({ checkIns: checkIns.entries, focus: currentFocusRecords(), now });
            const at = energyAskAt(checkIns, now, wh * 60 + wm, bh * 60 + bm, curve.confidence >= 0.8);
            if (at !== null) {
              const date = new Date(now); date.setHours(0, at, 0, 0);
              const { leadInFor }: typeof import('./checkIns') = require('./checkIns');
              candidates.push({ identifier: `echo-energy:${todayKey}`, date, content: { title: 'Echo', body: leadInFor('energy', voice),
                sound: 'default', categoryIdentifier: 'ECHO_ENERGY', data: { kind: 'echo-energy', url: '/(root)/(tabs)/home' } } });
            }
          }
          for (const item of buildCheckInPlan(config, dayWindow, now)) {
            const insight = insights.length ? insights[Math.floor(item.date.getTime() / 86400000) % insights.length] : undefined;
            const line = checkInLine(item.kind, voice, { ...facts, insight });
            candidates.push({ identifier: item.id, date: item.date, content: { title: line.title, body: line.body, sound: 'default',
              data: { kind: 'echo-check-in', when: item.kind, url: '/(root)/(tabs)/home' } } });
          }
        }
        // Guided through the day (lib/dayGuide.ts): now, next, a heads-up, meals,
        // events. A habit or task that already has its own reminder at that
        // minute keeps it, without a second one beside it.
        const prefs = await getNotificationPrefs().catch(() => DEFAULT_PREFS);
        let alarmMoments: { at: number; title: string }[] = [];
        if (allowed && prefs.dayGuide) {
          const { currentTodayFlow }: typeof import('./todayFlow') = require('./todayFlow');
          const { guideMoments }: typeof import('./dayGuide') = require('./dayGuide');
          const { morningAlarmAvailable }: typeof import('./morningAlarm') = require('./morningAlarm');
          const flow = await currentTodayFlow(now).catch(() => null);
          if (flow) {
            const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
            const covered = (itemId: string | undefined, date: Date) => !!itemId && candidates.some(other =>
              (other.identifier.includes(itemId)) && Math.abs(other.date.getTime() - date.getTime()) < 3 * 60000);
            // Leave now and Start now ring as alarms where iOS has them (through
            // Silent, and on the Watch): then they are not notifications as well.
            // A build without the alarm call (before runtime 1.0.4) keeps them as notifications.
            const alarmCall = !!(require('@/modules/habyss-live-activity') as typeof import('@/modules/habyss-live-activity')).default?.scheduleMomentAlarms;
            const ringing = prefs.alarms && alarmCall && morningAlarmAvailable();
            for (const moment of guideMoments(flow, now.getHours() * 60 + now.getMinutes(), name)) {
              const date = new Date(midnight.getTime() + moment.at * 60000);
              if (ringing && (moment.kind === 'now' || moment.id.startsWith('guide:leave:'))) {
                alarmMoments.push({ at: date.getTime(), title: moment.title });
                continue;
              }
              if (moment.kind === 'now' && covered(moment.itemId, date)) continue;
              const item = moment.itemId && moment.itemKind ? { [moment.itemKind === 'task' ? 'taskId' : 'habitId']: moment.itemId, scheduledDate: todayKey } : null;
              // Echo says it: leave, start, time's up (lib/echoSounds.ts).
              const spoken = moment.id.startsWith('guide:leave:') ? 'leave' : moment.kind === 'now' ? 'start' : moment.kind === 'end' ? 'end' : null;
              candidates.push({ identifier: moment.id, date, content: {
                title: moment.title, body: moment.body, sound: spoken ? echoSound(spoken, voice) : 'default',
                // The moments you truly need break through Focus and reach the Watch.
                ...(spoken ? { interruptionLevel: 'timeSensitive' as const } : null),
                // About a habit or task: Done, Start focus, In 10 minutes, Skip today;
                // at its end, Done, +10 min, +30 min, Skip today.
                ...(item ? { categoryIdentifier: moment.kind === 'end' ? 'ECHO_TIMES_UP' : 'ECHO_ALIVE' } : null),
                // A habit or task on now opens its focus; anything else, the timeline.
                data: { kind: 'day-guide', url: moment.kind === 'now' ? '/(root)/focus?day=1' : '/(root)/(tabs)/roadmap', ...item },
              } });
            }
          }
        }
        void syncMomentAlarms(alarmMoments);
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
      if (unfinished && action === ACTION.done) { await tasks.setTaskStatus(data.taskId, 'done'); emit('tasks_changed'); }
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
      if (unfinished && action === ACTION.done) await habits.setCompletionValue(data.habitId, measurementFor(habit!).target, date);
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
