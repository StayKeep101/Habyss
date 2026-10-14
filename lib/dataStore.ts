import { AppState } from 'react-native';
import { on } from './appEvents';
import { localDateKey, parseHabitDate } from './habitSchedule';
import type { HistoryDay } from './habitDays';
import type { Task } from './tasks';

/**
 * The one copy of the data every statistic is read from.
 *
 * Every screen used to fetch its own: Home read 90 days of check-ins, the
 * Roadmap another 90, Profile 90, Progress 400, each goal screen its own span,
 * the widget and the streak card theirs. Each fetch was a database query on
 * opening the page, and each copy refreshed at its own moment, so two screens
 * could show two answers for a while — and where the spans differed (a 70-day
 * window here, 90 there, full history on the goal pages) they disagreed for
 * good.
 *
 * Now there is one load, kept in memory and shared. Tasks are the full list,
 * done ones included. History is every day since the first habit started (at
 * least 400), check-ins and skips. A tick anywhere patches it in place — no
 * query — and every screen reading it re-renders with the same numbers at the
 * same moment. Opening a page reads memory, so it is instant.
 */
export interface DataSnapshot {
    tasks: Task[];
    /** Habit ids ticked on each day. */
    history: Record<string, string[]>;
    /** Habit ids deliberately skipped on each day. */
    skips: Record<string, string[]>;
    today: string;
    /** The first day `history` covers. */
    since: string;
    tasksLoaded: boolean;
    historyLoaded: boolean;
}

const MIN_DAYS = 400;

const shift = (key: string, delta: number) => {
    const date = parseHabitDate(key) ?? new Date();
    date.setDate(date.getDate() + delta);
    return localDateKey(date);
};
const span = (from: string, to: string) =>
    Math.round(((parseHabitDate(to)?.getTime() ?? 0) - (parseHabitDate(from)?.getTime() ?? 0)) / 86400000);

const initialToday = localDateKey(new Date());
let snapshot: DataSnapshot = {
    tasks: [], history: {}, skips: {}, today: initialToday, since: shift(initialToday, -(MIN_DAYS - 1)),
    tasksLoaded: false, historyLoaded: false,
};
const listeners = new Set<() => void>();

function publish(patch: Partial<DataSnapshot>) {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach(listener => listener());
}

/** Runs one load at a time; a request made while one runs gets one more run after it. */
function serial(work: () => Promise<void>) {
    let running: Promise<void> | null = null;
    let again = false;
    const run = (): Promise<void> => {
        if (running) { again = true; return running; }
        running = (async () => {
            try {
                do { again = false; await work(); } while (again);
            } finally {
                running = null;
            }
        })();
        return running;
    };
    return { run, busy: () => running !== null, markStale: () => { if (running) again = true; } };
}

const tasksLoader = serial(async () => {
    const { getTasks }: typeof import('./tasks') = require('./tasks');
    const tasks = await getTasks({ includeDone: true }).catch(() => null);
    publish({ tasks: tasks ?? snapshot.tasks, tasksLoaded: true });
});

const historyLoader = serial(async () => {
    const { getHabits, getLastNDaysCompletions }: typeof import('./habitsSQLite') = require('./habitsSQLite');
    const today = localDateKey(new Date());
    const habits = await getHabits().catch(() => []);
    const starts = habits
        .map(habit => parseHabitDate(habit.startDate) ?? parseHabitDate(habit.createdAt))
        .filter((date): date is Date => date !== null)
        .map(localDateKey);
    const floor = shift(today, -(MIN_DAYS - 1));
    const since = [floor, ...starts].sort()[0];
    const rows = await getLastNDaysCompletions(span(since, today) + 1).catch(() => null);
    if (!rows) { publish({ historyLoaded: true }); return; }
    const history: Record<string, string[]> = {};
    const skips: Record<string, string[]> = {};
    for (const row of rows) {
        history[row.date] = row.completedIds;
        if (row.skippedIds?.length) skips[row.date] = row.skippedIds;
    }
    publish({ history, skips, today, since, historyLoaded: true });
});

/** A single check-in changed: write it into memory instead of re-reading everything. */
function patchCheckIn(habitId: string, date: string, completed: boolean, skipped: boolean) {
    // A load already in flight may have read before this was written.
    historyLoader.markStale();
    if (!snapshot.historyLoaded) return;
    const done = (snapshot.history[date] ?? []).filter(id => id !== habitId);
    const skippedIds = (snapshot.skips[date] ?? []).filter(id => id !== habitId);
    if (completed) done.push(habitId);
    if (skipped) skippedIds.push(habitId);
    const skips = { ...snapshot.skips };
    if (skippedIds.length) skips[date] = skippedIds; else delete skips[date];
    publish({ history: { ...snapshot.history, [date]: done }, skips });
}

let wired = false;
function wire() {
    if (wired) return;
    wired = true;
    on('habit_completion_updated', ({ habitId, date, completed, skipped }) => {
        if (habitId && date) patchCheckIn(habitId, date, completed === true, skipped === true);
        else void historyLoader.run();
    });
    on('tasks_changed', () => { void tasksLoader.run(); });
    on('cloud_restored', () => { void tasksLoader.run(); void historyLoader.run(); });
    on('habit_deleted', () => { void historyLoader.run(); });
    on('habit_created', ({ habit }) => {
        // Only a habit that starts before what is loaded needs more history.
        const start = parseHabitDate(habit?.startDate) ?? parseHabitDate(habit?.createdAt);
        if (start && localDateKey(start) < snapshot.since) void historyLoader.run();
    });
    // Past midnight, "today" moves and the window moves with it.
    AppState.addEventListener('change', state => {
        if (state !== 'active') return;
        const today = localDateKey(new Date());
        if (today !== snapshot.today) { publish({ today }); void historyLoader.run(); void tasksLoader.run(); }
    });
}

/** Starts the load if nothing has been loaded yet; resolves once tasks and history are in memory. */
export function ensureData(): Promise<void> {
    wire();
    const work: Promise<void>[] = [];
    if (!snapshot.tasksLoaded) work.push(tasksLoader.run());
    if (!snapshot.historyLoaded) work.push(historyLoader.run());
    return Promise.all(work).then(() => undefined);
}

/** Re-reads everything from the database, for pull-to-refresh. */
export function reloadData(): Promise<void> {
    wire();
    return Promise.all([tasksLoader.run(), historyLoader.run()]).then(() => undefined);
}

export function getData(): DataSnapshot { return snapshot; }

export function subscribeData(listener: () => void): () => void {
    wire();
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/** Loaded data, for code outside React (the widget, the streak card). */
export async function loadedData(): Promise<DataSnapshot> {
    await ensureData();
    return snapshot;
}

export interface HistoryWindow {
    /** One record per calendar day, oldest first, today last. */
    rows: HistoryDay[];
    history: Record<string, string[]>;
    skips: Record<string, string[]>;
}

const windows = new Map<number, { source: DataSnapshot['history']; skipSource: DataSnapshot['skips']; today: string; value: HistoryWindow }>();

/**
 * The last `days` days of the shared history, in the shapes screens read.
 * The same object comes back until the data changes, so memoised statistics
 * downstream do not recompute.
 */
export function historyWindow(days: number, data: DataSnapshot = snapshot): HistoryWindow {
    const cached = windows.get(days);
    if (cached && cached.source === data.history && cached.skipSource === data.skips && cached.today === data.today) return cached.value;
    const rows: HistoryDay[] = [];
    const history: Record<string, string[]> = {};
    const skips: Record<string, string[]> = {};
    const today = localDateKey(new Date());
    for (let offset = days - 1; offset >= 0; offset--) {
        const date = shift(today, -offset);
        const completedIds = data.history[date] ?? [];
        const skippedIds = data.skips[date] ?? [];
        rows.push({ date, completedIds, skippedIds });
        history[date] = completedIds;
        if (skippedIds.length) skips[date] = skippedIds;
    }
    const value = { rows, history, skips };
    windows.set(days, { source: data.history, skipSource: data.skips, today: data.today, value });
    return value;
}

/** For tests: forget everything loaded. */
export function resetDataForTests() {
    snapshot = { ...snapshot, tasks: [], history: {}, skips: {}, tasksLoaded: false, historyLoaded: false };
    windows.clear();
}
