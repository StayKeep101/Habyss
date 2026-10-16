import { buildWatchHabits } from '../watchSync';
import type { Habit } from '../habitsSQLite';

const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const habit = (over: Partial<Habit>): Habit => ({ id: 'h', name: 'Habit', startDate: '2026-10-01', createdAt: '2026-10-01', taskDays: EVERY_DAY, ...over } as Habit);

describe('what the watch shows', () => {
    it('lists today’s habits, unfinished first, with their streaks', () => {
        const list = buildWatchHabits([
            habit({ id: 'read', name: 'Read' }),
            habit({ id: 'run', name: 'Run' }),
            habit({ id: 'goal', name: 'Goal', isGoal: true }),
            habit({ id: 'old', name: 'Old', isArchived: true }),
        ], { '2026-10-16': ['read'], '2026-10-15': ['read'] }, '2026-10-16');
        expect(list.map(item => [item.id, item.completed, item.streakCount])).toEqual([['run', false, 0], ['read', true, 2]]);
    });
});
