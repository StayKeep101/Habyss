import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

const WIDGET_DATA_KEY = 'habyss_widget_data';
const APP_GROUP_ID = 'group.com.habyss.app';

export interface WidgetHabit {
  id: string;
  name: string;
  completed: boolean;
  category: string;
  icon: string;
}

export interface WidgetData {
  completedHabitsToday: number;
  totalHabitsToday: number;
  streakDays: number;
  lastUpdated: number;
  quote?: {
    text: string;
    author: string;
  };
  todayHabits: WidgetHabit[];
  nextHabit?: WidgetHabit;
  motivationalMessage?: string;
}

/**
 * Safely get the SecureStore module
 */
function getSecureStore() {
  if (Platform.OS === 'web') return null;

  // Check if the native module is actually registered
  if (!NativeModules.ExpoSecureStore && !NativeModules.ExponentSecureStore) {
    return null;
  }

  try {
    return require('expo-secure-store');
  } catch (e) {
    return null;
  }
}

/**
 * Utility for syncing data between the app and the home screen widgets.
 */
export class WidgetSync {
  private static readonly QUOTES = [
    { text: "The secret of your future is hidden in your daily routine.", author: "Mike Murdock" },
    { text: "Habits are the compound interest of self-improvement.", author: "James Clear" },
    { text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
    { text: "Success is the sum of small efforts, repeated day in and day out.", author: "Robert Collier" },
    { text: "First we make our habits, then our habits make us.", author: "John Dryden" },
    { text: "Motivation is what gets you started. Habit is what keeps you going.", author: "Jim Ryun" },
    { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
    { text: "The chains of habit are too light to be felt until they are too heavy to be broken.", author: "Warren Buffett" },
    { text: "Small habits make a big difference.", author: "Anonymous" },
    { text: "Your life does not get better by chance, it gets better by change.", author: "Jim Rohn" }
  ];

  private static getMotivationalMessage(completed: number, total: number): string {
    if (total === 0) return "Ready to start your day?";
    const progress = completed / total;
    if (progress === 1) return "Perfect day! You're crushing it! 🎉";
    if (progress >= 0.75) return "Almost there! Just a bit more.";
    if (progress >= 0.5) return "Halfway through. Keep the momentum!";
    if (progress > 0) return "Great start! Keep going.";
    return "Time to take the first step today.";
  }

  private static getRandomQuote() {
    return this.QUOTES[Math.floor(Math.random() * this.QUOTES.length)];
  }

  /**
   * Updates the shared storage with the latest habit progress.
   */
  static async updateWidgetData(data: Omit<WidgetData, 'lastUpdated' | 'quote' | 'motivationalMessage'>) {
    const widgetData: WidgetData = {
      ...data,
      lastUpdated: Date.now(),
      quote: this.getRandomQuote(),
      motivationalMessage: this.getMotivationalMessage(data.completedHabitsToday, data.totalHabitsToday),
    };

    try {
      // 1. Sync to AsyncStorage for internal app use
      await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(widgetData));

      // 2. Sync to platform-specific shared storage for widgets
      if (Platform.OS === 'ios') {
        const SecureStore = getSecureStore();
        if (SecureStore) {
          try {
            await SecureStore.setItemAsync(WIDGET_DATA_KEY, JSON.stringify(widgetData), {
              keychainService: APP_GROUP_ID,
            });
          } catch (e) {
            console.warn('WidgetSync: Failed to sync to SecureStore (iOS App Group might not be configured yet)', e);
          }
        }
      }

      // 3. Trigger a widget refresh if a native module is available
      this.refreshWidgets();
      
      console.log('WidgetSync: Data updated successfully', widgetData);
    } catch (error) {
      console.error('WidgetSync: Error updating widget data', error);
    }
  }

  /**
   * Retrieves the current widget data from storage.
   */
  static async getWidgetData(): Promise<WidgetData | null> {
    try {
      const data = await AsyncStorage.getItem(WIDGET_DATA_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('WidgetSync: Error getting widget data', error);
      return null;
    }
  }

  /**
   * Forces the OS to refresh the home screen widgets.
   */
  static refreshWidgets() {
    // This usually requires a native module to call:
    // iOS: WidgetCenter.shared.reloadAllTimelines()
    // Android: WidgetManager.updateAppWidget()
    
    // For now, we'll log it. If a native module is added later, we'll call it here.
    if (Platform.OS === 'ios') {
       // Future: NativeModules.WidgetCenterModule?.reloadAllTimelines();
    } else if (Platform.OS === 'android') {
       // Future: NativeModules.WidgetModule?.refresh();
    }
    console.log('WidgetSync: Refresh requested');
  }
}
