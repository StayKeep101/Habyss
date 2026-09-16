import * as Notifications from 'expo-notifications';
import { Platform, DeviceEventEmitter } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// LOCATION_TASK_NAME is now defined in LocationService.ts
// We import it in _layout.tsx to ensure it's registered.

import { LocationService } from './LocationService';
import type { Habit } from './habitsSQLite';
import { buildHabitReminderPlan } from './habitReminders';
import { localDateKey } from './habitSchedule';
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
  DeviceEventEmitter.emit('notifications_updated', {
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
        const oldReminders = pending.filter(isHabitReminder);
        const permission = await Notifications.getPermissionsAsync();
        const allowed = permission.granted || permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
        const today = await getCompletions(localDateKey(new Date()));
        const budget = Math.max(0, 56 - pending.filter(item => !isHabitReminder(item)).length);
        const plan = allowed ? buildHabitReminderPlan(habits, new Date(), today, Math.min(48, budget)) : [];
        const desired = new Set(plan.map(item => 'habit:' + item.habit.id + ':' + item.date.getTime()));
        const existing = new Set(oldReminders.map(item => item.identifier));
        for (const notification of oldReminders) {
          if (!desired.has(notification.identifier)) await Notifications.cancelScheduledNotificationAsync(notification.identifier);
        }
        for (const { habit, date, scheduledDate } of plan) {
          const identifier = 'habit:' + habit.id + ':' + date.getTime();
          // Replace matching IDs too: name, sound, and other content may have changed.
          if (existing.has(identifier)) await Notifications.cancelScheduledNotificationAsync(identifier);
          await Notifications.scheduleNotificationAsync({
            identifier,
            content: {
              title: habit.name,
              body: habit.reminderOffset ? 'Your habit starts in ' + habit.reminderOffset + ' minutes.' : 'A little progress starts here.',
              sound: habit.ringtone === 'silent' || habit.ringtone === 'vibrate' ? false : 'default',
              data: { kind: 'habit-reminder', habitId: habit.id, scheduledDate, url: '/habit-detail?habitId=' + encodeURIComponent(habit.id) },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'default' },
          });
        }
      } finally {
        // Arrival reminders are independent of time reminders, including on failure.
        await LocationService.refreshGeofences();
      }
    };
    reminderQueue = reminderQueue.catch(() => undefined).then(refresh);
    return reminderQueue;
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
    DeviceEventEmitter.emit('notifications_updated', { unreadCount: 0 });
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
