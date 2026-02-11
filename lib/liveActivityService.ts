import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACTIVITY_ID_KEY = '@habyss_live_activity_id';

// Dynamically import to avoid crashes on Android
let LiveActivity: typeof import('expo-live-activity') | null = null;
if (Platform.OS === 'ios') {
    try {
        LiveActivity = require('expo-live-activity');
    } catch (e) {
        console.warn('expo-live-activity not available:', e);
    }
}

export interface DailyProgress {
    completed: number;
    total: number;
    topHabitName?: string;
    streakDays?: number;
}

export const LiveActivityService = {
    /**
     * Start or update the daily progress Live Activity.
     * Shows habit progress on Lock Screen and Dynamic Island.
     */
    async startDailyProgress(stats: DailyProgress): Promise<void> {
        if (!LiveActivity || Platform.OS !== 'ios') return;

        try {
            // Check if we already have an active Live Activity
            const existingId = await AsyncStorage.getItem(ACTIVITY_ID_KEY);
            if (existingId) {
                // Update existing activity instead of creating a new one
                await this.updateProgress(stats);
                return;
            }

            const progress = stats.total > 0 ? stats.completed / stats.total : 0;
            const subtitle = stats.streakDays
                ? `🔥 ${stats.streakDays} day streak`
                : stats.topHabitName
                    ? `Next: ${stats.topHabitName}`
                    : 'Keep going!';

            const activityId = LiveActivity.startActivity(
                {
                    title: `${stats.completed}/${stats.total} Habits Done`,
                    subtitle,
                    progressBar: { progress },
                },
                {
                    backgroundColor: '#0A0A0F',
                    titleColor: '#FFFFFF',
                    subtitleColor: '#EBEBF099',
                    progressViewTint: '#38ACDD',
                    progressViewLabelColor: '#FFFFFF',
                    deepLinkUrl: '/home',
                    padding: { horizontal: 20, top: 16, bottom: 16 },
                }
            );

            if (activityId) {
                await AsyncStorage.setItem(ACTIVITY_ID_KEY, activityId);
                console.log('Live Activity started:', activityId);
            }
        } catch (e) {
            console.warn('Failed to start Live Activity:', e);
        }
    },

    /**
     * Update the Live Activity with new progress.
     * Called after each habit completion.
     */
    async updateProgress(stats: DailyProgress): Promise<void> {
        if (!LiveActivity || Platform.OS !== 'ios') return;

        try {
            const activityId = await AsyncStorage.getItem(ACTIVITY_ID_KEY);
            if (!activityId) return;

            const progress = stats.total > 0 ? stats.completed / stats.total : 0;
            const subtitle = stats.completed >= stats.total
                ? '✅ All done for today!'
                : stats.topHabitName
                    ? `Next: ${stats.topHabitName}`
                    : `${stats.total - stats.completed} remaining`;

            LiveActivity.updateActivity(activityId, {
                title: `${stats.completed}/${stats.total} Habits Done`,
                subtitle,
                progressBar: { progress },
            });

            // Auto-stop when all habits are complete
            if (stats.completed >= stats.total && stats.total > 0) {
                // Keep it visible for a bit longer, then stop
                setTimeout(() => this.stopActivity(), 30000); // 30s celebration
            }
        } catch (e) {
            console.warn('Failed to update Live Activity:', e);
        }
    },

    /**
     * Stop the Live Activity.
     */
    async stopActivity(): Promise<void> {
        if (!LiveActivity || Platform.OS !== 'ios') return;

        try {
            const activityId = await AsyncStorage.getItem(ACTIVITY_ID_KEY);
            if (!activityId) return;

            LiveActivity.stopActivity(activityId, {
                title: 'Great job today! 🎉',
                subtitle: 'See you tomorrow',
                progressBar: { progress: 1.0 },
            });

            await AsyncStorage.removeItem(ACTIVITY_ID_KEY);
            console.log('Live Activity stopped');
        } catch (e) {
            console.warn('Failed to stop Live Activity:', e);
        }
    },

    /**
     * Check if a Live Activity is currently running.
     */
    async isActive(): Promise<boolean> {
        const id = await AsyncStorage.getItem(ACTIVITY_ID_KEY);
        return id !== null;
    },
};
