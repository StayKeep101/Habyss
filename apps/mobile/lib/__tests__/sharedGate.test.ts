import { counts, countedHistory, countedTasks, setGate } from '../sharedGate';
import { streakFrom, tallyDay } from '../dayComplete';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const habit = (id: string): Habit => ({ id, name: id, startDate: '2026-10-01', createdAt: '2026-10-01', taskDays: EVERY_DAY } as Habit);

describe('a shared item counts once everybody has done it', () => {
    beforeEach(() => setGate({
        items: { read: { others: ['sam'], since: '2026-10-10' }, call: { others: ['sam'], since: '2026-10-10' } },
        done: { read: { '2026-10-14': ['me', 'sam'] }, call: {} },
    }));
    afterAll(() => setGate({ items: {}, done: {} }));

    it('holds a day back until the others are done, from when the share began', () => {
        expect(counts('read', '2026-10-14')).toBe(true);
        expect(counts('read', '2026-10-15')).toBe(false);
        expect(counts('read', '2026-10-05')).toBe(true);
        expect(counts('solo', '2026-10-15')).toBe(true);
    });

    it('does not move the day\'s circle for a shared habit until the others are done', () => {
        const habits = [habit('read'), habit('solo')];
        // Both ticked on the 15th, but Sam has not read yet: only the solo one counts.
        expect(tallyDay(habits, { read: true, solo: true }, {}, [], '2026-10-15')).toMatchObject({ done: 1, total: 2 });
        // On the 14th Sam had done it too: both count.
        expect(tallyDay(habits, { read: true, solo: true }, {}, [], '2026-10-14')).toMatchObject({ done: 2, total: 2 });
    });

    it('leaves held-back ticks out of the history the stats read', () => {
        expect(countedHistory({ '2026-10-15': ['read', 'solo'], '2026-10-14': ['read'] }))
            .toEqual({ '2026-10-15': ['solo'], '2026-10-14': ['read'] });
    });

    it('keeps a shared task open for the stats until the others finish', () => {
        const task = { id: 'call', title: 'Call', priority: 2, status: 'done', source: 'app', completedAt: '2026-10-15T09:00:00', createdAt: '', updatedAt: '' } as Task;
        expect(countedTasks([task])[0].status).toBe('open');
    });

    it('does not let a half-done shared habit carry the streak', () => {
        const history = { '2026-10-15': ['read'], '2026-10-14': ['read'] };
        expect(streakFrom([habit('read')], [], history, {}, '2026-10-15').streak).toBe(1);
        setGate({ items: {}, done: {} });
        expect(streakFrom([habit('read')], [], history, {}, '2026-10-15').streak).toBe(2);
    });
});
