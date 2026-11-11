jest.mock('../supabase', () => ({ getSupabase: () => null }));
import { earnsFreeze, earnFreezeIfDue } from '../streakFreeze';

describe('earning a streak freeze', () => {
    it('comes on each 7th day of a run', () => {
        expect([0, 1, 6, 8, 13].map(earnsFreeze)).toEqual([false, false, false, false, false]);
        expect([7, 14, 21].map(earnsFreeze)).toEqual([true, true, true]);
    });
    it('asks nothing of the server on other days', async () => {
        await expect(earnFreezeIfDue(5)).resolves.toBe('not_yet');
    });
    it('waits for a connection on a 7th day', async () => {
        await expect(earnFreezeIfDue(7)).resolves.toBe('offline');
    });
});
