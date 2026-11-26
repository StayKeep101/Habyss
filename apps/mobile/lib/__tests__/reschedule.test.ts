const store: Record<string, string> = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => { store[key] = value; }),
}));

import { currentReschedules, reschedule, reschedulesFor } from '../reschedule';

describe('reschedules', () => {
    it('keeps the latest minute for each one, today only', async () => {
        await reschedule('2026-10-28', 'bugs', 580);
        await reschedule('2026-10-28', 'bugs', 600);
        await reschedule('2026-10-28', 'mom', 610);
        expect(reschedulesFor(currentReschedules(), '2026-10-28')).toEqual({ bugs: 600, mom: 610 });
        expect(reschedulesFor(currentReschedules(), '2026-10-29')).toEqual({});
        // A new day starts empty.
        await reschedule('2026-10-29', 'walk', 500);
        expect(reschedulesFor(currentReschedules(), '2026-10-29')).toEqual({ walk: 500 });
        expect(reschedulesFor(currentReschedules(), '2026-10-28')).toEqual({});
    });
});
