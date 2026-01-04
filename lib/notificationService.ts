import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit } from './habits';

// Constants
const NOTIFICATION_ENABLED_KEY = 'habyss_notifications_enabled';
const QUIET_HOURS_ENABLED_KEY = 'habyss_quiet_hours_enabled';
const QUIET_HOURS_START_KEY = 'habyss_quiet_hours_start'; // HH:mm
const QUIET_HOURS_END_KEY = 'habyss_quiet_hours_end';     // HH:mm
const HABIT_NOTIFICATION_MAP_KEY = 'habyss_habit_notification_map';

const DEFAULT_QUIET_HOURS_START = '22:00';
const DEFAULT_QUIET_HOURS_END = '07:00';

// Global Configuration - Move inside init or handle safely
let isInitialized = false;

/**
 * Safely get the Notifications module
 */
function getNotifications() {
  if (Platform.OS === 'web') return null;

  // Check if the native module is actually registered to avoid hard crashes
  const hasNativeModule = NativeModules.ExpoPushTokenManager ||
    NativeModules.ExponentNotifications ||
    NativeModules.Notifications;

  if (!hasNativeModule) {
    return null;
  }

  try {
    return require('expo-notifications');
  } catch (e) {
    return null;
  }
}

/**
 * Safely get the Device module
 */
function getDevice() {
  if (Platform.OS === 'web') return null;

  // Check for ExpoDevice native module
  if (!NativeModules.ExpoDevice && !NativeModules.ExponentDevice) {
    return null;
  }

  try {
    return require('expo-device');
  } catch (e) {
    return null;
  }
}

export class NotificationService {
  /**
   * Initialize notification channels (Android only) and handler
   */
  static async init() {
    if (isInitialized) return;

    const Notifications = getNotifications();
    if (!Notifications) return;

    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('habit-reminders', {
          name: 'Habit Reminders',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }
      isInitialized = true;
    } catch (error) {
      console.warn('NotificationService: Failed to initialize. Native module might be missing.', error);
    }
  }

  /**
   * Request permissions for notifications
   */
  /**
   * Register for push notifications and get the token
   */
  static async registerForPushNotificationsAsync(): Promise<string | null> {
    if (Platform.OS === 'web') return null;

    const Device = getDevice();
    const Notifications = getNotifications();

    // Lazy load Constants to avoid web issues if handled conditionally
    let Constants: any;
    try {
      Constants = require('expo-constants').default;
    } catch (e) {
      console.log('Constants not available');
      return null;
    }

    if (!Device || !Notifications) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('habit-reminders', {
        name: 'Habit Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });

      // Also set a default channel as per guide
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }

    if (Device.isDevice) {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        console.log('Permission not granted to get push token for push notification!');
        await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'false');
        return null;
      }

      await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, 'true');

      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

      if (!projectId) {
        console.log('Project ID not found');
        // We can still try without project ID, but it's recommended
      }

      try {
        const pushTokenString = (
          await Notifications.getExpoPushTokenAsync({
            projectId,
          })
        ).data;
        console.log('Expo Push Token:', pushTokenString);
        return pushTokenString;
      } catch (e) {
        console.error(`${e}`);
        return null;
      }
    } else {
      console.log('Must use physical device for push notifications');
      return null;
    }
  }

  /**
   * Check if notifications are enabled
   */
  static async areNotificationsEnabled(): Promise<boolean> {
    const enabled = await AsyncStorage.getItem(NOTIFICATION_ENABLED_KEY);
    return enabled ? JSON.parse(enabled) : false;
  }

  /**
   * Toggle notifications
   */
  static async setNotificationsEnabled(enabled: boolean) {
    await AsyncStorage.setItem(NOTIFICATION_ENABLED_KEY, JSON.stringify(enabled));
    if (!enabled) {
      await this.cancelAllReminders();
    }
  }

  /**
   * Quiet Hours Logic
   */
  static async isQuietHoursEnabled(): Promise<boolean> {
    const enabled = await AsyncStorage.getItem(QUIET_HOURS_ENABLED_KEY);
    return enabled ? JSON.parse(enabled) : true; // Default true
  }

  static async getQuietHours() {
    const start = await AsyncStorage.getItem(QUIET_HOURS_START_KEY) || DEFAULT_QUIET_HOURS_START;
    const end = await AsyncStorage.getItem(QUIET_HOURS_END_KEY) || DEFAULT_QUIET_HOURS_END;
    return { start, end };
  }

  static async setQuietHours(start: string, end: string) {
    await AsyncStorage.setItem(QUIET_HOURS_START_KEY, start);
    await AsyncStorage.setItem(QUIET_HOURS_END_KEY, end);
  }

  static async setQuietHoursEnabled(enabled: boolean) {
    await AsyncStorage.setItem(QUIET_HOURS_ENABLED_KEY, JSON.stringify(enabled));
  }

  private static isTimeInQuietHours(timeStr: string, quietStart: string, quietEnd: string): boolean {
    const [hour, minute] = timeStr.split(':').map(Number);
    const [startH, startM] = quietStart.split(':').map(Number);
    const [endH, endM] = quietEnd.split(':').map(Number);

    const time = hour * 60 + minute;
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;

    if (start < end) {
      return time >= start && time <= end;
    } else {
      // Overlays midnight (e.g., 22:00 - 07:00)
      return time >= start || time <= end;
    }
  }

  /**
   * Map Management
   */
  private static async getNotificationMap(): Promise<Record<string, string[]>> {
    const map = await AsyncStorage.getItem(HABIT_NOTIFICATION_MAP_KEY);
    return map ? JSON.parse(map) : {};
  }

  private static async saveNotificationMap(map: Record<string, string[]>) {
    await AsyncStorage.setItem(HABIT_NOTIFICATION_MAP_KEY, JSON.stringify(map));
  }

  /**
   * Schedule Habit Reminder
   */
  static async scheduleHabitReminder(habit: Habit) {
    const Notifications = getNotifications();
    if (!Notifications) return;

    if (!(await this.areNotificationsEnabled())) return;

    // First cancel existing ones for this habit
    await this.cancelHabitReminder(habit.id);

    if (!habit.reminders || habit.reminders.length === 0) return;

    const { start: qStart, end: qEnd } = await this.getQuietHours();
    const quietEnabled = await this.isQuietHoursEnabled();
    const notificationIds: string[] = [];

    // Schedule regular reminders
    for (const timeStr of habit.reminders) {
      let [hour, minute] = timeStr.split(':').map(Number);

      // Respect Quiet Hours
      if (quietEnabled && this.isTimeInQuietHours(timeStr, qStart, qEnd)) {
        // Delay to just after quiet hours end
        [hour, minute] = qEnd.split(':').map(Number);
        // Add 1 minute to be safe
        minute += 1;
        if (minute >= 60) {
          minute = 0;
          hour = (hour + 1) % 24;
        }
      }

      try {
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Habyss Reminder',
            body: `Time for your habit: ${habit.name}!`,
            data: { habitId: habit.id },
          },
          trigger: {
            hour,
            minute,
            repeats: true,
          } as any,
        });
        notificationIds.push(id);
      } catch (e) {
        console.warn('Failed to schedule notification', e);
      }
    }

    // Schedule Smart Motivation (7PM)
    try {
      const motivationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Stay Consistent!',
          body: `Don't forget to complete "${habit.name}" today!`,
          data: { habitId: habit.id, type: 'motivation' },
        },
        trigger: {
          hour: 19,
          minute: 0,
          repeats: true,
        } as any,
      });
      notificationIds.push(motivationId);
    } catch (e) {
      console.warn('Failed to schedule motivation notification', e);
    }

    const map = await this.getNotificationMap();
    map[habit.id] = notificationIds;
    await this.saveNotificationMap(map);
  }

  /**
   * Cancel Habit Reminder
   */
  static async cancelHabitReminder(habitId: string) {
    const Notifications = getNotifications();
    if (!Notifications) return;

    const map = await this.getNotificationMap();
    const notificationIds = map[habitId];

    if (notificationIds) {
      for (const id of notificationIds) {
        try {
          await Notifications.cancelScheduledNotificationAsync(id);
        } catch (e) {
          console.log(`Failed to cancel notification ${id}`, e);
        }
      }
      delete map[habitId];
      await this.saveNotificationMap(map);
    }
  }

  /**
   * Cancel All Reminders
   */
  static async cancelAllReminders() {
    const Notifications = getNotifications();
    if (!Notifications) return;

    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (e) {
      console.warn('Failed to cancel all notifications', e);
    }
    await AsyncStorage.removeItem(HABIT_NOTIFICATION_MAP_KEY);
  }

  /**
   * Send notification when a habit is completed
   */
  static async sendCompletionNotification(habitName: string) {
    const Notifications = getNotifications();
    if (!Notifications) return;

    if (!(await this.areNotificationsEnabled())) return;

    const messages = [
      `Great job completing ${habitName}!`,
      `Keep it up! ${habitName} done.`,
      `You're on fire! ${habitName} completed.`,
      `Habyss streak growing! ${habitName} finished.`,
      `One step closer to your goals!`,
      `Victory! ${habitName} crushed.`,
    ];

    const randomMessage = messages[Math.floor(Math.random() * messages.length)];

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Habit Completed! 🎉',
          body: randomMessage,
          sound: true,
        },
        trigger: null, // Send immediately
      });
    } catch (e) {
      console.warn('Failed to send immediate motivation', e);
    }
  }

  /**
   * Send notification when integration syncs successfully
   */
  static async sendIntegrationSyncNotification(serviceName: string, habitName?: string) {
    const Notifications = getNotifications();
    if (!Notifications) return;

    const serviceDisplayNames: Record<string, string> = {
      'apple-health': 'Apple Health',
      'strava': 'Strava',
      'spotify': 'Spotify',
      'duolingo': 'Duolingo',
      'plaid': 'Plaid',
      'garmin': 'Garmin',
      'kindle': 'Kindle'
    };

    const displayName = serviceDisplayNames[serviceName] || serviceName;
    const body = habitName
      ? `${displayName} synced and completed "${habitName}"!`
      : `${displayName} data synced successfully`;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Integration Synced',
          body,
        },
        trigger: null,
      });
    } catch (e) {
      console.warn('Failed to send integration sync notification', e);
    }
  }

  /**
   * Send notification when integration sync fails
   */
  static async sendIntegrationErrorNotification(serviceName: string, error: string) {
    const Notifications = getNotifications();
    if (!Notifications) return;

    const serviceDisplayNames: Record<string, string> = {
      'apple-health': 'Apple Health',
      'strava': 'Strava',
      'spotify': 'Spotify',
      'duolingo': 'Duolingo',
      'plaid': 'Plaid',
      'garmin': 'Garmin',
      'kindle': 'Kindle'
    };

    const displayName = serviceDisplayNames[serviceName] || serviceName;

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Sync Error',
          body: `Failed to sync ${displayName}: ${error}`,
        },
        trigger: null,
      });
    } catch (e) {
      console.warn('Failed to send error notification', e);
    }
  }

  // ===== IN-APP NOTIFICATION INBOX =====

  static readonly INBOX_KEY = 'habyss_notification_inbox';

  static async getInboxNotifications(): Promise<InAppNotification[]> {
    try {
      const data = await AsyncStorage.getItem(this.INBOX_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to get inbox notifications', e);
      return [];
    }
  }

  static async addInboxNotification(notification: Omit<InAppNotification, 'id' | 'timestamp' | 'read'>): Promise<void> {
    try {
      const existing = await this.getInboxNotifications();
      const newNotification: InAppNotification = {
        ...notification,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        read: false,
      };
      // Keep last 50 notifications
      const updated = [newNotification, ...existing].slice(0, 50);
      await AsyncStorage.setItem(this.INBOX_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to add inbox notification', e);
    }
  }

  static async markNotificationRead(id: string): Promise<void> {
    try {
      const notifications = await this.getInboxNotifications();
      const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
      await AsyncStorage.setItem(this.INBOX_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to mark notification read', e);
    }
  }

  static async markAllNotificationsRead(): Promise<void> {
    try {
      const notifications = await this.getInboxNotifications();
      const updated = notifications.map(n => ({ ...n, read: true }));
      await AsyncStorage.setItem(this.INBOX_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to mark all notifications read', e);
    }
  }

  static async clearAllNotifications(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.INBOX_KEY, JSON.stringify([]));
    } catch (e) {
      console.warn('Failed to clear notifications', e);
    }
  }

  static async getUnreadCount(): Promise<number> {
    const notifications = await this.getInboxNotifications();
    return notifications.filter(n => !n.read).length;
  }

  static async deleteNotification(id: string): Promise<void> {
    try {
      const notifications = await this.getInboxNotifications();
      const updated = notifications.filter(n => n.id !== id);
      await AsyncStorage.setItem(this.INBOX_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to delete notification', e);
    }
  }
}

// In-app notification type
export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  icon: string;
  read: boolean;
  type: 'success' | 'info' | 'warning' | 'habit' | 'streak' | 'achievement';
}
