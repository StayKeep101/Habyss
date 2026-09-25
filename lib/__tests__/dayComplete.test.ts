import { isDayComplete, tallyDay } from '../dayComplete';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

const TODAY = '2026-09-22'; // a Tuesday
const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h', name: 'Run', startDate: '2026-09-01', createdAt: '2026-09-01',
    taskDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
    ...over,
} as Habit);
const task = (over: Partial<Task> = {}): Task => ({
    id: Math.random().toString(36).slice(2), title: 'Task', priority: 2, status: 'open', source: 'app',
    createdAt: '2026-09-01', updatedAt: '2026-09-01', ...over,
});
/** Ticked off on a given day, which is what the day's promise counts. */
const finished = (day: string, over: Partial<Task> = {}) =>
    task({ status: 'done', completedAt: `${day}T10:00:00.000Z`, ...over });

describe('finishing the day', () => {
    it('counts the habits scheduled today and the promise of things finished', () => {
        const tally = tallyDay(
            [habit({ id: 'a' }), habit({ id: 'b', taskDays: ['sun'] })],
            { a: true }, {},
            [finished(TODAY), task({ dueDate: '2026-09-30' })],
            TODAY,
            3,
        );
        // One habit due and kept; one task finished and none other available,
        // so the day asked for one and got it.
        expect(tally).toEqual({ habits: 1, tasks: 1, total: 2, done: 2 });
        expect(isDayComplete(tally)).toBe(true);
    });

    it('asks for the promise, not for every task carrying today’s date', () => {
        // Five things due today, a promise of three: three is what the day asks.
        const due = Array.from({ length: 5 }, () => task({ dueDate: TODAY }));
        const tally = tallyDay([], {}, {}, due, TODAY, 3);
        expect(tally).toEqual({ habits: 0, tasks: 3, total: 3, done: 0 });

        const withThree = tallyDay([], {}, {}, [...due.slice(0, 2), finished(TODAY), finished(TODAY), finished(TODAY)], TODAY, 3);
        expect(withThree.done).toBe(3);
        expect(isDayComplete(withThree)).toBe(true);
    });

    it('counts anything finished today, whatever day it was due', () => {
        // Clearing three things that were overdue is three things cleared.
        const tally = tallyDay([], {}, {}, [
            finished(TODAY, { dueDate: '2026-09-15' }),
            finished(TODAY, { dueDate: '2026-09-18' }),
            finished(TODAY),
        ], TODAY, 3);
        expect(isDayComplete(tally)).toBe(true);
    });

    it('never asks for work that does not exist', () => {
        // One task in the whole app: the day asks for one, not three.
        const tally = tallyDay([habit({ id: 'a' })], { a: true }, {}, [finished(TODAY)], TODAY, 3);
        expect(tally).toEqual({ habits: 1, tasks: 1, total: 2, done: 2 });
        expect(isDayComplete(tally)).toBe(true);

        // And with no tasks at all, the day is judged on its habits alone.
        const habitsOnly = tallyDay([habit({ id: 'a' })], { a: true }, {}, [], TODAY, 5);
        expect(habitsOnly).toEqual({ habits: 1, tasks: 0, total: 1, done: 1 });
        expect(isDayComplete(habitsOnly)).toBe(true);
    });

    it('asks for five when five is the promise', () => {
        const four = Array.from({ length: 4 }, () => finished(TODAY));
        expect(isDayComplete(tallyDay([], {}, {}, [...four, task({ dueDate: TODAY })], TODAY, 3))).toBe(true);
        expect(isDayComplete(tallyDay([], {}, {}, [...four, task({ dueDate: TODAY })], TODAY, 5))).toBe(false);
    });

    it('does not count a habit the user skipped', () => {
        const tally = tallyDay([habit({ id: 'a' }), habit({ id: 'b' })], { a: true }, { b: true }, [], TODAY);
        expect(tally.total).toBe(1);
        expect(isDayComplete(tally)).toBe(true);
    });

    it('is not complete while anything is left', () => {
        expect(isDayComplete(tallyDay([habit({ id: 'a' })], {}, {}, [], TODAY))).toBe(false);
        expect(isDayComplete(tallyDay([habit({ id: 'a' })], { a: true }, {}, [task({ dueDate: TODAY })], TODAY))).toBe(false);
    });

    it('celebrates nothing on a day that asked for nothing', () => {
        expect(isDayComplete(tallyDay([], {}, {}, [], TODAY))).toBe(false);
        expect(isDayComplete(tallyDay([habit({ taskDays: ['sun'] })], {}, {}, [], TODAY))).toBe(false);
    });

    it('ignores goals, archived habits and cancelled tasks', () => {
        const tally = tallyDay(
            [habit({ id: 'g', isGoal: true }), habit({ id: 'x', isArchived: true }), habit({ id: 'a' })],
            { a: true }, {},
            [task({ dueDate: TODAY, status: 'cancelled' })],
            TODAY,
        );
        expect(tally.total).toBe(1);
        expect(isDayComplete(tally)).toBe(true);
    });
});

describe('the run of finished days', () => {
    const { streakFrom } = require('../dayComplete');
    const daily = [habit({ id: 'a' })];
    const doneOn = (days: string[]) => Object.fromEntries(days.map(day => [day, ['a']]));

    it('counts back from today while every day was finished', () => {
        const run = streakFrom(daily, [], doneOn(['2026-09-22', '2026-09-21', '2026-09-20']), {}, TODAY);
        expect(run.streak).toBe(3);
        expect(run.completedDates).toContain('2026-09-21');
    });

    it('stops at the first day that was left unfinished', () => {
        const run = streakFrom(daily, [], doneOn(['2026-09-22', '2026-09-20']), {}, TODAY);
        expect(run.streak).toBe(1);
    });

    it('is not broken by a day that asked for nothing', () => {
        // Scheduled on weekdays only: the weekend asks for nothing.
        const weekdays = [habit({ id: 'a', taskDays: ['mon', 'tue', 'wed', 'thu', 'fri'] })];
        const run = streakFrom(weekdays, [], doneOn(['2026-09-22', '2026-09-21', '2026-09-18', '2026-09-17']), {}, TODAY);
        expect(run.streak).toBe(4);
    });

    it('is zero when today is not finished yet', () => {
        expect(streakFrom(daily, [], doneOn(['2026-09-21']), {}, TODAY).streak).toBe(0);
    });
});
