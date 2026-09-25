jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn() }));

import { buildCheckInPlan } from '../echoCheckIns';
import { eveningCheckIn, morningCheckIn, type DayWindow } from '../echo';

const day: DayWindow = { wake: '07:00', sleep: '23:00' };
const both = { morning: true, evening: true, useName: true };

describe('when Echo checks in', () => {
    it('lands shortly after waking and an hour before bed', () => {
        expect(morningCheckIn(day)).toBe('07:30');
        expect(eveningCheckIn(day)).toBe('22:00');
    });

    it('says nothing at all when the user asked for neither', () => {
        expect(buildCheckInPlan({ morning: false, evening: false }, day, new Date(2026, 8, 22, 6))).toEqual([]);
    });

    it('plans today and tomorrow, in order', () => {
        const plan = buildCheckInPlan(both, day, new Date(2026, 8, 22, 6));
        expect(plan.map(item => item.kind)).toEqual(['morning', 'evening', 'morning', 'evening']);
        expect(plan[0].date).toEqual(new Date(2026, 8, 22, 7, 30));
        expect(plan[3].date).toEqual(new Date(2026, 8, 23, 22, 0));
    });

    it('never schedules a time that has already gone', () => {
        const plan = buildCheckInPlan(both, day, new Date(2026, 8, 22, 12));
        expect(plan[0].date).toEqual(new Date(2026, 8, 22, 22, 0));
        expect(plan.every(item => item.date.getTime() > Date.now() - 1e9)).toBe(true);
    });

    it('only plans the half the user turned on', () => {
        const plan = buildCheckInPlan({ morning: true, evening: false }, day, new Date(2026, 8, 22, 6));
        expect(plan.every(item => item.kind === 'morning')).toBe(true);
    });

    it('gives each day and kind one stable id, so rescheduling replaces it', () => {
        const plan = buildCheckInPlan(both, day, new Date(2026, 8, 22, 6));
        expect(new Set(plan.map(item => item.id)).size).toBe(plan.length);
        expect(plan[0].id).toBe('echo:morning:2026-09-22');
    });

    it('keeps the evening check-in inside a very short day', () => {
        const shortDay: DayWindow = { wake: '07:00', sleep: '07:30' };
        expect(eveningCheckIn(shortDay)).toBe('07:30');
    });
});
