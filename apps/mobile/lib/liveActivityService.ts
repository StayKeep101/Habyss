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
    /** A focus timer's whole length in seconds, so its ring starts as full as the app's (half way through, half way). */
    totalSeconds?: number;
    profilePicture?: string; // local file path or base64
    habits?: { id: string; name: string; isCompleted: boolean }[];
}

/**
 * One card at a time. Moving from one thing to the next stops one card and
 * starts another; run together, the start could miss the old card's id and
 * leave it on the Lock Screen beside the new one. Every call waits its turn.
 */
let turn: Promise<unknown> = Promise.resolve();
const inTurn = <T>(work: () => Promise<T>): Promise<T> => {
    const next = turn.catch(() => undefined).then(work);
    turn = next;
    return next;
};

/** Ends every card on the phone except `keep`: the timeline's, an earlier focus's, any left behind. */
async function endOthers(keep?: string | null): Promise<void> {
    if (!LiveActivity) return;
    for (const id of LiveActivity.listActivities()) {
        if (id === keep) continue;
        await LiveActivity.stopActivity(id, { title: '', subtitle: '', progress: 0 }).catch(() => undefined);
    }
}

export const LiveActivityService = {
    /**
     * Start or update the daily progress Live Activity.
     * Shows habit progress on Lock Screen and Dynamic Island.
     */
    startDailyProgress(stats: DailyProgress): Promise<void> {
        return inTurn(() => this.startNow(stats));
    },

    async startNow(stats: DailyProgress): Promise<void> {
        if (!LiveActivity || Platform.OS !== 'ios' || !stats.activeHabitName) return;

        try {
            // Check if we already have an active Live Activity
            const existingId = await AsyncStorage.getItem(ACTIVITY_ID_KEY);
            if (existingId && LiveActivity.listActivities().includes(existingId)) {
                // Update existing activity instead of creating a new one
                await endOthers(existingId);
                await this.updateNow(stats);
                return;
            }

            if (existingId) await AsyncStorage.removeItem(ACTIVITY_ID_KEY);
            // A day that asks for nothing has nothing to put on the Lock
            // Screen, and a card reading "0/0" is worse than no card. The
            // widget still gets the day either way.
            if (!stats.activeHabitName) {
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
                ? ''
                : stats.streakDays
                    ? `🔥 ${stats.streakDays} day streak`
                    : stats.topHabitName
                        ? `Next: ${stats.topHabitName}`
                        : 'Keep going!';

            const title = stats.activeHabitName || `${stats.completed}/${stats.total} done today`;

            const profileImagePath: string | undefined = undefined;

            // Only ever one card: whatever was there goes first.
            await endOthers();
            const activityId = LiveActivity.startActivity(
                {
                    name: 'Habyss Live Activity',
                    // The whole length, not what is left: opened half way through its slot, the ring starts half full.
                    totalDurationSeconds: stats.totalSeconds ?? (stats.targetDate ? (stats.targetDate - Date.now()) / 1000 : null),
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
    updateProgress(stats: DailyProgress): Promise<void> {
        return inTurn(() => this.updateNow(stats));
    },

    async updateNow(stats: DailyProgress): Promise<void> {
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
                subtitle = '';
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
            if (!stats.activeHabitName && stats.completed >= stats.total && stats.total > 0) {
                // Keep it visible for a bit longer, then stop
                setTimeout(async () => { if (await AsyncStorage.getItem(ACTIVITY_ID_KEY) === activityId) await this.stopActivity(); }, 30000); // 30s celebration
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
    stopActivity(): Promise<void> {
        return inTurn(() => this.stopNow());
    },

    async stopNow(): Promise<void> {
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
            // The timeline's card for whatever is now current takes its place.
            setTimeout(() => { void (require('./scheduledActivities') as typeof import('./scheduledActivities')).refreshScheduledActivities(); }, 0);

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


        if (stats.targetDate) {
            SharedDefaults.set('timerEndDate', String(stats.targetDate)).catch(() => { });
        } else {
            SharedDefaults.remove('timerEndDate').catch(() => { });
        }

        // Reload widget timelines so changes appear immediately
        if (typeof SharedDefaults.reloadTimelines === 'function') {
            SharedDefaults.reloadTimelines().catch(() => { });
        }
    }
};
