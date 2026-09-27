import { isHabitScheduledForDate, localDateKey } from './habitSchedule';
import { tallyDay, streakFrom } from './dayComplete';
import { getDailyTarget, type DailyTarget } from './dailyFocus';
import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import { buildWidgetDashboard, parseWidgetEvent, type WidgetDashboard } from './widgetDashboard';
import { addDays, daysBetween, goalRange } from './goalInsights';
import { engagementLifecycle } from './engagementLifecycle';

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
    const DEFAULT = { from: '#3A5A8C', to: '#8BADD6' };
    try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const { ACCENT_GRADIENTS } = require('@/constants/AccentContext') as typeof import('@/constants/AccentContext');
        const id = await AsyncStorage.getItem('habyss_accent_gradient');
        const found = ACCENT_GRADIENTS.find(item => item.id === id);
        return found ? { from: found.colors[0], to: found.colors[1] } : DEFAULT;
    } catch {
        return DEFAULT;
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
        const { getHabits, getCompletions, getSkipped, getLastNDaysCompletions } = require('./habitsSQLite') as typeof import('./habitsSQLite');
        const { getTasks } = require('./tasks') as typeof import('./tasks');
        const { WidgetService } = require('./widgetService') as typeof import('./widgetService');

        const today = localDateKey(new Date());
        const [habits, completions, skipped, tasks] = await Promise.all([
            getHabits(), getCompletions(today), getSkipped(today), getTasks({ includeDone: true }),
        ]);

        const earliest = habits.map(habit => goalRange(habit, today).start).sort()[0] ?? today;
        const rows = await getLastNDaysCompletions(Math.max(91, daysBetween(earliest, today) + 1));
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
        payload.accent = await readAccent();
        payload.dashboard = buildWidgetDashboard({ habits, tasks, history, skips, today, accent: payload.accent });
        await WidgetService.write(payload);
        // Echo's hourly lines ride along with the day: they are built from the
        // same numbers, so writing them anywhere else would risk the lock
        // screen quoting a streak the widget above it disagrees with.
        await writeEchoHours(habits, payload, history, today);
        return payload;
    } catch {
        // A stale widget is not worth an error in front of the user.
        return null;
    }
}

/**
 * What Echo will say on the lock screen for the rest of the day.
 *
 * Built from the payload the widget was just handed rather than from a second
 * read of the database, so the line and the numbers beside it always agree.
 */
async function writeEchoHours(habits: Habit[], payload: WidgetPayload, history: Record<string, string[]>, today: string) {
    try {
        const { buildEchoHours } = require('./echoLockScreen') as typeof import('./echoLockScreen');
        const { getDayWindow, getEchoPersonality, getName } = require('./echo') as typeof import('./echo');
        const { WidgetService } = require('./widgetService') as typeof import('./widgetService');

        const lastWeek = Array.from({ length: 7 }, (_, offset) => history[addDays(today, -offset)] ?? []);
        const goals = payload.dashboard?.goals ?? [];
        const [window, personality, name] = await Promise.all([getDayWindow(), getEchoPersonality(), getName()]);

        await WidgetService.writeEcho(buildEchoHours({
            now: new Date(), window, personality,
            stats: {
                name,
                streak: payload.streak,
                todayDone: payload.completed,
                todayTotal: payload.total,
                weekConsistency: Math.round((lastWeek.filter(day => day.length).length / 7) * 100),
                nextHabit: payload.nextUp,
                goalsCount: goals.length,
                overallProgress: goals.length
                    ? Math.round(goals.reduce((sum, goal) => sum + goal.progress, 0) / goals.length)
                    : 0,
                bestHabit: habits.find(habit => !habit.isGoal && !habit.isArchived)?.name,
            },
        }));
    } catch {
        // A lock screen without a line is yesterday's behaviour, not a failure.
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
        for (const event of [...oldEvents, ...events]) {
            const { kind, id } = parseWidgetId(event.id);
            if (kind === 'habit') {
                if (habits.some(habit => habit.id === id && !habit.isGoal)) {
                    const done = completions[event.day] ?? await getCompletions(event.day);
                    if (!!done[id] !== event.done) { await toggleCompletion(id, event.day); applied.habits++; }
                    completions[event.day] = { ...done, [id]: event.done };
                }
            } else {
                const task = tasks.find(task => task.id === id);
                if (task && (task.status === 'done') !== event.done) {
                    await setTaskStatus(id, event.done ? 'done' : 'open');
                    task.status = event.done ? 'done' : 'open';
                    applied.tasks++;
                }
            }
            // Acknowledge only after SQLite commits; a failed write stays queued.
            if (event.eventId) await SharedDefaults.remove('widget_event_' + event.eventId);
        }
        if (legacy?.length) await SharedDefaults.remove('pending_widget_toggles');
    } catch (error) { console.warn('[Widget] Could not apply all widget actions; retained for retry.', error); }
    return applied;
}
