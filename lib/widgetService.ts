import { Platform, NativeModules } from 'react-native';

const { SharedDefaults: SharedDefaultsModule } = NativeModules;

export interface WidgetData {
    todayProgress: number;
    streak: number;
    habitsLeft: number;
    topHabitName: string;
}

export interface WidgetHabit {
    id: string;
    name: string;
    isCompleted: boolean;
}

export const WidgetService = {
    /**
     * Syncs the current habits list to the iOS widget via App Group UserDefaults.
     * The widget reads from the "habitsData" key in group.com.habyss.data.
     */
    async syncHabitsToWidget(habits: WidgetHabit[]): Promise<void> {
        if (Platform.OS !== 'ios' || !SharedDefaultsModule) return;

        try {
            const habitsJson = JSON.stringify(habits);
            await SharedDefaultsModule.set('habitsData', habitsJson);
            await SharedDefaultsModule.reloadTimelines();
        } catch (error) {
            console.warn('WidgetService: Failed to sync habits to widget', error);
        }
    },

    /**
     * Updates the shared data container for the iOS Widget with summary stats.
     */
    async updateTimeline(data: WidgetData): Promise<void> {
        if (Platform.OS !== 'ios' || !SharedDefaultsModule) return;

        try {
            await SharedDefaultsModule.set('todayProgress', String(data.todayProgress));
            await SharedDefaultsModule.set('streakCount', String(data.streak));
            await SharedDefaultsModule.set('habitsLeft', String(data.habitsLeft));
            await SharedDefaultsModule.set('topHabitName', data.topHabitName);
            await SharedDefaultsModule.reloadTimelines();
        } catch (error) {
            console.warn('WidgetService: Failed to update widget data', error);
        }
    },

    /**
     * Forces a widget timeline reload without changing data.
     */
    async reloadTimelines(): Promise<void> {
        if (Platform.OS !== 'ios' || !SharedDefaultsModule) return;

        try {
            await SharedDefaultsModule.reloadTimelines();
        } catch (error) {
            console.warn('WidgetService: Failed to reload timelines', error);
        }
    },
};
