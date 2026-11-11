import { isHabitScheduledForDate, localDateKey } from './habitSchedule';
import { tallyDay, streakFrom } from './dayComplete';
import { getDailyTarget, type DailyTarget } from './dailyFocus';
import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { buildWidgetDashboard, parseWidgetEvent, type WidgetDashboard } from './widgetDashboard';
import { engagementLifecycle } from './engagementLifecycle';
import { measurementFor } from './habitMeasurement';

/**
 * One database read feeds the Home Screen dashboard and legacy Siri/Echo data.
 * Dashboard Daily Tasks contains only Tasks-list items; the legacy items list
 * also includes scheduled habits. Prefixed IDs keep their actions distinct.
 */

export interface WidgetItem {
    id: string;
    name: string;
    isCompleted: boolean;
}

export interface WidgetPayload {
    items: WidgetItem[];
    dashboard?: WidgetDashboard;
    completed: number;
    total: number;
    /** The first thing still to do, for the small widget's one line. */
    nextUp?: string;
    streak: number;
    /** The day this list is for; the widget stops showing it once it passes. */
    dayKey: string;
    /** The accent the user picked, so the widget is the same colour as the app. */
    accent?: { from: string; to: string };
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
/** The accent the user chose, as colours rather than an id. */
export async function readAccent(): Promise<{ from: string; to: string }> {
    // Nothing saved means the app's own default (Habyss blue, the first gradient), the
    // colour the app, the Live Activity and every widget then share. An older dusty pair
    // here made widgets a different blue from the app for anyone who never picked one.
    const { ACCENT_GRADIENTS } = require('@/context/AccentContext') as typeof import('@/context/AccentContext');
    const fallback = { from: ACCENT_GRADIENTS[0].colors[0], to: ACCENT_GRADIENTS[0].colors[1] };
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const id = await AsyncStorage.getItem('habyss_accent_gradient');
        const found = ACCENT_GRADIENTS.find(item => item.id === id);
        return found ? { from: found.colors[0], to: found.colors[1] } : fallback;
    } catch {
        return fallback;
    }
}

let syncing: Promise<WidgetPayload | null> | null = null;
let resync = false;
export function syncWidgets(): Promise<WidgetPayload | null> {
    if (engagementLifecycle.paused) return Promise.resolve(null);
    if (syncing) { resync = true; return syncing; }
    syncing = (async () => {
        let result: WidgetPayload | null;
        do { resync = false; result = await writeWidgets(); } while (resync);
        return result;
    })().finally(() => { syncing = null; });
    return syncing;
}

async function writeWidgets(): Promise<WidgetPayload | null> {
    try {
        const { getHabits, getCompletions, getSkipped } = require('./habitsSQLite') as typeof import('./habitsSQLite');
        const { loadedData } = require('./dataStore') as typeof import('./dataStore');
        const { WidgetService } = require('./widgetService') as typeof import('./widgetService');

        const today = localDateKey(new Date());
        const [habits, completions, skipped, data] = await Promise.all([
            getHabits(), getCompletions(today), getSkipped(today), loadedData(),
        ]);
        // The same history and tasks every screen reads, so the widget never
        // quotes a number the app disagrees with.
        const tasks = data.tasks;
        const history: Record<string, string[]> = { ...data.history };
        const skips: Record<string, string[]> = { ...data.skips };
        history[today] = Object.keys(completions).filter(id => completions[id]);
        skips[today] = Object.keys(skipped).filter(id => skipped[id]);
        const target = await getDailyTarget();
        const { streak } = streakFrom(habits, tasks, history, skips, today, undefined, target);

        const payload = buildWidgetPayload({ habits, tasks, completions, skipped, today, streak, target });
        payload.accent = await readAccent();
        payload.dashboard = buildWidgetDashboard({ habits, tasks, history, skips, today, accent: payload.accent, streak });
        await WidgetService.write(payload);
        // The watch shows the same day, from the same numbers.
        const { pushToWatch } = require('./watchSync') as typeof import('./watchSync');
        const { currentTodayFlow } = require('./todayFlow') as typeof import('./todayFlow');
        const { slotsFromFlow } = require('./watchSync') as typeof import('./watchSync');
        const flow = await currentTodayFlow().catch(() => null);
        pushToWatch({ habits, tasks, history, today, streak, accent: payload.accent, slots: slotsFromFlow(flow) });
        // The Day widget: the same timeline the app and the watch show.
        const { buildWidgetDay } = require('./widgetDay') as typeof import('./widgetDay');
        const { getDayWindow, minutesOf } = require('./echo') as typeof import('./echo');
        const window = await getDayWindow();
        await WidgetService.writeDay(buildWidgetDay(flow, today, minutesOf(window.wake), minutesOf(window.sleep)));
        return payload;
    } catch (error) {
        console.warn('[Widget] Snapshot was not updated; keeping the last successful snapshot.', error);
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
let draining: Promise<{ habits: number; tasks: number }> | null = null;
export function drainWidgetToggles(): Promise<{ habits: number; tasks: number }> {
    if (engagementLifecycle.paused) return Promise.resolve({ habits: 0, tasks: 0 });
    if (draining) return draining;
    draining = drain().finally(() => { draining = null; });
    return draining;
}

export async function waitForWidgetSync() { await Promise.allSettled([syncing, draining]); }
async function drain(): Promise<{ habits: number; tasks: number }> {
    const applied = { habits: 0, tasks: 0 };
    const SharedDefaults = (require('./SharedDefaults') as typeof import('./SharedDefaults')).default;
    const { toggleCompletion, getCompletions, getHabits } = require('./habitsSQLite') as typeof import('./habitsSQLite');
    const { setTaskStatus, getTasks } = require('./tasks') as typeof import('./tasks');
    try {
        const [rawEvents, legacy, habits, tasks] = await Promise.all([
            SharedDefaults.getPendingWidgetEvents?.() ?? Promise.resolve([]),
            SharedDefaults.getArray('pending_widget_toggles'), getHabits(), getTasks({ includeDone: true }),
        ]);
        const events = rawEvents.map(parseWidgetEvent).filter((event): event is NonNullable<typeof event> => !!event)
            .sort((a, b) => a.timestamp - b.timestamp || a.eventId.localeCompare(b.eventId));
        const today = localDateKey(new Date());
        // Old widget builds did not stamp a day; use their stored snapshot day.
        const legacyDay = await SharedDefaults.get('dayKey') ?? today;
        const oldEvents = (legacy ?? []).filter((raw): raw is string => typeof raw === 'string').map(raw => {
            const parsed = parseWidgetId(raw);
            return { eventId: '', id: `${parsed.kind}:${parsed.id}`, day: legacyDay, done: parsed.done, timestamp: 0 };
        });
        const completions: Record<string, Record<string, boolean>> = {};
        const acknowledged: string[] = [];
        for (const event of [...oldEvents, ...events]) {
            const { kind, id } = parseWidgetId(event.id);
            if (kind === 'habit') {
                const found = habits.find(habit => habit.id === id && !habit.isGoal);
                // A tap ticks anything, timed habits included.
                if (found) {
                    const done = completions[event.day] ?? await getCompletions(event.day);
                    if (!!done[id] !== event.done) { await toggleCompletion(id, event.day, event.done && event.timestamp > 0 ? new Date(event.timestamp).toISOString() : undefined); applied.habits++; }
                    completions[event.day] = { ...done, [id]: event.done };
                }
            } else {
                const task = tasks.find(task => task.id === id);
                if (task && (task.status === 'done') !== event.done) {
                    if (event.done && event.timestamp > 0) {
                        await setTaskStatus(id, 'done', new Date(event.timestamp).toISOString());
                    } else {
                        await setTaskStatus(id, event.done ? 'done' : 'open');
                    }
                    task.status = event.done ? 'done' : 'open';
                    applied.tasks++;
                }
            }
            if (event.eventId) acknowledged.push('widget_event_' + event.eventId);
        }
        // Keep the widget's overlay until the replacement snapshot includes
        // every committed tap. Failed publication must not visually undo it.
        if (acknowledged.length || legacy?.length) {
            if (!(await syncWidgets())) return applied;
            for (const key of acknowledged) await SharedDefaults.remove(key);
            if (legacy?.length) await SharedDefaults.remove('pending_widget_toggles');
            await SharedDefaults.reloadTimelines();
        }
    } catch (error) { console.warn('[Widget] Could not apply all widget actions; retained for retry.', error); }
    return applied;
}
