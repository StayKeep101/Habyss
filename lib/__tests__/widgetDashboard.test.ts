import { buildWidgetDashboard, parseWidgetEvent } from '../widgetDashboard';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';
const today = '2026-09-26';
const task = (over: Partial<Task> = {}) => ({ id: 'task', title: 'Task', status: 'open', dueDate: today,
    priority: 2, source: 'app', createdAt: today, updatedAt: today, ...over } as Task);
const habit = (over: Partial<Habit> = {}) => ({ id: 'habit', name: 'Run', startDate: '2026-09-25',
    createdAt: '2026-09-25', taskDays: [], frequency: 'daily', ...over } as Habit);
const build = (over: Partial<Parameters<typeof buildWidgetDashboard>[0]> = {}) => buildWidgetDashboard({ habits: [], tasks: [],
    history: {}, skips: {}, today, accent: { from: '#FF0000', to: '#FFFF00' }, ...over });

it('Daily Tasks includes overdue and undated work, and excludes future or cancelled work', () => {
    const snapshot = build({ habits: [habit()], tasks: [task(), task({ id: 'old', dueDate: '2026-09-25' }),
        task({ id: 'undated', dueDate: undefined }), task({ id: 'later', dueDate: '2026-09-27' }), task({ id: 'cancelled', status: 'cancelled' })] });
    expect(snapshot.days).toHaveLength(8);
    expect(snapshot.days[0].items.map(item => item.id)).toEqual(['task:old', 'task:task', 'task:undated']);
    expect(snapshot.days[1].items.map(item => item.id)).toContain('task:later');
    expect(snapshot.days[0].total).toBe(3);
});
it('keeps truthful counts when only twelve of a large task list are sent', () => {
    const snapshot = build({ tasks: Array.from({ length: 100 }, (_, index) => task({ id: String(index), status: index < 20 ? 'done' : 'open' })) });
    expect(snapshot.days[0]).toMatchObject({ total: 100, completed: 20 });
    expect(snapshot.days[0].items).toHaveLength(12);
    expect(snapshot.days[0].items.every(item => !item.isCompleted)).toBe(true);
});
it('heatmap counts only due habits and excludes skipped or archived rows', () => {
    const snapshot = build({ habits: [habit(), habit({ id: 'skip' }), habit({ id: 'archived', isArchived: true }), habit({ id: 'sunday', taskDays: ['sun'] })],
        history: { [today]: ['habit', 'archived'] }, skips: { [today]: ['skip'] } });
    expect(snapshot.heatmap).toHaveLength(98);
    expect(snapshot.heatmap.find(day => day.date === today)).toEqual({ date: today, completed: 1, total: 1 });
});
it('uses the same goal progress as the app and supplies the exact task contribution', () => {
    const goal = habit({ id: 'goal', isGoal: true, targetDate: today, color: '#00FF00' });
    const snapshot = build({ habits: [goal, habit({ goalId: 'goal' })], tasks: [task({ goalId: 'goal' })],
        history: { '2026-09-25': ['habit'], [today]: ['habit'] } });
    // A goal with no number is a project: its one task is the whole of it, so
    // ticking that task on the widget takes it from 0 to 100.
    expect(snapshot.goals[0]).toMatchObject({ id: 'goal', progress: 0, color: '#00FF00', taskWeights: { 'task:task': 100 } });
});
it('rejects corrupt widget actions instead of writing them into history', () => {
    const valid = { eventId: 'uuid', id: 'habit:abc', day: today, done: true, timestamp: 1 };
    expect(parseWidgetEvent(JSON.stringify(valid))).toEqual(valid);
    for (const raw of ['{broken', 'null', JSON.stringify({ ...valid, day: '2026-02-30' }), JSON.stringify({ ...valid, done: 'true' }), JSON.stringify({ ...valid, id: '' })]) {
        expect(parseWidgetEvent(raw)).toBeNull();
    }
});

it('carries the app streak and an actual history graph for each selectable goal', () => {
    const snapshot = build({ streak: 7, habits: [habit({ id: 'goal', isGoal: true, targetDate: today }), habit({ goalId: 'goal' })],
        history: { '2026-09-25': ['habit'], [today]: ['habit'] } });
    expect(snapshot.streak).toBe(7);
    expect(snapshot.goals[0].points).toEqual([{ date: '2026-09-25', actual: 50 }, { date: today, actual: 100 }]);
    expect(snapshot.goals[0].progress).toBe(100);
});
it('bounds long goal graphs without losing their first and last dates', () => {
    const snapshot = build({ habits: [habit({ id: 'goal', isGoal: true, startDate: '2025-01-01', targetDate: today })] });
    expect(snapshot.goals[0].points).toHaveLength(90);
    expect(snapshot.goals[0].points[0].date).toBe('2025-01-01');
    expect(snapshot.goals[0].points.at(-1)?.date).toBe(today);
});
it('keeps habits out of Daily Tasks even when they are the only scheduled items', () => {
    const snapshot = build({ habits: [habit()] });
    expect(snapshot.days[0].items).toEqual([]);
    expect(snapshot.days[0].total).toBe(0);
    expect(snapshot.heatmap.find(day => day.date === today)?.total).toBe(1);
});

it('the streak widget can follow one habit: its own streak and its own days', () => {
    const snapshot = build({ habits: [habit({ startDate: '2026-09-20', createdAt: '2026-09-20' }), habit({ id: 'read', name: 'Read', startDate: '2026-09-20', createdAt: '2026-09-20' })],
        history: { '2026-09-23': ['habit'], '2026-09-24': ['habit'], '2026-09-25': ['habit', 'read'], [today]: ['habit'] },
        skips: { '2026-09-24': ['read'] } });
    const run = snapshot.habits.find(item => item.id === 'habit')!;
    const read = snapshot.habits.find(item => item.id === 'read')!;
    expect(run.streak).toBe(4);
    // Read: done the 25th, skipped the 24th (not due, so not a break), missed the 23rd. Today still open.
    expect(read.streak).toBe(1);
    expect(run.days).toHaveLength(snapshot.heatmap.length);
    const at = (date: string) => snapshot.heatmap.findIndex(day => day.date === date);
    expect(read.days[at('2026-09-24')]).toBe('-');
    expect(read.days[at('2026-09-23')]).toBe('0');
    expect(read.days[at('2026-09-25')]).toBe('1');
    expect(read.days[at('2026-09-10')]).toBe('-'); // before it started
});
