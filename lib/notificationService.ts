import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ThemeMode } from '@/constants/themeContext';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'habit' | 'streak' | 'achievement';
  timestamp: number;
  read: boolean;
  icon?: string;
  data?: any;
}

// Mock In-Memory Store for Inbox (since we don't have a backend for this specifically yet)
let inbox: InAppNotification[] = [
  {
    id: '1',
    title: 'Welcome to Habyss',
    message: 'Start your journey by creating your first habit.',
    type: 'info',
    timestamp: Date.now() - 100000,
    read: false,
    icon: 'information-circle'
  }
];

export class NotificationService {
  static async init() {
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

  static async registerForPushNotificationsAsync() {
    // Just request permissions for now
    return await this.requestPermissions();
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

  static async scheduleHabitReminder(habit: any) {
    if (!habit.reminders || habit.reminders.length === 0) return;

    // Clear existing for this habit to avoid duplicates
    await this.cancelHabitReminder(habit.id);

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) return;

    for (const timeStr of habit.reminders) {
      // timeStr is "HH:MM"
      const [hours, minutes] = timeStr.split(':').map(Number);

      // Fix trigger type error by using any or correct interface, but simpler is to rely on simple object
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Habyss Reminder",
          body: `Time to ${habit.name}!`,
          sound: 'default',
          data: { habitId: habit.id, url: `/home?habitId=${habit.id}` }
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
          hour: hours,
          minute: minutes,
          repeats: true,
        },
      });
    }
  }

  static async cancelHabitReminder(habitId: string) {
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of pending) {
      if (n.content.data?.habitId === habitId) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  }

  static async sendCompletionNotification(habitName: string) {
    // Optional local notification
  }

  // --- Inbox Methods ---

  static async getUnreadCount(): Promise<number> {
    return inbox.filter(n => !n.read).length;
  }

  static async getInboxNotifications(): Promise<InAppNotification[]> {
    return [...inbox].sort((a, b) => b.timestamp - a.timestamp);
  }

  static async markAllNotificationsRead() {
    inbox = inbox.map(n => ({ ...n, read: true }));
  }

  static async clearAllNotifications() {
    inbox = [];
  }

  static async markNotificationRead(id: string) {
    inbox = inbox.map(n => n.id === id ? { ...n, read: true } : n);
  }

  // Helper to add fake notification for testing
  static async addTestNotification(notification: Omit<InAppNotification, 'id' | 'timestamp' | 'read'>) {
    inbox.push({
      ...notification,
      id: Math.random().toString(),
      timestamp: Date.now(),
      read: false
    });
  }
}
