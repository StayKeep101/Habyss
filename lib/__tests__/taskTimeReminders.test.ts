import { buildTaskTimeReminders } from '../taskReminders';
import { parsePlaces, storePlaces } from '../places';
import type { Task } from '../tasks';

const task = (extra: Partial<Task>): Task => ({ id: 't', title: 'Call the bank', priority: 2, status: 'open', source: 'app', createdAt: '', updatedAt: '', ...extra } as Task);
const now = new Date(2026, 10, 9, 10, 0);

describe('a task reminded at its own time, as a habit is', () => {
    it('on its day, while open, never in the past', () => {
        const plan = buildTaskTimeReminders([
            task({ id: 'a', reminder: '14:30', dueDate: '2026-11-09' }),
            task({ id: 'b', reminder: '08:00', dueDate: '2026-11-09' }),
            task({ id: 'c', reminder: '09:00', dueDate: '2026-11-10' }),
            task({ id: 'd', reminder: '15:00', dueDate: '2026-11-09', status: 'done' }),
        ], now);
        expect(plan.map(item => [item.task.id, item.date.getHours()])).toEqual([['a', 14], ['c', 9]]);
    });
    it('today when it has no day; nothing past two days out', () => {
        expect(buildTaskTimeReminders([task({ reminder: '18:00' })], now)[0].date.getDate()).toBe(9);
        expect(buildTaskTimeReminders([task({ reminder: '09:00', dueDate: '2026-11-20' })], now)).toEqual([]);
    });
});

describe('places, read defensively', () => {
    it('keeps real places, arrive or leave only, and drops the rest', () => {
        const stored = storePlaces([{ name: 'Gym', latitude: 45.5, longitude: -73.6, trigger: 'leave' }, { name: 'x' } as never]);
        expect(parsePlaces(stored)).toEqual([{ name: 'Gym', latitude: 45.5, longitude: -73.6, radius: undefined, trigger: 'leave' }]);
        expect(parsePlaces('{bad')).toEqual([]);
        expect(storePlaces([])).toBeNull();
    });
});
