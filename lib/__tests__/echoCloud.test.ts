jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../supabase', () => ({ getSupabase: () => null }));
import { acceptCloudLine, cloudAllowed, cloudOpeningLine, CLOUD_GAP_MS, CLOUD_PER_DAY } from '../echoCloud';

describe('Smarter Echo', () => {
    const now = 10_000_000;
    it('speaks a few times a day at most, hours apart', () => {
        expect(cloudAllowed(null, '2026-11-11', now)).toBe(true);
        expect(cloudAllowed({ day: '2026-11-10', count: 9, lastAt: now }, '2026-11-11', now)).toBe(true);
        expect(cloudAllowed({ day: '2026-11-11', count: 1, lastAt: now - 60_000 }, '2026-11-11', now)).toBe(false);
        expect(cloudAllowed({ day: '2026-11-11', count: 1, lastAt: now - CLOUD_GAP_MS }, '2026-11-11', now)).toBe(true);
        expect(cloudAllowed({ day: '2026-11-11', count: CLOUD_PER_DAY, lastAt: 0 }, '2026-11-11', now)).toBe(false);
    });
    it('uses a line only when it reads as Echo talking to you', () => {
        expect(acceptCloudLine('Mornings were rough last week. Five minutes of it now?')).toBe(true);
        expect(acceptCloudLine('You are 47% done.')).toBe(false);
        expect(acceptCloudLine("I'm Sam and I've got this", 'Sam')).toBe(false);
        expect(acceptCloudLine('Same again', undefined, ['Same again'])).toBe(false);
        expect(acceptCloudLine(null)).toBe(false);
    });
    it('says nothing when off or offline, so the written lines answer', async () => {
        const ask = { voice: 'normal' as const, facts: [], remembered: [], said: [] };
        await expect(cloudOpeningLine(false, '2026-11-11', ask)).resolves.toBeNull();
        await expect(cloudOpeningLine(true, '2026-11-11', ask)).resolves.toBeNull();
    });
});
