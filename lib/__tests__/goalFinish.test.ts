import { rereadSpec } from '../goalFinish';
import type { Habit } from '../habitsSQLite';

const goal = (name: string, spec: Record<string, unknown>): Habit => ({ id: 'g', name, isGoal: true, goalSpec: JSON.stringify(spec) } as Habit);
const read = (name: string, spec: Record<string, unknown>) => {
    const next = rereadSpec(goal(name, spec), new Date('2026-10-28T12:00:00'));
    return next ? JSON.parse(next) : null;
};

describe('reading older goals again', () => {
    it('turns an added-up CGPA into the latest number logged, and asks again whether it is reached', () => {
        const next = read('Get a 7 CGPA', { kind: 'number', target: 7, metric_unit: 'sessions', aggregation: 'sum', completed_on: '2026-10-28' });
        expect(next).toMatchObject({ aggregation: 'latest', target: 7 });
        expect(next.completed_on).toBeUndefined();
    });
    it('turns a 10 km run into the best effort', () => {
        expect(read('Run 10 km without stopping', { kind: 'number', target: 10, metric_unit: 'km', aggregation: 'sum' })).toMatchObject({ aggregation: 'max' });
    });
    it('leaves a goal that adds up, and one already counting the latest or best', () => {
        expect(read('Read 12 books', { kind: 'number', target: 12, metric_unit: 'books', aggregation: 'sum' })).toBeNull();
        expect(read('Get a 7 CGPA', { kind: 'number', target: 7, aggregation: 'latest' })).toBeNull();
        expect(read('Run 10 km', { kind: 'number', target: 10, aggregation: 'max' })).toBeNull();
    });
});

describe('a counting chosen by hand', () => {
    it('is never read again from the words', () => {
        expect(read('Get a 7 CGPA', { kind: 'number', target: 7, aggregation: 'sum', counting_chosen: true })).toBeNull();
    });
});
