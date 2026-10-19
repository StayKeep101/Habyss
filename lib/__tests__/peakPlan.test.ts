import { defaultBaseline, isPeakGoal, plannedFor, raceDistance } from '../peakPlan';
import { parseGoalText } from '../goalParser';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

const today = new Date(2026, 9, 18, 12);

describe('goals reached in one go', () => {
    it('reads "run 21 km by January 1" as one run of 21 km, not a total', () => {
        const parsed = parseGoalText('Run 21 km by January 1 2027', { today });
        expect(parsed.goal.type).toBe('peak');
        expect(parsed.goal.aggregation).toBe('max');
        expect(parsed.goal.target).toBe(21);
        expect(parsed.goal.metric_unit).toBe('km');
    });

    it('still reads a total as a total', () => {
        expect(parseGoalText('Run 500 km this year', { today }).goal.aggregation).toBe('sum');
        expect(parseGoalText('Run 100 km in total by December', { today }).goal.aggregation).toBe('sum');
        expect(parseGoalText('Read 20 books by December', { today }).goal.aggregation).not.toBe('max');
    });

    it('knows a half marathon is 21.1 km', () => {
        expect(raceDistance('run a half marathon by may')).toBe(21.1);
        const parsed = parseGoalText('Run a half marathon by May 1', { today });
        expect(parsed.goal.target).toBe(21.1);
        expect(parsed.goal.type).toBe('peak');
    });

    it('treats a lifted weight as one effort, but not losing weight', () => {
        expect(isPeakGoal('bench 100 kg by june', 'kg', false)).toBe(true);
        expect(isPeakGoal('weigh 70 kg by june', 'kg', false)).toBe(false);
    });

    it('builds up week by week from where you are to the target, with the last week the attempt', () => {
        const start = '2026-10-18', end = '2027-01-01';
        expect(plannedFor('2026-10-18', start, end, 5, 21)).toBe(5);
        const mid = plannedFor('2026-11-22', start, end, 5, 21);
        expect(mid).toBeGreaterThan(5);
        expect(mid).toBeLessThan(21);
        expect(plannedFor('2026-12-30', start, end, 5, 21)).toBe(21);
        // Every step is a half km.
        expect(mid * 2).toBe(Math.round(mid * 2));
        expect(defaultBaseline(21)).toBe(5.25);
    });
});

describe('progress on a one-go goal', () => {
    it('is the best single run, not the sum of runs', () => {
        const { goalMeasure } = require('../goalInsights') as typeof import('../goalInsights');
        const goal = {
            id: 'g', name: 'Run 21 km', isGoal: true, startDate: '2026-10-01', targetDate: '2027-01-01', unit: 'km', goalValue: 21,
            createdAt: '2026-10-01', taskDays: [],
            goalSpec: JSON.stringify({ kind: 'number', aggregation: 'max', target: 21, metric_unit: 'km', baseline: 5 }),
        };
        const run = { id: 'r', name: 'Run', goalId: 'g', unit: 'km', goalValue: 8, startDate: '2026-10-01', createdAt: '2026-10-01', taskDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] };
        const history = { '2026-10-05': ['r'], '2026-10-07': ['r'], '2026-10-09': ['r'], '2026-10-11': ['r'] };
        const measure = goalMeasure({ goal: goal as never, habits: [run as never], tasks: [], history, today: '2026-10-18' });
        // Four 8 km runs are not 32 km of a 21 km goal: the best run is 8.
        expect(measure.done).toBe(8);
        expect(measure.total).toBe(21);
        expect(measure.peak?.thisWeek).toBeGreaterThanOrEqual(5);
    });
});
