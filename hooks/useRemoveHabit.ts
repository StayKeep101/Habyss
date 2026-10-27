import { useCallback } from 'react';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { hasHistoryToKeep, removeHabit, type HabitRemoval } from '@/lib/habitRemoval';
import { isHabitScheduledForDate } from '@/lib/habitSchedule';
import type { Habit } from '@/lib/habitsSQLite';

const FAILED: Record<HabitRemoval, string> = {
    today: 'Today was not skipped.',
    'from-today': 'It is still on your plan.',
    everything: 'Your habit is still saved.',
};

/**
 * Deleting a habit asks what you mean, because it repeats: skip just today,
 * stop it from today and keep what you did, or delete it with its history.
 * The one question everywhere a habit can be deleted (lib/habitRemoval.ts).
 */
export function useRemoveHabit() {
    return useCallback((habit: Habit, onDone?: (how: HabitRemoval) => void) => {
        const now = new Date();
        const run = (how: HabitRemoval) => removeHabit(habit, how, now)
            .then(() => onDone?.(how))
            .catch(() => Alert.alert('Could not save that', `${FAILED[how]} Please try again.`));
        const keeps = hasHistoryToKeep(habit, now);
        // The way Calendar asks about a repeating event: an action sheet
        // from the bottom, the destructive choice in red, Cancel apart.
        const choices: { label: string; how: HabitRemoval }[] = [
            ...(isHabitScheduledForDate(habit, now) ? [{ label: 'Skip Just Today', how: 'today' as const }] : []),
            ...(keeps ? [{ label: 'Stop from Today, Keep History', how: 'from-today' as const }] : []),
            { label: keeps ? 'Delete Habit and History' : 'Delete Habit', how: 'everything' },
        ];
        const message = keeps ? 'This habit repeats. Stopping it keeps every day you already did in your streaks and stats.' : undefined;
        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions({
                title: habit.name, message,
                options: [...choices.map(choice => choice.label), 'Cancel'],
                destructiveButtonIndex: choices.length - 1,
                cancelButtonIndex: choices.length,
            }, index => { if (index < choices.length) void run(choices[index].how); });
            return;
        }
        Alert.alert(habit.name, message, [
            ...choices.map(choice => ({ text: choice.label, style: choice.how === 'everything' ? 'destructive' as const : 'default' as const, onPress: () => void run(choice.how) })),
            { text: 'Cancel', style: 'cancel' as const },
        ]);
    }, []);
}
