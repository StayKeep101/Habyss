import AsyncStorage from '@react-native-async-storage/async-storage';
import { announceDailyTarget, announceGoalComplete, claimDailyTarget, claimGoal, forgetGoal } from '../milestones';
import { emit } from '../appEvents';

jest.mock('../appEvents', () => ({ emit: jest.fn() }));

const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async (key: string) => (key in store ? store[key] : null)),
    setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
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

    it('claims a goal once, however many times it crosses the line', async () => {
        // Un-ticking a habit and re-ticking it must not announce again.
        expect(await claimGoal('g1')).toBe(true);
        expect(await claimGoal('g1')).toBe(false);
        expect(await claimGoal('g1')).toBe(false);
    });

    it('keeps goals apart', async () => {
        await claimGoal('g1');
        expect(await claimGoal('g2')).toBe(true);
    });

    it('can be made to forget one, so a reopened goal counts again', async () => {
        await claimGoal('g1');
        await forgetGoal('g1');
        expect(await claimGoal('g1')).toBe(true);
    });

    it('refuses a goal with no id rather than claiming an empty one', async () => {
        expect(await claimGoal('')).toBe(false);
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

    it('does not announce the same day twice', async () => {
        await announceDailyTarget(3, 3);
        await announceDailyTarget(4, 3);
        expect(emit).toHaveBeenCalledTimes(1);
    });

    it('carries the goal name, because that is what is worth reading', async () => {
        await announceGoalComplete('g1', 'Read 4 books');
        expect(emit).toHaveBeenCalledWith('goal_complete', { goalId: 'g1', name: 'Read 4 books' });
    });

    it('ignores a target of zero rather than celebrating nothing', async () => {
        await announceDailyTarget(0, 0);
        expect(emit).not.toHaveBeenCalled();
    });
});
