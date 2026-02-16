import { Platform, NativeModules } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { SharedDefaults } = NativeModules;
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
    // New fields for timer
    activeHabitName?: string;
    targetDate?: number; // timestamp in ms
    profilePicture?: string; // local file path or base64
    habits?: { id: string; name: string; isCompleted: boolean }[];
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
            const subtitle = stats.activeHabitName
                ? 'Focusing...'
                : stats.streakDays
                    ? `🔥 ${stats.streakDays} day streak`
                    : stats.topHabitName
                        ? `Next: ${stats.topHabitName}`
                        : 'Keep going!';

            const title = stats.activeHabitName || `${stats.completed}/${stats.total} Habits Done`;

            let profileImagePath: string | undefined;

            if (stats.profilePicture && SharedDefaults.saveImage) {
                try {
                    // Extract base64 if it's a data URL, otherwise assume it's raw base64
                    const base64 = stats.profilePicture.includes('base64,')
                        ? stats.profilePicture.split('base64,')[1]
                        : stats.profilePicture;

                    // Simple hash or timestamp for filename to avoid collisions/caching issues if needed, 
                    // but for a profile pic, 'current_profile.jpg' might be enough or 'profile_<habit_id>.jpg'
                    const fileName = 'live_activity_profile.jpg';
                    profileImagePath = await SharedDefaults.saveImage(base64, fileName);
                    console.log('Saved profile image to:', profileImagePath);
                } catch (e) {
                    console.warn('Failed to save profile image:', e);
                }
            }

            console.log('Starting Activity with targetDate:', stats.targetDate);
            const activityId = LiveActivity.startActivity(
                {
                    name: 'Habyss Live Activity',
                    totalDurationSeconds: stats.targetDate ? (stats.targetDate - Date.now()) / 1000 : undefined,
                    // Extra fields ignored by Swift but useful for reference
                    backgroundColor: '#0A0A0F',
                } as any,
                {
                    title,
                    subtitle,
                    timerEndDateInMilliseconds: stats.targetDate,
                    progress,
                    profileImagePath,
                } as any
            );

            if (activityId) {
                await AsyncStorage.setItem(ACTIVITY_ID_KEY, activityId);
                console.log('Live Activity started:', activityId);
            }

            // Sync to Widget
            this.syncToWidget(stats);
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

            // Check if activity is still valid on the native side to avoid "ActivityNotFoundException" logs
            // (We patched expo-live-activity to include this method)
            if ((LiveActivity as any)?.listActivities) {
                try {
                    const activeIds = await (LiveActivity as any).listActivities();
                    if (Array.isArray(activeIds) && !activeIds.includes(activityId)) {
                        console.log('Live Activity not found in active list, clearing local ID.');
                        await AsyncStorage.removeItem(ACTIVITY_ID_KEY);
                        return;
                    }
                } catch (err) {
                    console.warn('Failed to list activities:', err);
                }
            }

            const progress = stats.total > 0 ? stats.completed / stats.total : 0;

            let title = `${stats.completed}/${stats.total} Habits Done`;
            let subtitle = stats.completed >= stats.total
                ? '✅ All done for today!'
                : stats.topHabitName
                    ? `Next: ${stats.topHabitName}`
                    : `${stats.total - stats.completed} remaining`;

            if (stats.activeHabitName) {
                title = stats.activeHabitName;
                subtitle = 'Focusing...';
            }

            let profileImagePath: string | undefined;
            if (stats.profilePicture && SharedDefaults.saveImage) {
                try {
                    const base64 = stats.profilePicture.includes('base64,')
                        ? stats.profilePicture.split('base64,')[1]
                        : stats.profilePicture;
                    const fileName = 'live_activity_profile.jpg';
                    profileImagePath = await SharedDefaults.saveImage(base64, fileName);
                } catch (e) {
                    console.warn('Failed to save profile image:', e);
                }
            }

            LiveActivity.updateActivity(activityId, {
                title,
                subtitle,
                timerEndDateInMilliseconds: stats.targetDate || null,
                progress: progress,
                profileImagePath,
            } as any);

            // Auto-stop when all habits are complete
            if (stats.completed >= stats.total && stats.total > 0) {
                // Keep it visible for a bit longer, then stop
                setTimeout(() => this.stopActivity(), 30000); // 30s celebration
            }

            // Sync to Widget
            this.syncToWidget(stats);
        } catch (e: any) {
            // If the activity is not found (e.g. user killed it or reinstall), clear our local ID so we can start a new one next time
            if (e?.message?.includes('ActivityNotFound') || e?.message?.includes('not found')) {
                console.log('Live Activity not found on device, clearing local ID.');
                await AsyncStorage.removeItem(ACTIVITY_ID_KEY);
            } else {
                console.warn('Failed to update Live Activity:', e);
            }
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
            } as any);

            await AsyncStorage.removeItem(ACTIVITY_ID_KEY);
            console.log('Live Activity stopped');

            // Clear Widget active state
            if (SharedDefaults) {
                SharedDefaults.set('activeHabitName', 'No Active Habit');
                SharedDefaults.set('todayStats', 'Great job today!');
                await SharedDefaults.reloadTimelines();
            }

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

    /**
     * Sync data to App Group for Home Screen Widget
     */
    syncToWidget(stats: DailyProgress) {
        if (!SharedDefaults) return;

        const habitName = stats.activeHabitName || 'No Active Habit';
        const status = stats.activeHabitName
            ? 'Focusing...'
            : `${stats.completed}/${stats.total} Habits`;

        SharedDefaults.set('activeHabitName', habitName);
        SharedDefaults.set('todayStats', status);

        if (stats.targetDate) {
            SharedDefaults.set('timerEndDate', stats.targetDate);
        } else {
            SharedDefaults.set('timerEndDate', null); // Clear if no timer
        }

        if (stats.habits) {
            try {
                const habitsJson = JSON.stringify(stats.habits);
                SharedDefaults.set('habitsData', habitsJson);
            } catch (e) {
                console.warn('Failed to serialize habits for widget:', e);
            }
        }
    }
};
