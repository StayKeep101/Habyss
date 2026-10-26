import { focusClock, focusPlan } from '../focusLength';

const reading = { unit: 'minutes', goalValue: 45, type: 'build', trackingMethod: 'numeric' } as never;

describe('how long focus runs', () => {
    it('is the timed habit\'s own length, fixed, when nothing was cut', () => {
        expect(focusPlan({ habit: reading })).toEqual({ seconds: 2700, fixed: true, cutFrom: null, length: 2700 });
    });
    it('is the cut length when today\'s timeline cut it short, and says what it was', () => {
        const plan = focusPlan({ habit: reading, slot: { start: 1320, end: 1350, cutFrom: 45 } });
        expect(plan).toEqual({ seconds: 1800, fixed: true, cutFrom: 2700, length: 1800 });
    });
    it('takes off what is already done today', () => {
        expect(focusPlan({ habit: reading, banked: 600 }).seconds).toBe(2100);
        expect(focusPlan({ habit: reading, slot: { start: 0, end: 30, cutFrom: 45 }, banked: 600 }).seconds).toBe(1200);
    });
    it('fixes a task measured in time, and only suggests an estimate', () => {
        expect(focusPlan({ task: { measure: 'time', target: 60, amount: 20 } })).toMatchObject({ seconds: 2400, fixed: true });
        expect(focusPlan({ task: { estimatedMinutes: 30 } })).toMatchObject({ seconds: 1800, fixed: false });
        expect(focusPlan({ task: {} })).toMatchObject({ seconds: null, fixed: false });
    });
});

describe('a task with no length of its own', () => {
    it('focuses for as long as its place on today\'s timeline (5:00–5:30 is 30 minutes)', () => {
        const { focusPlan } = require('../focusLength') as typeof import('../focusLength');
        expect(focusPlan({ task: {}, slot: { start: 17 * 60, end: 17 * 60 + 30 } }).seconds).toBe(30 * 60);
    });
});

describe('where the clock stands when focus opens', () => {
    const at = (h: number, m: number) => new Date(2026, 9, 25, h, m).getTime();
    const fivePm = at(17, 0);

    it('counts down what is left of a 5:00–5:30 task opened at 5:10', () => {
        expect(focusClock(30 * 60, fivePm, at(17, 10))).toEqual({ began: fivePm, stopwatch: false, seconds: 20 * 60 });
    });

    it('is a stopwatch at 1:00:00 when that task is opened at 6:00', () => {
        expect(focusClock(30 * 60, fivePm, at(18, 0))).toEqual({ began: fivePm, stopwatch: true, seconds: 3600 });
    });

    it('runs the full length from now when it has not begun yet', () => {
        expect(focusClock(30 * 60, fivePm, at(16, 0))).toEqual({ began: at(16, 0), stopwatch: false, seconds: 30 * 60 });
        expect(focusClock(30 * 60, null, at(16, 0)).seconds).toBe(30 * 60);
    });
});
