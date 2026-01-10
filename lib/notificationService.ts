import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ThemeMode } from '@/constants/themeContext';
import { supabase } from './supabase';

// IMPORTANT: Do NOT call Notifications APIs at module scope - it crashes iOS!
// setNotificationHandler is now called inside init()

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'habit' | 'streak' | 'achievement' | 'nudge' | 'friend_request' | 'shared_habit';
  timestamp: number;
  read: boolean;
  icon?: string;
  data?: any;
  fromUserId?: string;
}

let isHandlerSet = false;

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

  // --- Inbox Methods (Supabase-backed) ---

  static async getUnreadCount(): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);

      return error ? 0 : (count || 0);
    } catch (e) {
      console.error('Error getting unread count:', e);
      return 0;
    }
  }

  static async getInboxNotifications(): Promise<InAppNotification[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }

      return (data || []).map(n => ({
        id: n.id,
        title: n.title || 'Notification',
        message: n.body || '',
        type: n.type || 'info',
        timestamp: new Date(n.created_at).getTime(),
        read: n.read || false,
        icon: n.icon,
        data: n.data,
        fromUserId: n.from_user_id,
      }));
    } catch (e) {
      console.error('Error in getInboxNotifications:', e);
      return [];
    }
  }

  static async markAllNotificationsRead() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false);
    } catch (e) {
      console.error('Error marking all as read:', e);
    }
  }

  static async clearAllNotifications() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);
    } catch (e) {
      console.error('Error clearing notifications:', e);
    }
  }

  static async markNotificationRead(id: string) {
    try {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', id);
    } catch (e) {
      console.error('Error marking notification as read:', e);
    }
  }

  // Helper to add notification (for local testing or system notifications)
  static async addNotification(notification: { title: string; body: string; type: string; data?: any }) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: notification.title,
          body: notification.body,
          type: notification.type,
          data: notification.data,
          read: false,
          created_at: new Date().toISOString(),
        });
    } catch (e) {
      console.error('Error adding notification:', e);
    }
  }
}
