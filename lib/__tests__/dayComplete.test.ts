import { isDayComplete, tallyDay, streakFrom } from '../dayComplete';
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

    it('keeps counting past 70 days', () => {
        const days = Array.from({ length: 120 }, (_, offset) => {
            const date = new Date(`${TODAY}T12:00:00`); date.setDate(date.getDate() - offset);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        });
        expect(streakFrom(daily, [], doneOn(days), {}, TODAY).streak).toBe(120);
    });

    it('stops at the first day that was left unfinished', () => {
        const run = streakFrom(daily, [], doneOn(['2026-09-22', '2026-09-20']), {}, TODAY);
        expect(run.streak).toBe(1);
    });

    it('is broken by a day on which nothing at all was done', () => {
        // One thing a day keeps it going; a day with nothing ends it.
        const weekdays = [habit({ id: 'a', taskDays: ['mon', 'tue', 'wed', 'thu', 'fri'] })];
        const run = streakFrom(weekdays, [], doneOn(['2026-09-22', '2026-09-21', '2026-09-18', '2026-09-17']), {}, TODAY);
        expect(run.streak).toBe(2);
    });

    it('keeps yesterday\'s run while today is still empty', () => {
        // An untouched today has not broken anything yet.
        expect(streakFrom(daily, [], doneOn(['2026-09-21']), {}, TODAY).streak).toBe(1);
    });
});

describe('one definition of a streak', () => {
    // Home used to count streaks per goal: a day counted only if every habit
    // under some goal was done, and tasks were never looked at. So finishing
    // today's three things moved nothing and Home sat on zero while the card
    // that appears when the day is won said three.
    const day = (back: number) => {
        const date = new Date(2026, 8, 27 - back, 12);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };
    const today = day(0);

    it('counts a day won by tasks alone, with no habits at all', () => {
        const tasks = [0, 1, 2].flatMap(back =>
            [1, 2, 3].map(n => ({
                id: `t${back}-${n}`, title: 'x', status: 'done', priority: 2, source: 'app',
                dueDate: day(back), completedAt: `${day(back)}T10:00:00.000Z`,
                createdAt: '2026-09-01', updatedAt: '2026-09-01',
            })),
        ) as never[];
        const run = streakFrom([], tasks, {}, {}, today, 70, 3);
        expect(run.streak).toBe(3);
    });

    it('counts a day as soon as one thing is finished, with work still open', () => {
        const base = { title: 'x', priority: 2, source: 'app', dueDate: today, createdAt: '2026-09-01', updatedAt: '2026-09-01' };
        const tasks = [
            { ...base, id: 't1', status: 'done', completedAt: `${today}T10:00:00.000Z` },
            { ...base, id: 't2', status: 'open' },
            { ...base, id: 't3', status: 'open' },
        ] as never[];
        // One thing finished is enough to keep the streak going.
        expect(streakFrom([], tasks, {}, {}, today, 70, 3).streak).toBe(1);
    });

    it('asks only for work that exists, so one task done is a kept day', () => {
        // Nobody can be asked for three things on a day that only holds one.
        const tasks = [{
            id: 't1', title: 'x', status: 'done', priority: 2, source: 'app',
            dueDate: today, completedAt: `${today}T10:00:00.000Z`,
            createdAt: '2026-09-01', updatedAt: '2026-09-01',
        }] as never[];
        expect(streakFrom([], tasks, {}, {}, today, 70, 3).streak).toBe(1);
    });
});
