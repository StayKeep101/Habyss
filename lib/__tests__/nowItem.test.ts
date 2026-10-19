import { pickNow } from '../nowItem';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const habit = (over: Partial<Habit>): Habit => ({ id: 'h', name: 'Sourcing', startDate: '2026-10-01', createdAt: '2026-10-01', taskDays: EVERY_DAY, ...over } as Habit);
const at = (h: number, m: number) => new Date(2026, 9, 19, h, m);
const base = { tasks: [] as Task[], done: {}, today: '2026-10-19' };

describe('the thing for right now', () => {
    it('finds a habit inside a goal while its time is on, from ten minutes before', () => {
        const sourcing = habit({ goalId: 'g', startTime: '09:30', durationMinutes: 120 });
        expect(pickNow({ ...base, habits: [sourcing], now: at(9, 22) })?.state).toBe('now');
        expect(pickNow({ ...base, habits: [sourcing], now: at(11, 0) })).toMatchObject({ id: 'h', state: 'now' });
        expect(pickNow({ ...base, habits: [sourcing], now: at(11, 31) })).toBeNull();
    });

    it('says what is next when nothing is on, within a few hours', () => {
        const later = habit({ startTime: '14:00' });
        expect(pickNow({ ...base, habits: [later], now: at(12, 0) })).toMatchObject({ state: 'next', start: 14 * 60 });
        expect(pickNow({ ...base, habits: [later], now: at(9, 0) })).toBeNull();
    });

    it('skips what is done and includes timed tasks', () => {
        const sourcing = habit({ startTime: '09:30', durationMinutes: 120 });
        const call = { id: 't', title: 'Call supplier', status: 'open', dueDate: '2026-10-19', dueTime: '10:00' } as Task;
        expect(pickNow({ ...base, habits: [sourcing], tasks: [call], done: { h: true }, now: at(10, 5) })).toMatchObject({ kind: 'task', id: 't' });
    });
});
