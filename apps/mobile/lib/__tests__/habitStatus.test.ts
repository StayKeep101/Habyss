import { habitStatus } from '../habitStatus';

const idle = { activeHabitId: null, isRunning: false, isPaused: false };

describe('one answer for what a habit is doing', () => {
    it('never offers focus on a habit that is already done', () => {
        expect(habitStatus({ habitId: 'read', done: true, focus: idle, focusWindowOpen: true })).toBe('done');
    });

    it('shows the timer only while a session is running or paused', () => {
        expect(habitStatus({ habitId: 'read', done: false, focus: { activeHabitId: 'read', isRunning: true, isPaused: false } })).toBe('focusing');
        expect(habitStatus({ habitId: 'read', done: false, focus: { activeHabitId: 'read', isRunning: false, isPaused: true } })).toBe('paused');
        // The timer's last habit, with nothing running, is not focusing.
        expect(habitStatus({ habitId: 'read', done: true, focus: { activeHabitId: 'read', isRunning: false, isPaused: false } })).toBe('done');
    });

    it('keeps another habit\'s session out of this one', () => {
        expect(habitStatus({ habitId: 'read', done: false, focus: { activeHabitId: 'run', isRunning: true, isPaused: false }, focusWindowOpen: true })).toBe('focus-now');
    });

    it('puts skipped before the focus window', () => {
        expect(habitStatus({ habitId: 'read', done: false, skipped: true, focus: idle, focusWindowOpen: true })).toBe('skipped');
        expect(habitStatus({ habitId: 'read', done: false, focus: idle })).toBe('open');
    });
});
