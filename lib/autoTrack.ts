import AsyncStorage from '@react-native-async-storage/async-storage';
import { localDateKey } from './habitSchedule';

/**
 * Ticking a habit or task by itself, for everything that tracks without a tap:
 * time at a place (lib/LocationService.ts) and time in chosen apps
 * (lib/appTime.ts). Apple Health habits fill their amount instead
 * (syncHealthKitData).
 *
 * The same rules as a tick by hand: never one already done, never a habit not
 * due that day, never a future day, and a challenge habit that needs proof is
 * held for it. Each tick says so once, in a notification, so the person
 * knows without opening Habyss.
 */
export type AutoResult = 'done' | 'already' | 'not_due' | 'held' | 'missing';

export async function autoTickHabit(habitId: string, day = localDateKey(new Date())): Promise<{ result: AutoResult; name?: string }> {
    const { getHabits, getCompletions, toggleCompletion, setCompletionValue }: typeof import('./habitsSQLite') = require('./habitsSQLite');
    const { isHabitScheduledForDate }: typeof import('./habitSchedule') = require('./habitSchedule');
    const habit = (await getHabits()).find(item => item.id === habitId);
    if (!habit || habit.isArchived || habit.isGoal) return { result: 'missing' };
    if (day > localDateKey(new Date())) return { result: 'not_due', name: habit.name };
    if (!isHabitScheduledForDate(habit, new Date(`${day}T12:00:00`))) return { result: 'not_due', name: habit.name };
    if ((await getCompletions(day))[habitId]) return { result: 'already', name: habit.name };
    const { holdForProof }: typeof import('./challengeProof') = require('./challengeProof');
    if (await holdForProof({ kind: 'habit', habit })) return { result: 'held', name: habit.name };
    // An amount habit is filled to its target; a yes/no one is ticked.
    if (habit.trackingMethod === 'numeric') await setCompletionValue(habit.id, habit.goalValue || 1, day, true, 'auto');
    else await toggleCompletion(habit.id, day, undefined, 'auto');
    announce();
    return { result: 'done', name: habit.name };
}

export async function autoTickTask(taskId: string): Promise<{ result: AutoResult; name?: string }> {
    const { getTasks, setTaskStatus }: typeof import('./tasks') = require('./tasks');
    const task = (await getTasks()).find(item => item.id === taskId);
    if (!task) return { result: 'missing' };
    if (task.status !== 'open') return { result: 'already', name: task.title };
    await setTaskStatus(task.id, 'done');
    announce();
    return { result: 'done', name: task.title };
}

/** The app's screens redraw (when it is running). */
function announce() {
    try {
        const { emit }: typeof import('./appEvents') = require('./appEvents');
        emit('habit_completion_updated', {});
        emit('tasks_changed');
    } catch { /* in the background, with nothing on screen */ }
}

/** "Gym: done." with the reason under it; at most once per item per day. */
export async function tellAutoTicked(key: string, title: string, body: string): Promise<void> {
    try {
        const day = localDateKey(new Date());
        const seen = `habyss_auto_told_${key}`;
        if ((await AsyncStorage.getItem(seen)) === day) return;
        const Notifications = require('expo-notifications') as typeof import('expo-notifications');
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) return;
        await Notifications.scheduleNotificationAsync({ content: { title, body, sound: 'default' }, trigger: null });
        await AsyncStorage.setItem(seen, day);
    } catch { /* the tick stands either way */ }
}

/** "52 min", "1 hr 10 min". */
export function minutesLabel(minutes: number): string {
    const m = Math.max(1, Math.round(minutes));
    const hours = Math.floor(m / 60), rest = m % 60;
    return [hours ? `${hours} hr` : '', rest ? `${rest} min` : ''].filter(Boolean).join(' ');
}
