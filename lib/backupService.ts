import * as FileSystem from 'expo-file-system';
import { Share, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getHabits, getGoals, getCompletions } from './habits';

// ============================================
// Backup Service
// Handles data export/import for local backup
// ============================================

interface BackupData {
    version: string;
    exportedAt: string;
    userId?: string;
    habits: any[];
    goals: any[];
    completions: { date: string; habitId: string }[];
    settings: Record<string, any>;
}

export class BackupService {
    static readonly BACKUP_VERSION = '1.0';

    /**
     * Export all user data to a JSON file
     */
    static async exportAllData(): Promise<boolean> {
        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser();

            // Get all local data
            const habits = await getHabits();
            const goals = await getGoals();

            // Get completions for last 365 days
            const completions: { date: string; habitId: string }[] = [];
            const today = new Date();
            for (let i = 0; i < 365; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const dayCompletions = await getCompletions(dateStr);
                Object.keys(dayCompletions).forEach(habitId => {
                    if (dayCompletions[habitId]) {
                        completions.push({ date: dateStr, habitId });
                    }
                });
            }

            // Get AsyncStorage settings
            const settingsKeys = [
                'app_settings',
                'habit_custom_colors',
                'focus_stats',
                'onboarding_complete',
            ];
            const settings: Record<string, any> = {};
            for (const key of settingsKeys) {
                const value = await AsyncStorage.getItem(key);
                if (value) {
                    try {
                        settings[key] = JSON.parse(value);
                    } catch {
                        settings[key] = value;
                    }
                }
            }

            // Create backup object
            const backup: BackupData = {
                version: this.BACKUP_VERSION,
                exportedAt: new Date().toISOString(),
                userId: user?.id,
                habits,
                goals,
                completions,
                settings,
            };

            // Save to file
            const filename = `habyss_backup_${new Date().toISOString().split('T')[0]}.json`;
            const filePath = `${FileSystem.documentDirectory}${filename}`;
            await FileSystem.writeAsStringAsync(filePath, JSON.stringify(backup, null, 2));

            // Notify user of export
            Alert.alert(
                'Export Complete',
                `Your data has been exported to:\n${filename}\n\nYou can find it in the app's documents folder.`,
                [{ text: 'OK', style: 'default' }]
            );

            return true;
        } catch (error) {
            console.error('Export error:', error);
            Alert.alert('Export Failed', 'Could not export your data. Please try again.');
            return false;
        }
    }

    /**
     * Get storage usage statistics
     */
    static async getStorageUsage(): Promise<{
        habitsCount: number;
        goalsCount: number;
        completionsCount: number;
        estimatedSizeMB: number;
    }> {
        try {
            const habits = await getHabits();
            const goals = await getGoals();

            // Estimate completions (rough count)
            let completionsCount = 0;
            const today = new Date();
            for (let i = 0; i < 30; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const dayCompletions = await getCompletions(dateStr);
                completionsCount += Object.keys(dayCompletions).length;
            }

            // Rough size estimate
            const estimatedSizeMB = (
                (habits.length * 0.002) + // ~2KB per habit
                (goals.length * 0.001) + // ~1KB per goal
                (completionsCount * 0.0001) // ~100B per completion
            );

            return {
                habitsCount: habits.length,
                goalsCount: goals.length,
                completionsCount,
                estimatedSizeMB: Math.max(0.01, estimatedSizeMB),
            };
        } catch (error) {
            console.error('Storage usage error:', error);
            return {
                habitsCount: 0,
                goalsCount: 0,
                completionsCount: 0,
                estimatedSizeMB: 0,
            };
        }
    }

    /**
     * Clear local cache (keeps Supabase data)
     */
    static async clearLocalCache(): Promise<boolean> {
        try {
            const keysToRemove = [
                'focus_stats',
                'habit_custom_colors',
            ];
            await AsyncStorage.multiRemove(keysToRemove);
            return true;
        } catch (error) {
            console.error('Clear cache error:', error);
            return false;
        }
    }
}
