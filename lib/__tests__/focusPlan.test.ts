import { focusPlan } from '../focusLength';

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
