import { dailyFocus, focusHistory, focusInsights, focusStreak, type FocusDay } from '../dailyFocus';
import type { Task } from '../tasks';

const TODAY = '2026-09-23'; // a Wednesday

const task = (over: Partial<Task> = {}): Task => ({
    id: Math.random().toString(36).slice(2), title: 'Task', priority: 2, status: 'open',
    source: 'app', createdAt: '2026-09-01', updatedAt: '2026-09-01', ...over,
});
const finished = (day: string, over: Partial<Task> = {}) =>
    task({ status: 'done', completedAt: `${day}T10:00:00.000Z`, ...over });

describe("the day's promise", () => {
    it('counts what was finished today, whatever day it was due', () => {
        // Three things done is three things done; the promise was a number.
        const focus = dailyFocus([
            finished(TODAY, { dueDate: '2026-09-20' }),
            finished(TODAY, { dueDate: TODAY }),
            finished(TODAY),
        ], 3, TODAY, TODAY);

        expect(focus.done).toBe(3);
        expect(focus.progress).toBe(3);
        expect(focus.complete).toBe(true);
    });

    it('is not won by work finished on another day', () => {
        const focus = dailyFocus([finished('2026-09-22'), finished('2026-09-21')], 3, TODAY, TODAY);
        expect(focus.done).toBe(0);
        expect(focus.complete).toBe(false);
    });

    it('offers somewhere to start, worst first', () => {
        const focus = dailyFocus([
            task({ id: 'later', title: 'Later', dueDate: '2026-10-01' }),
            task({ id: 'today', title: 'Today', dueDate: TODAY }),
            task({ id: 'late', title: 'Late', dueDate: '2026-09-18' }),
            task({ id: 'loose', title: 'No date' }),
        ], 3, TODAY, TODAY);

        // Overdue, then due today, then undated. Next week is not today's work.
        expect(focus.rows.map(row => row.id)).toEqual(['late', 'today', 'loose']);
    });

    it('shows what is already done alongside what is left', () => {
        const focus = dailyFocus([
            finished(TODAY, { id: 'done1', title: 'Done' }),
            task({ id: 'next', title: 'Next', dueDate: TODAY }),
            task({ id: 'after', title: 'After', dueDate: TODAY }),
            task({ id: 'spare', title: 'Spare', dueDate: TODAY }),
        ], 3, TODAY, TODAY);

        expect(focus.rows.map(row => row.id)).toEqual(['done1', 'next', 'after']);
        expect(focus.done).toBe(1);
        expect(focus.complete).toBe(false);
    });

    it('still offers one more once the day is won, without demanding it', () => {
        const focus = dailyFocus([
            finished(TODAY, { id: 'a' }), finished(TODAY, { id: 'b' }), finished(TODAY, { id: 'c' }),
            task({ id: 'bonus', dueDate: TODAY }),
        ], 3, TODAY, TODAY);

        expect(focus.complete).toBe(true);
        expect(focus.rows.map(row => row.id)).toEqual(['a', 'b', 'c', 'bonus']);
        expect(focus.extra).toBe(0);
    });

    it('says when more than the promise was kept', () => {
        const focus = dailyFocus(
            [finished(TODAY), finished(TODAY), finished(TODAY), finished(TODAY), finished(TODAY)],
            3, TODAY, TODAY,
        );
        expect(focus.progress).toBe(3);
        expect(focus.extra).toBe(2);
    });

    it('asks for five when five is what was chosen', () => {
        const three = [finished(TODAY), finished(TODAY), finished(TODAY)];
        expect(dailyFocus(three, 3, TODAY, TODAY).complete).toBe(true);
        expect(dailyFocus(three, 5, TODAY, TODAY).complete).toBe(false);
    });

    it('has nothing to show on a day with no tasks at all', () => {
        const focus = dailyFocus([], 3, TODAY, TODAY);
        expect(focus.rows).toEqual([]);
        expect(focus.done).toBe(0);
        expect(focus.complete).toBe(false);
    });
});

describe('the run of days kept', () => {
    const day = (date: string, done: number): FocusDay => ({ date, done, target: 3, hit: done >= 3 });

    it('counts back from today', () => {
        expect(focusStreak([day('2026-09-21', 3), day('2026-09-22', 3), day(TODAY, 3)])).toBe(3);
    });

    it('does not break on a today that is simply not finished yet', () => {
        // There is still time; an unfinished today is not a lost one.
        expect(focusStreak([day('2026-09-21', 3), day('2026-09-22', 3), day(TODAY, 1)])).toBe(2);
    });

    it('breaks on a day that was actually lost', () => {
        expect(focusStreak([day('2026-09-21', 3), day('2026-09-22', 0), day(TODAY, 3)])).toBe(1);
    });
});

describe('what the dashboard says', () => {
    it('reads a month back, oldest first, ending today', () => {
        const history = focusHistory([finished(TODAY), finished('2026-09-22')], 3, 30, TODAY);
        expect(history).toHaveLength(30);
        expect(history[29].date).toBe(TODAY);
        expect(history[29].done).toBe(1);
        expect(history[28].done).toBe(1);
        expect(history[0].date).toBe('2026-08-25');
    });

    it('reports the share of days kept, the best run, and the daily average', () => {
        const history: FocusDay[] = [
            { date: '2026-09-21', done: 3, target: 3, hit: true },
            { date: '2026-09-22', done: 4, target: 3, hit: true },
            { date: TODAY, done: 1, target: 3, hit: false },
        ];
        const insights = focusInsights(history);

        expect(insights.hits).toBe(2);
        expect(insights.rate).toBe(67);
        expect(insights.bestStreak).toBe(2);
        expect(insights.finished).toBe(8);
        expect(insights.perDay).toBe(2.7);
    });

    it('names a best weekday only once one has been seen more than once', () => {
        const once: FocusDay[] = [{ date: '2026-09-21', done: 3, target: 3, hit: true }];
        expect(focusInsights(once).bestWeekday).toBeNull();

        // Two Mondays, both kept.
        const twice: FocusDay[] = [
            { date: '2026-09-14', done: 3, target: 3, hit: true },
            { date: '2026-09-21', done: 3, target: 3, hit: true },
        ];
        expect(focusInsights(twice).bestWeekday).toBe('Monday');
    });

    it('says nothing at all rather than zero when there is no history', () => {
        const insights = focusInsights([]);
        expect(insights).toMatchObject({ hits: 0, days: 0, rate: 0, perDay: 0, bestWeekday: null });
    });
});

describe('a task finished in the evening', () => {
    const { doneOnDay } = require('../dailyFocus') as typeof import('../dailyFocus');
    it('counts for the day it was finished on your own clock, not in UTC', () => {
        // 21:30 local on Oct 8 is already Oct 9 in UTC west of Greenwich.
        const evening = new Date(2026, 9, 8, 21, 30).toISOString();
        const task = { id: 't', title: 'Send it', priority: 2, status: 'done', source: 'app', completedAt: evening, createdAt: evening, updatedAt: evening } as const;
        expect(doneOnDay(task as never, '2026-10-08')).toBe(true);
    });
});
