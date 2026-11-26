import { halfwayPoint, middayRecap } from '../middayRecap';

const at = (hours: number, minutes = 0) => { const date = new Date(2026, 10, 17, hours, minutes); return date; };

describe('halfwayPoint', () => {
    it('is the middle of the waking hours', () => {
        const point = halfwayPoint({ wake: '07:00', sleep: '23:00' } as never, at(9))!;
        expect([point.getDate(), point.getHours(), point.getMinutes()]).toEqual([17, 15, 0]);
    });

    it('counts a bedtime past midnight as the same day', () => {
        const point = halfwayPoint({ wake: '09:00', sleep: '01:00' } as never, at(10))!;
        expect([point.getDate(), point.getHours()]).toEqual([17, 17]);
    });

    it('is tomorrow once today\'s has passed', () => {
        const point = halfwayPoint({ wake: '07:00', sleep: '23:00' } as never, at(16))!;
        expect([point.getDate(), point.getHours()]).toEqual([18, 15]);
    });

    it('keeps a night shift\'s middle on the day it began', () => {
        // Awake 20:00 to 12:00: the middle is 04:00 the next morning.
        const point = halfwayPoint({ wake: '20:00', sleep: '12:00' } as never, at(1))!;
        expect([point.getDate(), point.getHours()]).toEqual([17, 4]);
    });
});

describe('middayRecap', () => {
    it('says what is done and what is left', () => {
        expect(middayRecap({ habitsDone: 1, habitsDue: 4, tasksDone: 0, tasksDue: 2, focused: 45 * 60 }).body)
            .toBe('1 of 4 habits · 0 of 2 tasks · 45m focused. 5 left, and half the day to do them.');
    });

    it('is ahead at half or more', () => {
        expect(middayRecap({ habitsDone: 2, habitsDue: 3, tasksDone: 1, tasksDue: 1, focused: 0 }, 'Sam'))
            .toEqual({ title: 'Halfway through your day, Sam', body: '2 of 3 habits · 1 of 1 task. Ahead of the clock. 1 left.' });
    });

    it('celebrates a finished list and invites a plan on an empty one', () => {
        expect(middayRecap({ habitsDone: 2, habitsDue: 2, tasksDone: 0, tasksDue: 0, focused: 90 * 60 }).body)
            .toBe('2 of 2 habits · 1h 30m focused. All done already. The afternoon is yours.');
        expect(middayRecap({ habitsDone: 0, habitsDue: 0, tasksDone: 0, tasksDue: 0, focused: 0 }).body)
            .toBe('Nothing planned yet. Plan the afternoon?');
    });

    it('nudges when nothing is ticked', () => {
        expect(middayRecap({ habitsDone: 0, habitsDue: 3, tasksDone: 0, tasksDue: 0, focused: 0 }).body)
            .toBe('0 of 3 habits. Nothing ticked yet. Start with the smallest one.');
    });
});
