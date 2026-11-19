import { overCapacity } from '../dayCapacity';
import { flowDay, lengthOf, type FlowInput } from '../dayFlow';

const task = (id: string, minutes: number, extra: Partial<FlowInput> = {}): FlowInput =>
    ({ id, kind: 'task', title: id, start: null, minutes, done: false, ...extra });
const habit = (id: string, minutes: number): FlowInput => ({ id, kind: 'habit', title: id, start: null, minutes, done: false });
// 7:00 to 17:00: 600 minutes awake; 70% is 420.
const window = { wake: 7 * 60, sleep: 17 * 60 };

describe('a day planned to 70%', () => {
    it('keeps everything when it fits', () => {
        expect(overCapacity([task('a', 200), habit('h', 100)], window, 0.7, lengthOf).size).toBe(0);
    });

    it('takes off the least important open tasks first, never habits', () => {
        const items = [habit('h', 300), task('urgent', 100, { priority: 1 }), task('later', 100, { priority: 3 }), task('normal', 100)];
        expect([...overCapacity(items, window, 0.7, lengthOf)]).toEqual(['later', 'normal']);
    });

    it('never takes off what is done or held at an exact time', () => {
        const items = [task('done', 400, { done: true }), task('exact', 100, { start: 600, locked: true }), task('open', 100)];
        expect([...overCapacity(items, window, 0.7, lengthOf)]).toEqual(['open']);
    });

    it('counts the free time left after meals and events', () => {
        const items = [{ id: 'lunch', kind: 'meal' as const, title: 'Lunch', start: 720, minutes: 100, done: false, fixed: true }, task('a', 360), task('b', 10)];
        // (600 - 100) * 0.7 = 350: 370 of work does not fit, the longer goes first.
        expect([...overCapacity(items, window, 0.7, lengthOf)]).toEqual(['a']);
    });

    it('plans the whole day at Full', () => {
        expect(overCapacity([task('a', 600)], window, 1, lengthOf).size).toBe(0);
    });

    it('shows what is over as waiting, not on the line', () => {
        const flow = flowDay([habit('h', 300), task('a', 200, { priority: 3 })], null, window, { share: 0.7 });
        expect(flow.timeline.map(row => row.id)).toEqual(['h']);
        expect(flow.unfit.map(item => item.id)).toEqual(['a']);
    });

    it('changes nothing with Auto-reschedule off', () => {
        const flow = flowDay([task('a', 600, { start: 420 })], null, window, { auto: false, share: 0.7 });
        expect(flow.unfit).toEqual([]);
    });
});
