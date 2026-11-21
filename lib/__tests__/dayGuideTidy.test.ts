import { staleDayGuide } from '../dayGuideTidy';

const note = (id: string, date: number, kind = 'day-guide') => ({ date, request: { identifier: id, content: { data: { kind } } } }) as never;

it('keeps only the newest start, and leaves other notifications alone', () => {
    expect(staleDayGuide([note('a', 1), note('c', 3), note('b', 2), note('x', 0, 'task-reminder')])).toEqual(['b', 'a']);
    expect(staleDayGuide([note('a', 1)])).toEqual([]);
});
