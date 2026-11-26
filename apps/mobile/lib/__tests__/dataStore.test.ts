import { emit } from '../appEvents';
import { ensureData, getData, historyWindow, resetDataForTests } from '../dataStore';
import { localDateKey } from '../habitSchedule';

const today = localDateKey(new Date());
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return localDateKey(d); };

const mockHistory = jest.fn(async (days: number) => Array.from({ length: days }, (_, index) => {
    const date = daysAgo(days - 1 - index);
    return { date, completedIds: date === daysAgo(1) ? ['read'] : [], skippedIds: [] };
}));
const mockTasks = jest.fn(async () => [{ id: 't1', title: 'Ship', status: 'open' }]);

jest.mock('../habitsSQLite', () => ({
    getHabits: async () => [{ id: 'read', name: 'Read', startDate: '2020-01-01', createdAt: '2020-01-01' }],
    getLastNDaysCompletions: (days: number) => mockHistory(days),
}));
jest.mock('../tasks', () => ({ getTasks: () => mockTasks() }));

beforeEach(() => { resetDataForTests(); jest.clearAllMocks(); });

describe('the shared data store', () => {
    it('loads every day since the first habit started, in one query', async () => {
        await ensureData();
        await ensureData();
        expect(mockHistory).toHaveBeenCalledTimes(1);
        expect(getData().since).toBe('2020-01-01');
        expect(getData().history[daysAgo(1)]).toEqual(['read']);
        expect(getData().tasks).toHaveLength(1);
    });

    it('writes a tick into memory without reading the database again', async () => {
        await ensureData();
        emit('habit_completion_updated', { habitId: 'read', date: today, completed: true, skipped: false });
        expect(getData().history[today]).toEqual(['read']);
        emit('habit_completion_updated', { habitId: 'read', date: today, completed: false, skipped: true });
        expect(getData().history[today]).toEqual([]);
        expect(getData().skips[today]).toEqual(['read']);
        expect(mockHistory).toHaveBeenCalledTimes(1);
    });

    it('gives every screen the same window object until something changes', async () => {
        await ensureData();
        const first = historyWindow(90);
        expect(historyWindow(90)).toBe(first);
        expect(first.rows).toHaveLength(90);
        expect(first.rows[first.rows.length - 1].date).toBe(today);
        emit('habit_completion_updated', { habitId: 'read', date: today, completed: true, skipped: false });
        expect(historyWindow(90)).not.toBe(first);
        expect(historyWindow(90).history[today]).toEqual(['read']);
    });

    it('reloads tasks when they change anywhere', async () => {
        await ensureData();
        emit('tasks_changed');
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(mockTasks).toHaveBeenCalledTimes(2);
    });
});
