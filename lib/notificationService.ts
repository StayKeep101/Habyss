import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { ThemeMode } from '@/constants/themeContext';
import { supabase } from './supabase';

const LOCATION_TASK_NAME = 'HABYSS_GEOFENCING_TASK';

// Define the background task in the global scope
try {
  TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
    if (error) {
      console.error('[Geofencing] Task Error:', error);
      return;
    }
    if (data) {
      const { eventType, region } = data;
      if (eventType === Location.GeofencingEventType.Enter) {
        // Identifier format: "habitId::HabitName::LocationName"
        const parts = region.identifier.split('::');
        if (parts.length >= 3) {
          const [habitId, habitName, locationName] = parts;
          console.log('[Geofencing] Entered region:', region.identifier);

          await Notifications.scheduleNotificationAsync({
            content: {
              title: "Arrived at " + locationName,
              body: `Time to ${habitName}!`,
              sound: 'default',
              data: { habitId, url: `/home?habitId=${habitId}` }
            },
            trigger: null, // Immediate
          });
        }
      }
    }
  });
} catch (e) {
  console.warn('Failed to define task (likely running in unsupported env):', e);
}

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

      // Store to Supabase profiles
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ push_token: pushToken })
          .eq('id', user.id);
      }

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
      const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
      if (fgStatus !== 'granted') return false;

      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      return bgStatus === 'granted';
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
      const hasLocPermission = await this.requestLocationPermissions();
      if (hasLocPermission) {
        const regions = habit.locationReminders.map((loc: any) => ({
          identifier: `${habit.id}::${habit.name}::${loc.name}`,
          latitude: loc.latitude,
          longitude: loc.longitude,
          radius: loc.radius || 100, // Default 100m
          notifyOnEnter: true,
          notifyOnExit: false,
        }));

        try {
          await Location.startGeofencingAsync(LOCATION_TASK_NAME, regions);
          console.log(`[Geofencing] Started monitoring ${regions.length} regions for ${habit.name}`);
        } catch (e) {
          console.warn('[Geofencing] Error starting geofencing:', e);
        }
      } else {
        console.warn('[Geofencing] Missing permissions');
      }
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

    // Cancel Location-based (FIXME: API mismatch for getGeofencedRegionsAsync)
    try {
      const hasStarted = await Location.hasStartedGeofencingAsync(LOCATION_TASK_NAME);
      if (hasStarted) {
        // const regions = await Location.getGeofencedRegionsAsync(LOCATION_TASK_NAME);
        // const regionsToRemove = regions.filter(r => r.identifier && r.identifier.startsWith(habitId + '::'));
        // if (regionsToRemove.length > 0) {
        //   await Location.stopGeofencingAsync(LOCATION_TASK_NAME, regionsToRemove.map(r => r.identifier || ''));
        //   console.log(`[Geofencing] Removed ${regionsToRemove.length} regions for ${habitId}`);
        // }
        console.warn('[Geofencing] Cancellation not fully implemented due to API mismatch');
      }
    } catch (e) {
      console.warn('[Geofencing] Error stopping regions:', e);
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

  static async clearAllNotifications(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error, count } = await supabase
        .from('notifications')
        .delete({ count: 'exact' })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error clearing notifications:', error);
        return false;
      }

      console.log(`Cleared ${count} notifications`);
      return true;
    } catch (e) {
      console.error('Error clearing notifications:', e);
      return false;
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

  // --- Realtime Subscription ---
  static subscribeToRealtimeNotifications(onNotification: (notification: any) => void) {
    // Get current user ID async - wrapping in IIFE or promise handling required by caller?
    // Better to let caller ensure auth or handle inside

    // We'll create a setup function that returns the channel subscription
    const setup = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const channel = supabase
        .channel('public:notifications:' + user.id)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Realtime notification received:', payload);
            if (payload.new) {
              onNotification(payload.new);
            }
          }
        )
        .subscribe();

      return channel;
    };

    return setup();
  }

  static async unsubscribe(channel: any) {
    if (channel) {
      try {
        await supabase.removeChannel(channel);
      } catch (e) {
        console.warn('Error unsubscribing channel:', e);
      }
    }
  }
}
