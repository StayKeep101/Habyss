import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { ThemeMode } from '@/constants/themeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';

// LOCATION_TASK_NAME is now defined in LocationService.ts
// We import it in _layout.tsx to ensure it's registered.

import { LocationService } from './LocationService';

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
            shouldShowAlert: true,
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

  static async scheduleHabitReminder(habit: any) {
    // Clear existing for this habit to avoid duplicates
    await this.cancelHabitReminder(habit.id);

    // 1. Schedule Time-based Reminders
    if (habit.reminders && habit.reminders.length > 0) {
      const hasPermission = await this.requestPermissions();
      if (hasPermission) {
        for (const timeStr of habit.reminders) {
          // timeStr is "HH:MM"
          const [hours, minutes] = timeStr.split(':').map(Number);

          let triggerHour = hours;
          let triggerMinute = minutes;
          let title = "Habyss Reminder";
          let body = `Time to ${habit.name}!`;

          if (habit.reminderOffset && habit.reminderOffset > 0) {
            const totalMinutes = hours * 60 + minutes - habit.reminderOffset;
            // Normalize for day wrap-around (00:00 - 30min -> 23:30)
            const normalized = (totalMinutes + 24 * 60) % (24 * 60);
            triggerHour = Math.floor(normalized / 60);
            triggerMinute = normalized % 60;

            title = `Upcoming: ${habit.name}`;
            body = `${habit.name} starts in ${habit.reminderOffset} minutes.`;
          }

          // Fix trigger type error by using any or correct interface, but simpler is to rely on simple object
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              sound: 'default',
              data: { habitId: habit.id, url: `/home?habitId=${habit.id}` }
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
              hour: triggerHour,
              minute: triggerMinute,
              repeats: true,
            },
          });
        }
      }
    }

    // 2. Schedule Location-based Reminders
    if (habit.locationReminders && habit.locationReminders.length > 0) {
      // We just trigger a full refresh. 
      // In a real app we might want to be more surgical, but given the API limitations, 
      // a full refresh ensures we are always in sync with DB state.
      await LocationService.refreshGeofences();
    }
  }

  static async cancelHabitReminder(habitId: string) {
    // Cancel Time-based
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of pending) {
      if (n.content.data?.habitId === habitId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }

    await LocationService.refreshGeofences();
  }

  static async sendCompletionNotification(habitName: string) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) return;

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
