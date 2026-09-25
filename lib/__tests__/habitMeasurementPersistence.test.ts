const mockState = { amount: null as number | null, completion: null as number | null, fail: false };
const mockDb = {
    getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes('FROM habits')) return { goalValue: 8, unit: 'glasses', type: 'build' };
        if (sql.includes('habit_measurements')) return mockState.amount === null ? null : { value: mockState.amount };
        if (sql.includes('FROM completions')) return mockState.completion === null ? null : { value: mockState.completion };
        return null;
    }),
    runAsync: jest.fn(async (sql: string, ...args: any[]) => {
        if (mockState.fail) throw new Error('disk full');
        if (sql.includes('INSERT INTO habit_measurements')) mockState.amount = args[3];
        if (sql.includes('INSERT INTO completions')) mockState.completion = args[4];
        if (sql.includes('UPDATE completions SET deleted = 1')) mockState.completion = null;
    }),
    withExclusiveTransactionAsync: jest.fn(async (work: (db: any) => Promise<void>) => {
        const previous = { ...mockState };
        try { await work(mockDb); } catch (error) { Object.assign(mockState, previous); throw error; }
    }),
};
jest.mock('../database', () => ({ getDatabase: async () => mockDb, isSQLiteAvailable: () => false }));
jest.mock('../localUser', () => ({ getLocalUserId: async () => 'user' }));
jest.mock('../HealthKitService', () => ({ HealthKitService: {} }));
jest.mock('@/components/Layout/VoidCard', () => ({ VoidCard: () => null }));
jest.mock('../notificationService', () => ({ NotificationService: { refreshHabitReminders: jest.fn(async () => undefined) } }));
jest.mock('../SharedDefaults', () => ({ __esModule: true, default: { set: jest.fn(), reloadTimelines: jest.fn() } }));
jest.mock('../siriService', () => ({ SiriService: { syncProgressForSiri: jest.fn() } }));
import { DeviceEventEmitter } from 'react-native';
import { getHabitMeasurement, saveHabitMeasurement } from '../habitsSQLite';

beforeEach(() => { jest.clearAllMocks(); mockState.amount = null; mockState.completion = null; mockState.fail = false; });

describe('saved habit amounts', () => {
    it('restores partial progress without marking the day complete', async () => {
        await saveHabitMeasurement('h', 3, '2026-09-22');
        expect(await getHabitMeasurement('h', 8, '2026-09-22')).toBe(3);
        expect(mockState.completion).toBeNull();
    });
    it('completes on target, preserves extra progress, and reverses when corrected', async () => {
        await saveHabitMeasurement('h', 10, '2026-09-22');
        expect(mockState.completion).toBe(10);
        expect(await getHabitMeasurement('h', 8, '2026-09-22')).toBe(10);
        await saveHabitMeasurement('h', 7, '2026-09-22');
        expect(mockState.completion).toBeNull();
        expect(mockState.amount).toBe(7);
    });
    it('treats legacy binary check-ins as the full target', async () => {
        mockState.completion = 1;
        expect(await getHabitMeasurement('h', 8, '2026-09-22')).toBe(8);
    });
    it('serializes quick taps and background session additions without losing any', async () => {
        await Promise.all([
            saveHabitMeasurement('h', 2, '2026-09-22'),
            saveHabitMeasurement('h', 3, '2026-09-22', true),
            saveHabitMeasurement('h', 1, '2026-09-22', true),
        ]);
        expect(mockState.amount).toBe(6);
    });
    it('does not publish a failed write and permits a later retry', async () => {
        const listener = jest.fn();
        const sub = DeviceEventEmitter.addListener('habit_completion_updated', listener);
        mockState.fail = true;
        await expect(saveHabitMeasurement('h', 8, '2026-09-22')).rejects.toThrow('disk full');
        expect(listener).not.toHaveBeenCalled();
        expect(mockState.completion).toBeNull();
        mockState.fail = false;
        await saveHabitMeasurement('h', 8, '2026-09-22');
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({ completed: true, value: 8 }));
        sub.remove();
    });
    it('rejects invalid numeric input before writing', async () => {
        for (const value of [NaN, Infinity, -1, 100000001]) await expect(saveHabitMeasurement('h', value)).rejects.toThrow('valid amount');
        expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
});
