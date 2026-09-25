import { buildWidgetPayload, parseWidgetId } from '../widgetSync';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

const TODAY = '2026-09-22'; // a Tuesday
const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h', name: 'Run', startDate: '2026-09-01', createdAt: '2026-09-01',
    taskDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    ...over,
} as Habit);
const task = (over: Partial<Task> = {}): Task => ({
    id: Math.random().toString(36).slice(2), title: 'Task', priority: 2, status: 'open', source: 'app',
    createdAt: '2026-09-01', updatedAt: '2026-09-01', ...over,
});

const build = (over: Partial<Parameters<typeof buildWidgetPayload>[0]> = {}) =>
    buildWidgetPayload({ habits: [], tasks: [], completions: {}, skipped: {}, today: TODAY, ...over });

describe('what the widget is told', () => {
    it('sends today, not every habit the user has ever kept', () => {
        const payload = build({
            habits: [habit({ id: 'a', name: 'Run' }), habit({ id: 'b', name: 'Church', taskDays: ['sun'] })],
        });
        expect(payload.items.map(item => item.name)).toEqual(['Run']);
        expect(payload.total).toBe(1);
    });

    it('carries tasks due today alongside the habits', () => {
        const payload = build({
            habits: [habit({ id: 'a', name: 'Run', startTime: '07:00' })],
            tasks: [task({ id: 't1', title: 'Call the bank', dueDate: TODAY }), task({ title: 'Later', dueDate: '2026-10-01' })],
        });
        expect(payload.items).toEqual([
            { id: 'habit:a', name: 'Run', isCompleted: false },
            { id: 'task:t1', name: 'Call the bank', isCompleted: false },
        ]);
        expect(payload.total).toBe(2);
    });

    it('puts what is left first, because only three rows fit', () => {
        const payload = build({
            habits: [
                habit({ id: 'a', name: 'Early', startTime: '06:00' }),
                habit({ id: 'b', name: 'Late', startTime: '20:00' }),
            ],
            tasks: [task({ id: 't1', title: 'Errand', dueDate: TODAY })],
            completions: { a: true },
        });
        expect(payload.items.map(item => item.name)).toEqual(['Late', 'Errand', 'Early']);
        expect(payload.nextUp).toBe('Late');
        expect(payload.completed).toBe(1);
        expect(payload.total).toBe(3);
    });

    it('leaves out anything the user skipped today', () => {
        const payload = build({
            habits: [habit({ id: 'a', name: 'Run' }), habit({ id: 'b', name: 'Cold shower' })],
            skipped: { b: true },
        });
        expect(payload.items.map(item => item.name)).toEqual(['Run']);
        expect(payload.total).toBe(1);
    });

    it('has nothing to say on a day that asks for nothing', () => {
        const payload = build();
        expect(payload.items).toEqual([]);
        expect(payload.nextUp).toBeUndefined();
        expect(payload.total).toBe(0);
    });

    it('agrees with the app once everything is done', () => {
        const payload = build({
            habits: [habit({ id: 'a' })],
            tasks: [task({ id: 't1', dueDate: TODAY, status: 'done' })],
            completions: { a: true },
            streak: 12,
        });
        expect(payload.dayKey).toBe(TODAY);
        expect(payload.completed).toBe(payload.total);
        expect(payload.nextUp).toBeUndefined();
        expect(payload.streak).toBe(12);
    });
});

describe('a row ticked on the widget', () => {
    it('says what it was and what the user chose', () => {
        expect(parseWidgetId('habit:abc|1')).toEqual({ kind: 'habit', id: 'abc', done: true });
        expect(parseWidgetId('task:xyz|0')).toEqual({ kind: 'task', id: 'xyz', done: false });
    });

    it('still reads an id written by an older build', () => {
        expect(parseWidgetId('abc')).toEqual({ kind: 'habit', id: 'abc', done: true });
    });
});
