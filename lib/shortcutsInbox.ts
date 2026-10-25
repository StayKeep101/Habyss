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
            // A timed habit is done by running its timer, not by saying so.

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

/**
 * Tasks and habits named from outside the app.
 *
 * `AddTaskIntent` and `AddHabitIntent` (HabyssIntents.swift) ask for a name in
 * the system's own prompt — from Siri, Spotlight, the Action button or a
 * Shortcut — and queue it here as `task|<name>` or `habit|<name>`, so nothing
 * has to open. They become real rows the next time Habyss runs, read the same
 * way the composers read what is typed: "Call 25 leads" is a count task, "Read
 * 20 pages daily" a counted habit.
 */
const QUICK_ADD_KEY = 'pending_quick_adds';

export interface QuickAddResult { tasks: string[]; habits: string[] }

export function parseQuickAdd(entry: string): { kind: 'task' | 'habit'; title: string } | null {
    const match = /^(task|habit)\|([\s\S]+)$/.exec(entry);
    const title = match?.[2].trim().slice(0, 200);
    return match && title ? { kind: match[1] as 'task' | 'habit', title } : null;
}

export async function drainQuickAdds(): Promise<QuickAddResult> {
    const result: QuickAddResult = { tasks: [], habits: [] };
    if (Platform.OS !== 'ios' || !SharedDefaults) return result;

    let pending: string[] = [];
    try {
        const raw = await SharedDefaults.getArray(QUICK_ADD_KEY);
        pending = Array.isArray(raw) ? raw.filter((item: unknown): item is string => typeof item === 'string') : [];
        if (pending.length === 0) return result;
        // Cleared first, as above: a crash loses at most one, never adds twice.
        await SharedDefaults.remove(QUICK_ADD_KEY);
    } catch {
        return result;
    }

    const { createTask } = require('./tasks') as typeof import('./tasks');
    const { parseTaskText } = require('./taskParser') as typeof import('./taskParser');
    const { parseHabitText, parsedToHabit } = require('./habitParser') as typeof import('./habitParser');
    const { addHabit } = require('./habitsSQLite') as typeof import('./habitsSQLite');
    const today = localDateKey(new Date());

    for (const entry of pending) {
        const item = parseQuickAdd(entry);
        if (!item) continue;
        try {
            if (item.kind === 'task') {
                const parsed = parseTaskText(item.title);
                const made = await createTask({
                    title: parsed.title || item.title,
                    dueDate: parsed.dueDate ?? today,
                    dueTime: parsed.dueTime,
                    estimatedMinutes: parsed.estimatedMinutes,
                    priority: parsed.priority,
                    deadline: parsed.deadline,
                    difficulty: parsed.difficulty,
                    flexible: parsed.dueTime ? parsed.flexible : undefined,
                    source: 'shortcut',
                });
                if (made) result.tasks.push(made.title);
            } else {
                const made = await addHabit({ ...parsedToHabit(parseHabitText(item.title), today) });
                if (made) result.habits.push(made.name);
            }
        } catch {
            // One bad entry does not cost the rest.
        }
    }
    return result;
}
