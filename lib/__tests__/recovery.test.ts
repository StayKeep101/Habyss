import { recovery } from '../recovery';
import { shiftDay } from '../habitDays';
import type { Habit } from '../habitsSQLite';

const habit = (over: Partial<Habit> = {}): Habit => ({
    id: 'h1', name: 'Read', category: 'mind', createdAt: '2026-01-01', type: 'build',
    color: '#fff', goalPeriod: 'daily', goalValue: 1, unit: 'time', taskDays: [],
    reminders: [], chartType: 'bar', startDate: '2026-01-01', isArchived: false,
    showMemo: false, frequency: 'daily', trackingMethod: 'boolean', ...over,
} as Habit);

const TODAY = '2026-09-25';

/**
 * A pattern of days ending today: '.' kept, 'x' not kept, 's' skipped.
 * The window is the pattern's own length, so nothing outside it is invented.
 */
const run = (pattern: string, habits: Habit[] = [habit()], completions?: Record<string, boolean>) =>
    recovery(
        habits,
        pattern.split('').map((mark, index) => ({
            date: shiftDay(TODAY, -(pattern.length - 1 - index)),
            completedIds: mark === '.' ? ['h1'] : [],
            skippedIds: mark === 's' ? ['h1'] : [],
        })),
        // Today is read from the live record rather than from history, so the
        // pattern's last mark has to be given the same way the app gives it.
        completions ?? (pattern.endsWith('.') ? { h1: true } : {}),
        pattern.length,
        TODAY,
    );

describe('never miss twice', () => {
    it('counts a miss answered the next day as a recovery', () => {
        const result = run('..x..');
        expect(result.recovered).toBe(1);
        expect(result.doubles).toBe(0);
        expect(result.rate).toBe(100);
    });

    it('counts a miss missed again as a double, which is the thing to avoid', () => {
        // The last day is today and still open, so only the first miss has a verdict.
        const result = run('.xxx');
        expect(result.doubles).toBe(1);
        expect(result.recovered).toBe(0);
        expect(result.rate).toBe(0);
    });

    it('judges each miss on its own, so a run ends the moment you get back up', () => {
        const result = run('..xx.');
        expect(result.doubles).toBe(1);   // the first miss went unanswered
        expect(result.recovered).toBe(1); // the second was answered
        expect(result.rate).toBe(50);
    });

    it('reads high while the kept-rate is low, which is the whole point', () => {
        // Missed half of all days, and got back up every single time.
        const result = run('x.x.x.x.');
        expect(result.rate).toBe(100);
        expect(result.recovered).toBe(4);
    });

    it('cannot be improved by tracking fewer habits', () => {
        // Missing is the denominator, so a habit that always fails drags the
        // rate down and deleting it removes its credit too.
        const alone = run('..x..');
        const withFailure = run('..x..', [habit(), habit({ id: 'h2', name: 'Run' })]);
        expect(alone.rate).toBe(100);
        expect(withFailure.rate).toBeLessThan(100);
        expect(withFailure.judged).toBeGreaterThan(alone.judged);
    });
});

describe('what does not count as a miss', () => {
    it('does not count today, because the day is not over', () => {
        const result = run('...x');
        expect(result.perHabit[0].misses).toEqual([]);
        expect(result.judged).toBe(0);
        expect(result.rate).toBeNull();
    });

    it('does not judge a miss nothing has had the chance to answer yet', () => {
        // Missed yesterday, due again today, still open — no verdict.
        const result = run('..xx');
        expect(result.judged).toBe(0);
        expect(result.rate).toBeNull();
    });

    it('treats a deliberate skip as neither kept nor missed', () => {
        // The day after the skip answers the day before it.
        const result = run('.xs..');
        expect(result.recovered).toBe(1);
        expect(result.doubles).toBe(0);
    });

    it('does not let a skip hide a double', () => {
        expect(run('.xsx.').doubles).toBe(1);
    });
});

describe('what to protect today', () => {
    it('flags a habit missed last time and due again today', () => {
        const result = run('..xx');
        expect(result.atRisk.map(item => item.name)).toEqual(['Read']);
        expect(result.perHabit[0].atRisk).toBe(true);
    });

    it('stops flagging it the moment it is done', () => {
        expect(run('..x', [habit()], { h1: true }).atRisk).toEqual([]);
    });

    it('does not flag a habit that was kept last time', () => {
        expect(run('..x').atRisk).toEqual([]);
    });

    it('puts what is savable today above a habit with a worse record', () => {
        const read = habit({ id: 'h1', name: 'Read' });
        const run2 = habit({ id: 'h2', name: 'Run' });
        const days = [
            { date: shiftDay(TODAY, -3), completedIds: ['h1', 'h2'], skippedIds: [] },
            { date: shiftDay(TODAY, -2), completedIds: ['h1', 'h2'], skippedIds: [] },
            { date: shiftDay(TODAY, -1), completedIds: ['h2'], skippedIds: [] }, // Read missed
            { date: TODAY, completedIds: [], skippedIds: [] },
        ];
        const result = recovery([read, run2], days, {}, 4, TODAY);
        expect(result.perHabit[0].name).toBe('Read');
        expect(result.perHabit[0].atRisk).toBe(true);
        expect(result.atRisk).toHaveLength(1);
    });
});

describe('nothing to say yet', () => {
    it('reports no rate rather than a damning zero before any miss is judged', () => {
        const result = run('.....');
        expect(result.rate).toBeNull();
        expect(result.perHabit[0].rate).toBeNull();
    });

    it('leaves out habits that were never due', () => {
        const future = habit({ startDate: shiftDay(TODAY, 30) });
        expect(recovery([future], [], {}, 10, TODAY).perHabit).toEqual([]);
    });

    it('ignores archived habits and goals', () => {
        const archived = habit({ id: 'a', isArchived: true });
        const goal = habit({ id: 'g', isGoal: true } as Partial<Habit>);
        expect(recovery([archived, goal], [], {}, 5, TODAY).perHabit).toEqual([]);
    });
});
