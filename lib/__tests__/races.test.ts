jest.mock('../supabase', () => ({ getSupabase: () => null }));
import { betPayout, expectedMinutes, ownerWin, raceDone, raceTimes, raceTitle, speedBonus, timeLeft, timeUsed } from '../races';

describe('race the clock', () => {
    it('only lets you race faster than the tasks should take', () => {
        expect(expectedMinutes([{}, {}, {}])).toBe(270);
        expect(expectedMinutes([{ estimatedMinutes: 30 }, {}])).toBe(120);
        const times = raceTimes(270);
        expect(times[0]).toBe(15);
        expect(times[times.length - 1]).toBe(270);
        expect(raceTimes(10)).toEqual([15]);
        expect(raceTimes(5000).pop()).toBe(720);
    });

    it('names a race by what it is', () => {
        expect(raceTitle(3, 180)).toBe('3 tasks in 3 hours');
        expect(raceTitle(1, 60)).toBe('1 task in 1 hour');
        expect(raceTitle(2, 90)).toBe('2 tasks in 1h 30m');
        expect(raceTitle(2, 45)).toBe('2 tasks in 45 minutes');
    });

    it('says how long is left', () => {
        expect(timeLeft(1_000 + 5_100_000, 1_000)).toBe('1h 25m left');
        expect(timeLeft(42_000, 0)).toBe('0:42 left');
        expect(timeLeft(0, 10)).toBe('0:00 left');
    });

    it('a win pays the stake back, matched up to 500 on the first race of the day', () => {
        expect(ownerWin(500, true)).toBe(1000);
        expect(ownerWin(2000, true)).toBe(2500);
        expect(ownerWin(500, false)).toBe(500);
    });

    it('pays more the faster it is done: as much again within half the time, nothing at the clock', () => {
        expect(speedBonus(200, 0.3)).toBe(200);
        expect(speedBonus(200, 0.5)).toBe(200);
        expect(speedBonus(200, 0.75)).toBe(100);
        expect(speedBonus(200, 1)).toBe(0);
        expect(speedBonus(5000, 0)).toBe(500);
        expect(ownerWin(200, true, 0.75)).toBe(500);
        expect(timeUsed({ startsAt: 0, endsAt: 100 }, 25)).toBe(0.25);
        expect(timeUsed({ startsAt: 0, endsAt: 100 }, 500)).toBe(1);
    });

    it('a bet against gets a share of the owner\'s stake when it is missed', () => {
        // Nobody else: against takes its 50 back plus the owner's 500.
        expect(betPayout(50, 'against', { for: 0, against: 0 }, 500)).toBe(550);
        // For, with 100 against already: back plus all of it.
        expect(betPayout(100, 'for', { for: 0, against: 100 }, 500)).toBe(200);
    });

    it('is done when every task was ticked before the clock (two minutes\' grace)', () => {
        const race = { endsAt: Date.parse('2026-11-22T21:00:00Z'), tasks: [{ key: 'a', title: 'A' }, { key: 'b', title: 'B' }] };
        expect(raceDone(race, [{ id: 'a', status: 'done', completedAt: '2026-11-22T20:00:00Z' }, { id: 'b', status: 'open' }])).toBe(false);
        expect(raceDone(race, [{ id: 'a', status: 'done', completedAt: '2026-11-22T20:00:00Z' }, { id: 'b', status: 'done', completedAt: '2026-11-22T21:01:00Z' }])).toBe(true);
        expect(raceDone(race, [{ id: 'a', status: 'done', completedAt: '2026-11-22T20:00:00Z' }, { id: 'b', status: 'done', completedAt: '2026-11-22T21:05:00Z' }])).toBe(false);
    });
});
