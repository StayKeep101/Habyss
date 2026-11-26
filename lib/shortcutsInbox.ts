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
        const habits = (await getHabits()).filter(habit => !habit.isArchived);
        const completions = await getCompletions(today);

        for (const name of pending) {
            const wanted = normalise(name);
            const match = habits.find(habit => normalise(habit.name) === wanted)
                ?? habits.find(habit => normalise(habit.name).includes(wanted));

            if (!match) { result.unmatched.push(name); continue; }
            if (completions[match.id]) { result.alreadyDone.push(match.name); continue; }
            // A timed habit is done by running its timer, not by saying so.
            // In a challenge or a bet it needs proof: held, and asked for in Habyss.
            if (await (require('./challengeProof') as typeof import('./challengeProof')).holdForProof({ kind: 'habit', habit: match })) continue;

            // toggleCompletion flips state, so it is only called when the habit
            // is not already complete for today.
            await toggleCompletion(match.id, today, undefined, 'siri');
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

/**
 * What can be added without opening Habyss: a task, a habit, a
 * thought for the brain dump, or `any` ("Tell Habyss …"): said freely and
 * read into the tasks and habits in it by the same rules as speaking
 * to the + button (lib/voicePlan.ts), anything unclear kept as a thought.
 */
export type QuickAddKind = 'task' | 'habit' | 'thought' | 'any';
export interface QuickAddResult { tasks: string[]; habits: string[]; thoughts: string[] }
const emptyResult = (): QuickAddResult => ({ tasks: [], habits: [], thoughts: [] });

export function parseQuickAdd(entry: string): { kind: QuickAddKind; title: string } | null {
    const match = /^(task|habit|goal|thought|braindump|any)\|([\s\S]+)$/.exec(entry);
    const title = match?.[2].trim().slice(0, 500);
    if (!match || !title) return null;
    // An older build's "goal" entry is read like anything said: as a task, a habit or a thought.
    return { kind: match[1] === 'braindump' ? 'thought' : match[1] === 'goal' ? 'any' : match[1] as QuickAddKind, title };
}

/**
 * Adds one thing from outside the app (Siri, a Shortcut, the widget's
 * notification), read the same way the composers read what is typed:
 * "Call 25 leads" is a count task, "Read 20 pages daily" a counted habit.
 */
export async function addQuick(kind: QuickAddKind, text: string, result: QuickAddResult = emptyResult()): Promise<QuickAddResult> {
    const title = text.trim().slice(0, 500);
    if (!title) return result;
    const today = localDateKey(new Date());
    if (kind === 'any') {
        const { splitSpeech } = require('./voicePlan') as typeof import('./voicePlan');
        const items = splitSpeech(title);
        if (!items.length) return addQuick('thought', title, result);
        for (const item of items) await addQuick(item.kind, item.text, result);
        return result;
    }
    try {
        if (kind === 'task') {
            const { createTask } = require('./tasks') as typeof import('./tasks');
            const { parseTaskText } = require('./taskParser') as typeof import('./taskParser');
            const parsed = parseTaskText(title);
            const made = await createTask({
                title: parsed.title || title,
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
        } else if (kind === 'habit') {
            const { parseHabitText, parsedToHabit } = require('./habitParser') as typeof import('./habitParser');
            const { addHabit } = require('./habitsSQLite') as typeof import('./habitsSQLite');
            const made = await addHabit({ ...parsedToHabit(parseHabitText(title), today) });
            if (made) result.habits.push(made.name);
        } else {
            const { addThought } = require('./brainDump') as typeof import('./brainDump');
            const made = await addThought(title);
            if (made) result.thoughts.push(made.text);
        }
    } catch {
        // One bad entry does not cost the rest.
    }
    return result;
}

/** "Added Call bank to today.": what was added, in one line, for the notification that confirms it. */
export function quickAddSummary(result: QuickAddResult): string | null {
    const parts = [
        ...result.tasks.map(name => `${name} to today`),
        ...result.habits.map(name => `the habit ${name}`),
    ];
    if (result.thoughts.length) parts.push(result.thoughts.length === 1 ? 'a thought to your brain dump' : `${result.thoughts.length} thoughts to your brain dump`);
    if (!parts.length) return null;
    const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
    return `Added ${list}.`;
}

export async function drainQuickAdds(): Promise<QuickAddResult> {
    const result = emptyResult();
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

    for (const entry of pending) {
        const item = parseQuickAdd(entry);
        if (item) await addQuick(item.kind, item.title, result);
    }
    return result;
}
