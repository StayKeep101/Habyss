import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sqliteAdapter } from './support/realSQLite';
import { closeDatabase, getDatabase } from '../database';
import { getHabitMeasurement, getHabitStats, getLastNDaysCompletions, saveHabitMeasurement, toggleCompletion, getCompletions, setSkipped, getSkipped, getHabits, clearHabitsCache } from '../habitsSQLite';
import { createTask, deleteTask, getTasks, updateTask, setTaskStatus } from '../tasks';
import { addDays, buildGoalInsights, summarizeHabit } from '../goalInsights';
import { monthDays, monthTotals } from '../progressMonth';
import type { Habit } from '../habitsSQLite';

const mockDirectory = mkdtempSync(join(tmpdir(), 'habyss-stress-'));
const mockPath = join(mockDirectory, 'stress.db');
let mockAdapter: ReturnType<typeof sqliteAdapter>;
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: async () => {
    mockAdapter = require('./support/realSQLite').sqliteAdapter(mockPath);
    return mockAdapter;
} }));
jest.mock('../localUser', () => ({ getLocalUserId: async () => 'stress-user' }));
jest.mock('../HealthKitService', () => ({ HealthKitService: {} }));
jest.mock('@/components/Layout/VoidCard', () => ({ VoidCard: () => null }));
jest.mock('../notificationService', () => ({ NotificationService: {
    refreshReminders: async () => undefined, refreshHabitReminders: async () => undefined, sendCompletionNotification: async () => undefined,
} }));
jest.mock('../SharedDefaults', () => ({ __esModule: true, default: { set: async () => undefined, reloadTimelines: async () => undefined } }));
jest.mock('../siriService', () => ({ SiriService: { syncProgressForSiri: async () => undefined } }));


jest.setTimeout(60000);
const DAYS = 3653, HABITS = 200, TASKS = 50000;
const dates = Array.from({ length: DAYS }, (_, index) => addDays('2016-01-01', index));
const history = Object.fromEntries(dates.map(date => [date, Array.from({ length: HABITS }, (_, id) => `h${id}`)]));

beforeAll(async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'hrtime', 'queueMicrotask'] });
    jest.setSystemTime(new Date(2026, 0, 4, 12));
    await getDatabase();
    const raw = mockAdapter.raw;
    raw.exec('BEGIN');
    const habit = raw.prepare("INSERT INTO habits (id,user_id,name,start_date,created_at,goal_value,unit,tracking_method,frequency,task_days,reminders,type,deleted) VALUES (?,'stress-user',?,'2016-01-01','2016-01-01T12:00:00Z',1,'books','numeric','daily','[]','[]','build',0)");
    const completion = raw.prepare("INSERT INTO completions (id,user_id,habit_id,date,value,skipped,deleted,created_at) VALUES (?,'stress-user',?,?,1,0,0,'2025-12-31T12:00:00Z')");
    for (let id = 0; id < HABITS; id++) {
        habit.run(`h${id}`, `Habit ${id}`);
        for (const date of dates) completion.run(`h${id}_${date}`, `h${id}`, date);
    }
    const task = raw.prepare("INSERT INTO tasks (id,user_id,title,due_date,status,completed_at,priority,created_at,updated_at,deleted) VALUES (?,'stress-user',?,'2025-12-31','done','2025-12-31T12:00:00Z',2,'2025-12-31T12:00:00Z','2025-12-31T12:00:00Z',0)");
    for (let id = 0; id < TASKS; id++) task.run(`t${id}`, `Task ${id}`);
    raw.exec('COMMIT');
});
afterAll(async () => {
    // Let fire-and-forget widget readers finish before closing the disposable database.
    await new Promise(resolve => setTimeout(resolve, 50));
    await closeDatabase();
    rmSync(mockDirectory, { recursive: true, force: true });
    jest.useRealTimers();
});

it('retains ten years of completions and reports lifetime habit statistics', async () => {
    const stats = await getHabitStats('h0');
    expect(stats.totalCompletions).toBe(DAYS);
    expect(stats.bestStreak).toBe(DAYS);
    const rows = await getLastNDaysCompletions(5000);
    expect(rows.reduce((total, day) => total + day.completedIds.length, 0)).toBe(DAYS * HABITS);
});
it('does not truncate a continuous ten-year streak to two years', () => {
    const habit = { id: 'h0', startDate: dates[0], createdAt: dates[0], frequency: 'daily' } as Habit;
    expect(summarizeHabit(habit, history, dates.at(-1)!).streak).toBe(DAYS);
});
it('builds a monthly report from 50,000 completed tasks without losing entries', async () => {
    const tasks = await getTasks({ includeDone: true });
    const started = performance.now();
    const days = monthDays({ habits: [], tasks, history: {}, month: new Date(2025, 11, 1), today: '2025-12-31' });
    expect(monthTotals(days).tasks).toBe(TASKS);
    const elapsed = performance.now() - started;
    console.info(`Stress: monthly report for ${TASKS} tasks took ${Math.round(elapsed)}ms`);
    expect(elapsed).toBeLessThan(3000);
});
it('handles concurrent re-imports of the same external task id', async () => {
    const results = await Promise.allSettled(Array.from({ length: 50 }, () => createTask({ title: 'Imported', externalId: 'same-external' })));
    expect(results.every(result => result.status === 'fulfilled')).toBe(true);
    expect(await mockAdapter.getFirstAsync("SELECT COUNT(*) AS count FROM tasks WHERE external_id = 'same-external'")).toEqual({ count: 1 });
});
it('allows re-importing a task after it was deleted', async () => {
    const first = await createTask({ title: 'Reimport', externalId: 'deleted-external' });
    await deleteTask(first!.id);
    const restored = await createTask({ title: 'Reimport again', externalId: 'deleted-external' });
    expect(restored?.title).toBe('Reimport again');
});
it('serializes 200 measurement additions without losing progress', async () => {
    const values = await Promise.all(Array.from({ length: 200 }, () => saveHabitMeasurement('h1', 0.1, '2026-01-02', true)));
    expect(values.at(-1)).toBe(20);
    expect(await getHabitMeasurement('h1', 1, '2026-01-02')).toBe(20);
});
it('rolls back a partial measurement write on failure, then recovers', async () => {
    await saveHabitMeasurement('h2', 0.5, '2026-01-02');
    mockAdapter.failSQL = 'INSERT INTO completions';
    await expect(saveHabitMeasurement('h2', 1, '2026-01-02')).rejects.toThrow('disk full');
    mockAdapter.failSQL = '';
    expect(await getHabitMeasurement('h2', 1, '2026-01-02')).toBe(0.5);
    await saveHabitMeasurement('h2', 2, '2026-01-02');
    expect(await getHabitMeasurement('h2', 1, '2026-01-02')).toBe(2);
});
it('toggles persisted completion correctly without warming the cache', async () => {
    const date = dates[0];
    await toggleCompletion('h3', date);
    expect((await getCompletions(date)).h3).toBeUndefined();
});
it('never reports a failed completion or skip as saved', async () => {
    mockAdapter.failSQL = 'INSERT INTO completions';
    try {
        await expect(toggleCompletion('h4', '2026-01-03')).rejects.toThrow('disk full');
        await expect(setSkipped('h4', true, '2026-01-03')).rejects.toThrow('disk full');
    } finally { mockAdapter.failSQL = ''; }
    expect((await getCompletions('2026-01-03')).h4).toBeUndefined();
    expect((await getSkipped('2026-01-03')).h4).toBeUndefined();
});
it('builds a full ten-year goal with 200 habits and 50,000 tasks', async () => {
    const habits = (await getHabits()).map(habit => ({ ...habit, goalId: 'long-goal' }));
    const tasks = (await getTasks({ includeDone: true })).filter(task => task.id.startsWith('t')).map(task => ({ ...task, goalId: 'long-goal' }));
    const goal = { id: 'long-goal', isGoal: true, startDate: dates[0], targetDate: dates.at(-1) } as Habit;
    const started = performance.now();
    const insights = buildGoalInsights({ goal, habits, tasks, history, today: dates.at(-1)! });
    const elapsed = performance.now() - started;
    console.info(`Stress: ten-year goal took ${Math.round(elapsed)}ms`);
    expect(insights.progress).toBe(100);
    expect(insights.series).toHaveLength(DAYS);
    expect(insights.habits.every(habit => habit.streak === DAYS)).toBe(true);
    expect(insights.tasks.done).toBe(TASKS);
    expect(elapsed).toBeLessThan(5000);
});
it('keeps completion and omitted fields when importing an existing task', async () => {
    const first = await createTask({ title: 'Import', dueDate: '2026-01-01', externalId: 'preserved' });
    await setTaskStatus(first!.id, 'done');
    const updated = await createTask({ title: 'Renamed', externalId: 'preserved' });
    expect(updated).toMatchObject({ id: first!.id, status: 'done', dueDate: '2026-01-01', title: 'Renamed' });
});
it('handles mixed progress changes in order and rejects overflowing totals', async () => {
    const date = '2026-01-03';
    await Promise.all([saveHabitMeasurement('h8', 0.5, date), setSkipped('h8', true, date), toggleCompletion('h8', date), saveHabitMeasurement('h8', 0.5, date, true)]);
    expect(await getHabitMeasurement('h8', 1, date)).toBe(1.5);
    expect((await getSkipped(date)).h8).toBeUndefined();
    await saveHabitMeasurement('h8', 100000000, date);
    await expect(saveHabitMeasurement('h8', 1, date, true)).rejects.toThrow('valid amount');
    expect(await getHabitMeasurement('h8', 1, date)).toBe(100000000);
});
it('does not ignore a missed scheduled day just because today is an off day', async () => {
    mockAdapter.raw.exec("INSERT INTO habits (id,user_id,name,start_date,created_at,task_days,deleted) VALUES ('weekly','stress-user','Weekly','2025-12-26','2025-12-26T12:00:00Z','[\"fri\"]',0)");
    await toggleCompletion('weekly', '2025-12-26');
    expect((await getHabitStats('weekly')).currentStreak).toBe(0);
    await setSkipped('weekly', true, '2026-01-02');
    expect(await getHabitStats('weekly')).toMatchObject({ currentStreak: 1, bestStreak: 1, totalDaysTracked: 1, completionRate: 100 });
});
it('keeps other habits readable when one imported optional field is malformed', async () => {
    mockAdapter.raw.exec("UPDATE habits SET reminders = '{broken', task_days = '[42]', location_reminders = 'null' WHERE id = 'h199'");
    clearHabitsCache();
    const habits = await getHabits();
    expect(habits).toHaveLength(HABITS + 1);
    const malformed = habits.find(habit => habit.id === 'h199')!;
    expect(Array.isArray(malformed.reminders)).toBe(true);
    expect(malformed.taskDays.every(day => typeof day === 'string')).toBe(true);
    expect(malformed.locationReminders).toEqual([]);
});
it('persists edits across database reopen and passes SQLite integrity checks', async () => {
    await updateTask('t0', { title: 'Edited repeatedly', dueDate: undefined });
    await new Promise(resolve => setTimeout(resolve, 50));
    // Simulate migration metadata left behind by an interrupted older upgrade.
    mockAdapter.raw.exec('UPDATE schema_version SET version = 0');
    await closeDatabase();
    await getDatabase();
    // Bump with SCHEMA_VERSION in lib/database.ts: this asserts every migration
    // ran, so it is meant to notice a new one.
    expect(await mockAdapter.getFirstAsync('SELECT version FROM schema_version')).toEqual({ version: 13 });
    expect(await mockAdapter.getFirstAsync('SELECT title, due_date FROM tasks WHERE id = ?', 't0')).toEqual({ title: 'Edited repeatedly', due_date: null });
    expect(await mockAdapter.getFirstAsync('PRAGMA integrity_check')).toEqual({ integrity_check: 'ok' });
});
