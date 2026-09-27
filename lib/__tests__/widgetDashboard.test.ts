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
    expect(snapshot.days[0].items.map(item => item.id)).toEqual(['task:task', 'task:old', 'task:undated']);
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
    expect(snapshot.goals[0]).toMatchObject({ id: 'goal', progress: 50, color: '#00FF00', taskWeights: { 'task:task': 50 } });
});
it('rejects corrupt widget actions instead of writing them into history', () => {
    const valid = { eventId: 'uuid', id: 'habit:abc', day: today, done: true, timestamp: 1 };
    expect(parseWidgetEvent(JSON.stringify(valid))).toEqual(valid);
    for (const raw of ['{broken', 'null', JSON.stringify({ ...valid, day: '2026-02-30' }), JSON.stringify({ ...valid, done: 'true' }), JSON.stringify({ ...valid, id: '' })]) {
        expect(parseWidgetEvent(raw)).toBeNull();
    }
});
