import { Platform, NativeModules } from 'react-native';
import { getCompletions, getHabits, toggleCompletion } from './habitsSQLite';
import { localDateKey } from './habitSchedule';

const { SharedDefaults } = NativeModules;

/**
 * Completions arriving from Siri Shortcuts.
 *
 * `LogHabitIntent` in HabyssIntents.swift appends a habit name to
 * `pending_habit_logs` in the App Group and tells the user "Logged <habit>".
 * Nothing in the app ever read that key, so the completion was never recorded:
 * the shortcut reported success and changed nothing.
 *
 * This drains the queue on launch and on foreground, turning those names into
 * real completions. It is also what makes "mark my reading done" work from any
 * assistant that can run a Shortcut.
 */

const PENDING_KEY = 'pending_habit_logs';

export interface ShortcutDrainResult {
    /** Habit names that were newly marked complete. */
    logged: string[];
    /** Names that were already complete today, so nothing changed. */
    alreadyDone: string[];
    /** Names with no matching habit. */
    unmatched: string[];
}

const EMPTY: ShortcutDrainResult = { logged: [], alreadyDone: [], unmatched: [] };

const normalise = (value: string) => value.trim().toLowerCase();

export async function drainPendingShortcutLogs(): Promise<ShortcutDrainResult> {
    if (Platform.OS !== 'ios' || !SharedDefaults) return EMPTY;

    let pending: string[] = [];
    try {
        const raw = await SharedDefaults.getArray(PENDING_KEY);
        pending = Array.isArray(raw) ? raw.filter((item: unknown): item is string => typeof item === 'string') : [];
    } catch {
        return EMPTY;
    }
    if (pending.length === 0) return EMPTY;

    // Clear before applying. A crash mid-apply loses at most one log, whereas
    // leaving the queue in place could replay it and toggle a completion off.
    try {
        await SharedDefaults.remove(PENDING_KEY);
    } catch {
        return EMPTY;
    }

    const result: ShortcutDrainResult = { logged: [], alreadyDone: [], unmatched: [] };
    try {
        const today = localDateKey(new Date());
        const habits = (await getHabits()).filter(habit => !habit.isGoal && !habit.isArchived);
        const completions = await getCompletions(today);

        for (const name of pending) {
            const wanted = normalise(name);
            const match = habits.find(habit => normalise(habit.name) === wanted)
                ?? habits.find(habit => normalise(habit.name).includes(wanted));

            if (!match) { result.unmatched.push(name); continue; }
            if (completions[match.id]) { result.alreadyDone.push(match.name); continue; }

            // toggleCompletion flips state, so it is only called when the habit
            // is not already complete for today.
            await toggleCompletion(match.id, today);
            completions[match.id] = true;
            result.logged.push(match.name);
        }
    } catch {
        // The queue is already cleared; report what was applied before failing.
    }

    return result;
}
