jest.mock('../habitsSQLite', () => ({
    removeHabitEverywhere: jest.fn(() => Promise.resolve()),
    setSkipped: jest.fn(() => Promise.resolve()),
    updateHabit: jest.fn(() => Promise.resolve()),
}));
import { endDateFromToday, hasHistoryToKeep, removeHabit } from '../habitRemoval';
import { removeHabitEverywhere, setSkipped, updateHabit } from '../habitsSQLite';

const now = new Date(2026, 2, 1, 9); // 1 March: yesterday crosses a month

describe('removing a repeating habit', () => {
    beforeEach(() => jest.clearAllMocks());

    it('ends it yesterday, so today is gone and the past stays', async () => {
        expect(endDateFromToday(now)).toBe('2026-02-28');
        await removeHabit({ id: 'h' }, 'from-today', now);
        expect(updateHabit).toHaveBeenCalledWith({ id: 'h', endDate: '2026-02-28' });
        expect(removeHabitEverywhere).not.toHaveBeenCalled();
    });

    it('skips only today', async () => {
        await removeHabit({ id: 'h' }, 'today', now);
        expect(setSkipped).toHaveBeenCalledWith('h', true, '2026-03-01');
    });

    it('deletes everything only when asked', async () => {
        await removeHabit({ id: 'h' }, 'everything', now);
        expect(removeHabitEverywhere).toHaveBeenCalledWith('h');
    });

    it('has no history to keep for a habit begun today', () => {
        expect(hasHistoryToKeep({ startDate: '2026-03-01', createdAt: '2026-03-01T08:00:00Z' }, now)).toBe(false);
        expect(hasHistoryToKeep({ startDate: '2026-01-10', createdAt: '2026-01-10T08:00:00Z' }, now)).toBe(true);
    });
});
