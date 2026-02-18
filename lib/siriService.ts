import { Platform, NativeModules } from 'react-native';

const { SharedDefaults } = NativeModules;

/**
 * SiriService — Manages Siri Shortcut data sharing between React Native and native App Intents.
 * 
 * The native HabyssIntents.swift uses App Group UserDefaults to communicate with the app.
 * This service writes data to the same shared storage so that Siri intents like
 * CheckProgressIntent can read fresh habit data without opening the app.
 */
export class SiriService {
    /**
     * Syncs today's habit progress to shared defaults so CheckProgressIntent can read it.
     * Should be called after every habit completion.
     */
    static async syncProgressForSiri(habits: { id: string; name: string; isCompleted: boolean }[]): Promise<void> {
        if (Platform.OS !== 'ios' || !SharedDefaults) return;

        try {
            const habitsJson = JSON.stringify(habits);
            await SharedDefaults.set('habitsData', habitsJson);
        } catch (e) {
            console.warn('SiriService: Failed to sync progress:', e);
        }
    }

    /**
     * Checks if a stop focus intent was triggered via Siri.
     * Returns true if found and clears the flag.
     */
    static async checkStopFocusIntent(): Promise<boolean> {
        if (Platform.OS !== 'ios' || !SharedDefaults) return false;

        try {
            const timestamp = await SharedDefaults.getDouble('intent_stop_focus_timestamp');
            if (timestamp > 0) {
                // Clear the intent
                await SharedDefaults.remove('intent_stop_focus');
                await SharedDefaults.remove('intent_stop_focus_timestamp');
                return true;
            }
            return false;
        } catch (e) {
            console.warn('SiriService: Error checking stop intent:', e);
            return false;
        }
    }

    /**
     * Checks if a start focus intent was triggered via Siri.
     * Returns the duration in minutes or null if no intent pending.
     */
    static async checkStartFocusIntent(): Promise<number | null> {
        if (Platform.OS !== 'ios' || !SharedDefaults) return null;

        try {
            const duration = await SharedDefaults.getInteger('intent_start_focus_duration');
            if (duration > 0) {
                await SharedDefaults.remove('intent_start_focus_duration');
                await SharedDefaults.remove('intent_start_focus_timestamp');
                return duration;
            }
            return null;
        } catch (e) {
            console.warn('SiriService: Error checking start intent:', e);
            return null;
        }
    }

    /**
     * Checks for pending habit logs from Siri and returns them.
     * Clears the queue after reading.
     */
    static async checkPendingHabitLogs(): Promise<string[]> {
        if (Platform.OS !== 'ios' || !SharedDefaults) return [];

        try {
            const pending = await SharedDefaults.getArray('pending_habit_logs');
            if (pending && pending.length > 0) {
                await SharedDefaults.remove('pending_habit_logs');
                return pending as string[];
            }
            return [];
        } catch (e) {
            console.warn('SiriService: Error checking pending logs:', e);
            return [];
        }
    }
}
