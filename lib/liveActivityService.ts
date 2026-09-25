import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SharedDefaults from './SharedDefaults';
import HabyssLiveActivity from '@/modules/habyss-live-activity';
const ACTIVITY_ID_KEY = '@habyss_live_activity_id';

// Local ActivityKit module (modules/habyss-live-activity); null on Android and in Expo Go
const LiveActivity = Platform.OS === 'ios' ? HabyssLiveActivity : null;

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

function syncWidgetSummary(stats: DailyProgress) {
    if (!SharedDefaults) return;
    SharedDefaults.set('widgetSummary', JSON.stringify({
        total: stats.total,
        completed: stats.completed,
    })).catch(() => { });
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

            // A day that asks for nothing has nothing to put on the Lock
            // Screen, and a card reading "0/0" is worse than no card. The
            // widget still gets the day either way.
            if (stats.total === 0 && !stats.activeHabitName) {
                this.syncToWidget(stats);
                return;
            }

            // Turned off in Settings; asking anyway just throws every time.
            if (!LiveActivity.areActivitiesEnabled()) {
                this.syncToWidget(stats);
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

            const title = stats.activeHabitName || `${stats.completed}/${stats.total} done today`;

            const profileImagePath: string | undefined = undefined;

            console.log('Starting Activity with targetDate:', stats.targetDate);
            const activityId = LiveActivity.startActivity(
                {
                    name: 'Habyss Live Activity',
                    totalDurationSeconds: stats.targetDate ? (stats.targetDate - Date.now()) / 1000 : null,
                },
                {
                    title,
                    subtitle,
                    timerEndDateInMilliseconds: stats.targetDate ?? null,
                    progress,
                    profileImagePath,
                }
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

            // Clear a stale ID if the user dismissed the activity or reinstalled the app
            if (!LiveActivity.listActivities().includes(activityId)) {
                console.log('Live Activity not found in active list, clearing local ID.');
                await AsyncStorage.removeItem(ACTIVITY_ID_KEY);
                return;
            }

            const progress = stats.total > 0 ? stats.completed / stats.total : 0;

            let title = `${stats.completed}/${stats.total} done today`;
            let subtitle = stats.completed >= stats.total
                ? '✅ All done for today!'
                : stats.topHabitName
                    ? `Next: ${stats.topHabitName}`
                    : `${stats.total - stats.completed} remaining`;

            if (stats.activeHabitName) {
                title = stats.activeHabitName;
                subtitle = 'Focusing...';
            }

            const profileImagePath: string | undefined = undefined;

            await LiveActivity.updateActivity(activityId, {
                title,
                subtitle,
                timerEndDateInMilliseconds: stats.targetDate || null,
                progress,
                profileImagePath,
            });

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

            await LiveActivity.stopActivity(activityId, {
                title: 'Great job today! 🎉',
                subtitle: 'See you tomorrow',
                progress: 1,
            });

            await AsyncStorage.removeItem(ACTIVITY_ID_KEY);
            console.log('Live Activity stopped');

            // Only the focus state is cleared. The day's counts belong to the
            // home screen widget, which is still on screen: zeroing them here
            // used to leave it reading 0/0 the moment the day was finished.
            if (SharedDefaults) {
                await SharedDefaults.set('activeHabitName', 'No Active Habit');
                await SharedDefaults.remove('timerEndDate');
                if (typeof SharedDefaults.reloadTimelines === 'function') {
                    await SharedDefaults.reloadTimelines();
                }
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
            : `${stats.completed}/${stats.total} done`;

        SharedDefaults.set('activeHabitName', habitName).catch(() => { });
        SharedDefaults.set('todayStats', status).catch(() => { });
        syncWidgetSummary(stats);

        if (stats.targetDate) {
            SharedDefaults.set('timerEndDate', String(stats.targetDate)).catch(() => { });
        } else {
            SharedDefaults.remove('timerEndDate').catch(() => { });
        }

        if (stats.habits) {
            try {
                const habitsJson = JSON.stringify(stats.habits);
                SharedDefaults.set('habitsData', habitsJson).catch(() => { });
            } catch (e) {
                console.warn('Failed to serialize habits for widget:', e);
            }
        }

        // Reload widget timelines so changes appear immediately
        if (typeof SharedDefaults.reloadTimelines === 'function') {
            SharedDefaults.reloadTimelines().catch(() => { });
        }
    }
};
