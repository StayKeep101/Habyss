import { respondToCheckIn } from '../checkInResponse';
import type { Task } from '../tasks';

const TODAY = '2026-11-21';
const task = (id: string, title: string, difficulty: 1 | 2 | 3, createdAt = '2026-11-21T08:00:00'): Task =>
    ({ id, title, status: 'open', difficulty, dueDate: TODAY, createdAt, priority: 2 } as Task);
const base = { tasks: [task('a', 'Email', 1), task('b', 'Write report', 3, '2026-11-10T08:00:00')], habitsLeft: [{ id: 'h', name: 'Walk' }], today: TODAY };

describe('respondToCheckIn', () => {
    it('low energy offers to move the hardest task to tomorrow', () => {
        const r = respondToCheckIn({ ...base, kind: 'energy', value: 1 });
        expect(r.line).toContain('Write report');
        expect(r.actions[0]).toMatchObject({ kind: 'move_tomorrow', taskId: 'b' });
    });
    it('high energy starts focus on the hardest', () => {
        expect(respondToCheckIn({ ...base, kind: 'energy', value: 5 }).actions[0]).toMatchObject({ kind: 'focus', id: 'b' });
    });
    it('a low mood points at the habit that lifts it', () => {
        const r = respondToCheckIn({ ...base, kind: 'mood', value: 2, moodHabit: { id: 'h', name: 'Walk' } });
        expect(r.line).toContain('days you do Walk feel better');
        expect(r.actions[0]).toMatchObject({ kind: 'focus', item: 'habit', id: 'h' });
    });
    it('a good mood goes to the task put off longest', () => {
        expect(respondToCheckIn({ ...base, kind: 'mood', value: 5 }).actions[0]).toMatchObject({ kind: 'focus', id: 'b' });
    });
    it('okay is just noted', () => {
        expect(respondToCheckIn({ ...base, kind: 'mood', value: 3 }).actions).toEqual([{ kind: 'done', label: 'Got it' }]);
    });
});
