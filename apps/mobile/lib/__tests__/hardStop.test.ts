import { flowDay, flowInputs } from '../dayFlow';
import { hardStopAfter } from '../todayFlow';

describe('the hard stop before a class', () => {
    const day = '2026-11-10';
    const flowWith = (travel?: Record<string, { before: number; after: number }>) => flowDay(
        flowInputs({ habits: [], tasks: [], done: {}, day, travel, events: [{ id: 'c', title: 'Class', start: 14 * 60, minutes: 80 }] }),
        12 * 60, { wake: 7 * 60, sleep: 23 * 60 });

    it('is the class itself when there is no walk', () => {
        expect(hardStopAfter(flowWith(), 13 * 60)).toEqual({ at: 14 * 60, title: 'Class' });
    });
    it('is the moment to leave when the class has a walk to it', () => {
        expect(hardStopAfter(flowWith({ class: { before: 25, after: 25 } }), 13 * 60)).toEqual({ at: 14 * 60 - 25, title: 'To Class' });
    });
    it('is nothing once the class has begun (the way back is not a stop)', () => {
        expect(hardStopAfter(flowWith({ class: { before: 25, after: 25 } }), 14 * 60 + 10)).toBeNull();
        expect(hardStopAfter(null, 600)).toBeNull();
    });
});
