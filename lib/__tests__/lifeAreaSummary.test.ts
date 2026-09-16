import type { Habit } from '../habitsSQLite';
import { buildLifeAreaSummary, lifeAreaForCategory } from '../lifeAreaSummary';

const habit = (overrides: Partial<Habit> = {}): Habit => ({
    id: 'habit', name: 'Read', category: 'mind', createdAt: '2026-01-01', startDate: '2026-01-01',
    type: 'build', color: '#fff', goalPeriod: 'daily', goalValue: 1, unit: 'count',
    taskDays: [], reminders: [], chartType: 'bar', isArchived: false, showMemo: false,
    ...overrides,
});
const now = new Date(2026, 8, 16, 23, 30);

describe('Life Matrix completion data', () => {
    it('counts only scheduled opportunities, excluding goals, archives and duplicate or off-schedule check-ins', () => {
        const areas = buildLifeAreaSummary({
            habits: [
                habit({ frequency: 'weekly', taskDays: ['mon', 'wed', 'fri'] }),
                habit({ id: 'goal', isGoal: true }),
                habit({ id: 'archive', isArchived: true }),
            ],
            history: [
                { date: '2026-09-09', completedIds: ['habit'] },
                { date: '2026-09-11', completedIds: ['habit', 'goal', 'archive'] },
                { date: '2026-09-12', completedIds: ['habit'] },
                { date: '2026-09-14', completedIds: ['habit', 'habit'] },
                { date: '2026-09-16', completedIds: ['habit'] },
                { date: '2026-09-17', completedIds: ['habit'] },
            ],
            completions: { habit: false },
            now,
        });
        expect(areas.find(area => area.id === 'mind')).toMatchObject({ completed: 2, scheduled: 3, rate: 2 / 3 });
        expect(areas.find(area => area.id === 'mind')?.habits).toHaveLength(1);
        expect(areas.find(area => area.id === 'body')).toMatchObject({ completed: 0, scheduled: 0, rate: null });
    });

    it('uses the live map for both completion and undo today', () => {
        const input = { habits: [habit()], history: [{ date: '2026-09-16', completedIds: ['habit'] }], now, days: 1 };
        expect(buildLifeAreaSummary({ ...input, completions: {} }).find(area => area.id === 'mind')?.rate).toBe(0);
        expect(buildLifeAreaSummary({ ...input, completions: { habit: true } }).find(area => area.id === 'mind')?.rate).toBe(1);
    });

    it('does not count days before a new habit starts or after it ends', () => {
        const areas = buildLifeAreaSummary({
            habits: [habit({ startDate: '2026-09-14', endDate: '2026-09-15' })],
            history: [{ date: '2026-09-14', completedIds: ['habit'] }], completions: {}, now,
        });
        expect(areas.find(area => area.id === 'mind')).toMatchObject({ completed: 1, scheduled: 2, rate: 0.5 });
    });

    it('keeps older categories visible and leaves personal habits in Other', () => {
        expect(lifeAreaForCategory('fitness')).toBe('body');
        expect(lifeAreaForCategory('finance')).toBe('wealth');
        expect(lifeAreaForCategory('family')).toBe('heart');
        expect(lifeAreaForCategory('creativity')).toBe('play');
        const areas = buildLifeAreaSummary({ habits: [habit({ category: 'personal' })], history: [], completions: {}, now });
        expect(areas).toHaveLength(7);
        expect(areas.find(area => area.id === 'other')?.scheduled).toBe(7);
    });

    it('puts habits still due today ahead of completed habits in the drilldown', () => {
        const areas = buildLifeAreaSummary({ habits: [habit({ id: 'done', name: 'A done' }), habit({ id: 'pending', name: 'Z pending' })], history: [], completions: { done: true }, now });
        expect(areas.find(area => area.id === 'mind')?.habits.map(item => item.habit.id)).toEqual(['pending', 'done']);
    });
});
