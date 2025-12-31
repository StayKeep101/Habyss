import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';

const WIDGET_DATA_KEY = 'habyss_widget_data';
const APP_GROUP_ID = 'group.com.habyss.app';

export interface WidgetData {
  completedHabitsToday: number;
  totalHabitsToday: number;
  streakDays: number;
  lastUpdated: number;
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
  /**
   * Updates the shared storage with the latest habit progress.
   */
  static async updateWidgetData(data: Omit<WidgetData, 'lastUpdated'>) {
    const widgetData: WidgetData = {
      ...data,
      lastUpdated: Date.now(),
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
