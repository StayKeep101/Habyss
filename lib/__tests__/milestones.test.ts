import AsyncStorage from '@react-native-async-storage/async-storage';
import { announceDailyTarget, claimDailyTarget } from '../milestones';
import { emit } from '../appEvents';

jest.mock('../appEvents', () => ({ emit: jest.fn() }));

const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async (key: string) => (key in store ? store[key] : null)),
    setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn(async (key: string) => { delete store[key]; }),
}));

beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    jest.clearAllMocks();
});

describe('a moment is only stopped for once', () => {
    it('claims the day the first time and refuses after', async () => {
        expect(await claimDailyTarget('2026-09-26')).toBe(true);
        expect(await claimDailyTarget('2026-09-26')).toBe(false);
    });

    it('lets tomorrow be its own day', async () => {
        await claimDailyTarget('2026-09-26');
        expect(await claimDailyTarget('2026-09-27')).toBe(true);
    });

});

describe('what gets announced', () => {
    it('says nothing until the promise is actually kept', async () => {
        await announceDailyTarget(2, 3);
        expect(emit).not.toHaveBeenCalled();
    });

    it('announces once the target is met', async () => {
        await announceDailyTarget(3, 3);
        expect(emit).toHaveBeenCalledWith('daily_target_reached', { done: 3, target: 3 });
    });

    it('announces when it is beaten, too', async () => {
        await announceDailyTarget(5, 3);
        expect(emit).toHaveBeenCalledWith('daily_target_reached', { done: 5, target: 3 });
    });

    it('does not announce again while the day stays at or above the target', async () => {
        await announceDailyTarget(3, 3);
        await announceDailyTarget(4, 3);
        expect(emit).toHaveBeenCalledTimes(1);
    });

    it('announces again when a task is unticked and ticked back to the target', async () => {
        await announceDailyTarget(3, 3);
        await announceDailyTarget(2, 3);
        await announceDailyTarget(3, 3);
        expect(emit).toHaveBeenCalledTimes(2);
    });

    it('ignores a target of zero rather than celebrating nothing', async () => {
        await announceDailyTarget(0, 0);
        expect(emit).not.toHaveBeenCalled();
    });
});
