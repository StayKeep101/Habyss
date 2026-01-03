import { Platform } from 'react-native';
// import { SharedGroupPreferences } from 'react-native-shared-group-preferences'; // Would be used for real iOS widgets
import AsyncStorage from '@react-native-async-storage/async-storage';

const APP_GROUP = 'group.com.habyss.app'; // Replace with your actual App Group ID

export interface WidgetData {
    todayProgress: number;
    streak: number;
    habitsLeft: number;
    topHabitName: string;
}

export const WidgetService = {
    /**
     * Updates the shared data container for the iOS Widget
     */
    async updateTimeline(data: WidgetData) {
        // console.log('WidgetService: Updating timeline with', data);

        try {
            // For now, we'll store it in AsyncStorage as a fallback/debug
            // In a real implementation with the native module linked:
            // await SharedGroupPreferences.setItem('widgetData', data, APP_GROUP);

            await AsyncStorage.setItem('widget_debug_data', JSON.stringify(data));

            if (Platform.OS === 'ios') {
                // Here we would call a native module function to reload the timeline
                // NativeModules.WidgetBridge.reloadAllTimelines();
                // console.log('WidgetService: Requested native timeline reload');
            }
        } catch (error) {
            console.warn('WidgetService: Failed to update widget data', error);
        }
    }
};
