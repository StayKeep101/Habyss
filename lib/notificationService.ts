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
import { isHabitScheduledForDate, localDateKey } from './habitSchedule';
import { emit, on } from './appEvents';
let reminderQueue: Promise<void> = Promise.resolve();

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

export class NotificationService {
  static async init() {
    // Set notification handler ONLY inside init, never at module scope
    if (!isHandlerSet) {
      try {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
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
      on('tasks_changed', () => {
        this.refreshReminders().catch(() => undefined);
      });
    }

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

      // Store locally (cloud sync will be re-enabled with premium)
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
    // Serialize refreshes so rapid edits cannot create duplicate notification queues.
    const refresh = async () => {
      // Defer loading to avoid the SQLite ↔ notification service dependency cycle.
      const { getHabits, getCompletions }: typeof import('./habitsSQLite') = require('./habitsSQLite');
      try {
        const habits = await getHabits();
        const pending = await Notifications.getAllScheduledNotificationsAsync();
        const isHabitReminder = (item: Notifications.NotificationRequest) =>
          item.content.data?.kind === 'habit-reminder' || (typeof item.content.data?.habitId === 'string' && typeof item.content.data?.url === 'string');
        const isTaskReminder = (item: Notifications.NotificationRequest) => item.content.data?.kind === 'task-reminder';
        const isCheckIn = (item: Notifications.NotificationRequest) => item.content.data?.kind === 'echo-check-in';
        const isOurs = (item: Notifications.NotificationRequest) => isHabitReminder(item) || isTaskReminder(item) || isCheckIn(item);
        const oldReminders = pending.filter(isHabitReminder);
        const oldTaskReminders = pending.filter(isTaskReminder);
        const oldCheckIns = pending.filter(isCheckIn);
        const permission = await Notifications.getPermissionsAsync();
        const allowed = permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
        const today = await getCompletions(localDateKey(new Date()));
        // iOS keeps at most 64 pending notifications. Due dates are scarce and
        // dated, so they are planned first, and habits take what is left: with
        // no tasks, habits still get the whole allowance.
        const budget = Math.max(0, 56 - pending.filter(item => !isOurs(item)).length);

        const { getTasks }: typeof import('./tasks') = require('./tasks');
        const { getDayWindow, suggestedReminder, getEchoConfig }: typeof import('./echo') = require('./echo');
        const tasks = allowed ? await getTasks().catch(() => []) : [];
        const taskPlan = allowed
          ? buildTaskReminderPlan(tasks, new Date(), suggestedReminder(await getDayWindow()), Math.min(16, budget))
          : [];

        const plan = allowed
          ? buildHabitReminderPlan(habits, new Date(), today, Math.min(48, Math.max(0, budget - taskPlan.length)))
          : [];
        // Echo writes the reminders, in the voice and with the name the user chose.
        const { getEchoPersonality, getName }: typeof import('./echo') = require('./echo');
        const { coachReminder }: typeof import('./coachMessages') = require('./coachMessages');
        const echoWriter: typeof import('./echoWriter') = require('./echoWriter');
        const [voice, name] = await Promise.all([getEchoPersonality(), getName()]);
        // Lines Echo wrote on this phone, if it has written any yet. Reading
        // the pool is instant; filling it happens after everything is booked.
        const dayOf = (date: Date) => Math.floor(date.getTime() / 86400000);
        const desired = new Set(plan.map(item => 'habit:' + item.habit.id + ':' + item.date.getTime()));
        const existing = new Set(oldReminders.map(item => item.identifier));
        for (const notification of oldReminders) {
          if (!desired.has(notification.identifier)) await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
        // Echo's own check-ins, if the user asked for them: what today holds in
        // the morning, what is still open before bed.
        const { buildCheckInPlan }: typeof import('./echoCheckIns') = require('./echoCheckIns');
        const { checkInLine }: typeof import('./echoLines') = require('./echoLines');
        const echoConfig = allowed ? await getEchoConfig() : { morning: false, evening: false, useName: true, writeReminders: false };
        // Lines Echo wrote on this phone, if the user asked for them. Reading
        // the pool is instant; filling it happens after everything is booked.
        const written = echoConfig.writeReminders ? await echoWriter.loadWrittenLines() : {};
        const checkIns = allowed ? buildCheckInPlan(echoConfig, await getDayWindow()) : [];

        const wantedCheckIns = new Set(checkIns.map(item => item.id));
        for (const notification of oldCheckIns) {
            if (!wantedCheckIns.has(notification.identifier)) await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
        if (checkIns.length) {
            const scheduledToday = habits.filter(habit =>
                !habit.isGoal && !habit.isArchived && isHabitScheduledForDate(habit, new Date()));
            const doneToday = scheduledToday.filter(habit => today[habit.id]);
            const todayKey = localDateKey(new Date());
            // The day's promise, so the check-ins are about the thing the day
            // is actually for rather than a bare list of what is scheduled.
            const { getDailyTarget, dailyFocus }: typeof import('./dailyFocus') = require('./dailyFocus');
            const focus = dailyFocus(tasks, await getDailyTarget(), todayKey, todayKey);

            const facts = {
                name: echoConfig.useName ? name : undefined,
                total: scheduledToday.length,
                left: scheduledToday.length - doneToday.length,
                next: focus.rows.find(task => task.status === 'open')?.title
                    ?? scheduledToday.find(habit => !today[habit.id])?.name,
                tasksDue: tasks.filter(task => task.status === 'open' && task.dueDate === todayKey).length,
                focusTarget: focus.target,
                focusDone: focus.done,
            };

            for (const item of checkIns) {
                if (oldCheckIns.some(old => old.identifier === item.id)) {
                    await Notifications.cancelScheduledNotificationAsync(item.id);
                }
                const line = checkInLine(item.kind, voice, facts);
                await Notifications.scheduleNotificationAsync({
                    identifier: item.id,
                    content: {
                        title: line.title,
                        body: line.body,
                        sound: 'default',
                        data: { kind: 'echo-check-in', when: item.kind, url: '/(root)/(tabs)/home' },
                    },
                    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: item.date, channelId: 'default' },
                });
            }
        }

        // Tasks: one reminder each, at the time it is due.
        const wantedTasks = new Set(taskPlan.map(item => 'task:' + item.task.id + ':' + item.date.getTime()));
        for (const notification of oldTaskReminders) {
          if (!wantedTasks.has(notification.identifier)) await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
        for (const { task, date } of taskPlan) {
          const identifier = 'task:' + task.id + ':' + date.getTime();
          if (oldTaskReminders.some(item => item.identifier === identifier)) {
            await Notifications.cancelScheduledNotificationAsync(identifier);
          }
          await Notifications.scheduleNotificationAsync({
            identifier,
            content: {
              title: task.title,
              body: echoWriter.pickLine(written, 'task:' + task.id, voice, dayOf(date))
                ?? coachReminder(voice, { habitName: task.title, name }),
              sound: 'default',
              data: { kind: 'task-reminder', taskId: task.id, url: '/(root)/(tabs)/roadmap' },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'default' },
          });
        }

        for (const { habit, date, scheduledDate } of plan) {
          const identifier = 'habit:' + habit.id + ':' + date.getTime();
          // Replace matching IDs too: name, sound, and other content may have changed.
          if (existing.has(identifier)) await Notifications.cancelScheduledNotificationAsync(identifier);
          await Notifications.scheduleNotificationAsync({
            identifier,
            content: {
              title: habit.name,
              body: (habit.reminderOffset ? 'Starts in ' + habit.reminderOffset + ' minutes. ' : '')
                + (echoWriter.pickLine(written, 'habit:' + habit.id, voice, dayOf(date))
                  ?? coachReminder(voice, { habitName: habit.name, name })),
              sound: habit.ringtone === 'silent' || habit.ringtone === 'vibrate' ? false : 'default',
              data: { kind: 'habit-reminder', habitId: habit.id, scheduledDate, url: '/habit-detail?habitId=' + encodeURIComponent(habit.id) },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'default' },
          });
        }
        // Nothing waits on this: the reminders already going out use the
        // written bank, and these lines are for the next refresh.
        if (echoConfig.writeReminders) void echoWriter.topUpWrittenLines([
          ...plan.map(item => ({ key: 'habit:' + item.habit.id, kind: 'habit' as const, name: item.habit.name, person: echoConfig.useName ? name : undefined })),
          ...taskPlan.map(item => ({ key: 'task:' + item.task.id, kind: 'task' as const, name: item.task.title, person: echoConfig.useName ? name : undefined })),
        ], voice).catch(() => undefined);
      } finally {
        // Arrival reminders are independent of time reminders, including on failure.
        await LocationService.refreshGeofences();
      }
    };
    reminderQueue = reminderQueue.catch(() => undefined).then(refresh);
    return reminderQueue;
  }

  /** Habits and tasks are planned together; this is the one entry point. */
  static refreshReminders(): Promise<void> {
    return this.refreshHabitReminders();
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
