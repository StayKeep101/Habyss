import { isHabitScheduledForDate, localDateKey } from './habitSchedule';
import { tallyDay, streakFrom } from './dayComplete';
import { getDailyTarget, type DailyTarget } from './dailyFocus';
import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';

/**
 * What the home screen, the lock screen and the Dynamic Island are told.
 *
 * The widget used to be sent every habit the user has ever kept, ticked or
 * not, which meant a Monday-only habit sat on the widget all Sunday and the
 * count never matched the app. What it gets now is exactly the day the app
 * shows: habits scheduled today, tasks due today, skipped things left out.
 *
 * Tasks travel with a `task:` prefix on their id. The widget passes the id
 * straight back when a row is ticked, so the prefix is what tells the app
 * whether to log a habit or close a task.
 */

export interface WidgetItem {
    id: string;
    name: string;
    isCompleted: boolean;
}

export interface WidgetPayload {
    items: WidgetItem[];
    completed: number;
    total: number;
    /** The first thing still to do, for the small widget's one line. */
    nextUp?: string;
    streak: number;
    /** The day this list is for; the widget stops showing it once it passes. */
    dayKey: string;
}

const HABIT = 'habit:';
const TASK = 'task:';

/**
 * Splits a row the widget sent back into what it points at and what the user
 * chose. The widget writes `habit:abc|1`; an older build wrote just `abc`,
 * which was always a habit being ticked on.
 */
export function parseWidgetId(raw: string): { kind: 'habit' | 'task'; id: string; done: boolean } {
    const [ref, state] = raw.split('|');
    const done = state !== '0';
    if (ref.startsWith(TASK)) return { kind: 'task', id: ref.slice(TASK.length), done };
    if (ref.startsWith(HABIT)) return { kind: 'habit', id: ref.slice(HABIT.length), done };
    return { kind: 'habit', id: ref, done };
}

const byTime = (a?: string, b?: string) => (a ?? '99:99').localeCompare(b ?? '99:99');

export function buildWidgetPayload(options: {
    habits: Habit[];
    tasks: Task[];
    completions: Record<string, boolean>;
    skipped: Record<string, boolean>;
    today: string;
    streak?: number;
    target?: DailyTarget;
}): WidgetPayload {
    const { habits, tasks, completions, skipped, today, streak = 0, target } = options;
    const date = new Date(`${today}T12:00:00`);

    const dueHabits = habits
        .filter(habit => !habit.isGoal && !habit.isArchived && !skipped[habit.id] && isHabitScheduledForDate(habit, date))
        .sort((a, b) => byTime(a.startTime, b.startTime))
        .map(habit => ({ id: HABIT + habit.id, name: habit.name, isCompleted: !!completions[habit.id] }));

    const dueTasks = tasks
        .filter(task => task.status !== 'cancelled' && task.dueDate === today)
        .sort((a, b) => byTime(a.dueTime, b.dueTime))
        .map(task => ({ id: TASK + task.id, name: task.title, isCompleted: task.status === 'done' }));

    // Only three rows fit on the small widget, so what is left comes first.
    const all = [...dueHabits, ...dueTasks];
    const items = [...all.filter(item => !item.isCompleted), ...all.filter(item => item.isCompleted)];
    const tally = tallyDay(habits, completions, skipped, tasks, today, target);

    return {
        items,
        completed: tally.done,
        total: tally.total,
        nextUp: items.find(item => !item.isCompleted)?.name,
        streak,
        dayKey: today,
    };
}

/** Reads the day out of the database and hands it to iOS. */
export async function syncWidgets(): Promise<WidgetPayload | null> {
    try {
        const { getHabits, getCompletions, getSkipped, getLastNDaysCompletions } = require('./habitsSQLite') as typeof import('./habitsSQLite');
        const { getTasks } = require('./tasks') as typeof import('./tasks');
        const { WidgetService } = require('./widgetService') as typeof import('./widgetService');

        const today = localDateKey(new Date());
        const [habits, completions, skipped, tasks] = await Promise.all([
            getHabits(), getCompletions(today), getSkipped(today), getTasks({ includeDone: true }),
        ]);

        const rows = await getLastNDaysCompletions(70).catch(() => []);
        const history: Record<string, string[]> = {};
        const skips: Record<string, string[]> = {};
        for (const row of rows) {
            history[row.date] = row.completedIds;
            if (row.skippedIds?.length) skips[row.date] = row.skippedIds;
        }
        history[today] = Object.keys(completions).filter(id => completions[id]);
        skips[today] = Object.keys(skipped).filter(id => skipped[id]);
        const target = await getDailyTarget();
        const { streak } = streakFrom(habits, tasks, history, skips, today, 70, target);

        const payload = buildWidgetPayload({ habits, tasks, completions, skipped, today, streak, target });
        await WidgetService.write(payload);
        return payload;
    } catch {
        // A stale widget is not worth an error in front of the user.
        return null;
    }
}

/**
 * Applies the rows ticked on the widget while the app was closed.
 *
 * The widget already drew them as done and wrote the ids down; this is the app
 * catching up, so it sets the state the user chose rather than toggling, which
 * would undo anything logged in both places.
 */
export async function drainWidgetToggles(): Promise<{ habits: number; tasks: number }> {
    const applied = { habits: 0, tasks: 0 };
    try {
        const SharedDefaults = (require('./SharedDefaults') as typeof import('./SharedDefaults')).default;
        const pending = await SharedDefaults.getArray('pending_widget_toggles');
        if (!pending?.length) return applied;
        await SharedDefaults.remove('pending_widget_toggles');

        const { toggleCompletion, getCompletions } = require('./habitsSQLite') as typeof import('./habitsSQLite');
        const { setTaskStatus, getTasks } = require('./tasks') as typeof import('./tasks');
        const today = localDateKey(new Date());
        const completions = await getCompletions(today);
        const tasks = await getTasks({ includeDone: true });

        for (const raw of pending) {
            if (typeof raw !== 'string' || !raw) continue;
            const { kind, id, done } = parseWidgetId(raw);
            if (kind === 'habit') {
                // Setting the state the user chose, not toggling: the widget
                // may have been ticked while the app logged the same habit.
                if (!!completions[id] === done) continue;
                await toggleCompletion(id, today);
                completions[id] = done;
                applied.habits++;
            } else {
                const task = tasks.find(item => item.id === id);
                if (!task || (task.status === 'done') === done) continue;
                await setTaskStatus(id, done ? 'done' : 'open');
                applied.tasks++;
            }
        }
    } catch {
        // Nothing applied; the widget will be corrected by the next sync.
    }
    return applied;
}
