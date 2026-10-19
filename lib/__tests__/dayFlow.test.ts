import { flowDay, lengthLabel, type FlowInput } from '../dayFlow';

const at = (h: number, m = 0) => h * 60 + m;
const item = (id: string, start: number | null, minutes: number, done = false): FlowInput =>
    ({ id, kind: 'habit', title: id, start, minutes, done });

const day = [
    item('shower', at(8), 30),
    item('chores', at(8, 30), 30),
    item('homework', at(9), 60),
    item('study', at(10), 25),
    item('run', at(18), 45),
];

describe('the day as a flow', () => {
    it('keeps the plan on another day', () => {
        const flow = flowDay(day, null);
        expect(flow.current).toBeNull();
        expect(flow.timeline.map(row => row.start)).toEqual([at(8), at(8, 30), at(9), at(10), at(18)]);
    });

    it('is on the first item once its time comes', () => {
        const flow = flowDay(day, at(8, 5));
        expect(flow.current?.id).toBe('shower');
        expect(flow.timeline[1]).toMatchObject({ id: 'chores', state: 'next', start: at(8, 30) });
    });

    it('waits before the day starts', () => {
        const flow = flowDay(day, at(7));
        expect(flow.current).toBeNull();
        expect(flow.timeline[0]).toMatchObject({ id: 'shower', state: 'next', start: at(8) });
    });

    it('finishing early moves straight on, and the chain moves up with it — but not past a gap', () => {
        const done = [{ ...day[0], done: true }, ...day.slice(1)];
        const flow = flowDay(done, at(8, 15));
        expect(flow.current).toMatchObject({ id: 'chores', start: at(8, 15), end: at(8, 45), shift: -15 });
        expect(flow.timeline.find(row => row.id === 'homework')).toMatchObject({ start: at(8, 45), shift: -15 });
        expect(flow.timeline.find(row => row.id === 'study')).toMatchObject({ start: at(9, 45) });
        // The evening run is after a long gap: it stays where it was.
        expect(flow.timeline.find(row => row.id === 'run')).toMatchObject({ start: at(18), shift: 0 });
    });

    it('running over pushes what follows later', () => {
        const flow = flowDay(day, at(8, 50));
        expect(flow.current).toMatchObject({ id: 'shower', end: at(8, 50) });
        expect(flow.timeline.find(row => row.id === 'chores')).toMatchObject({ start: at(8, 50), shift: 20 });
        expect(flow.timeline.find(row => row.id === 'homework')).toMatchObject({ start: at(9, 20) });
        expect(flow.timeline.find(row => row.id === 'run')).toMatchObject({ start: at(18) });
    });

    it('puts things with no time under Anytime', () => {
        const flow = flowDay([...day, item('read', null, 20)], at(8));
        expect(flow.anytime.map(row => row.id)).toEqual(['read']);
        expect(flow.timeline).toHaveLength(5);
    });

    it('labels lengths plainly', () => {
        expect(lengthLabel(30)).toBe('30 min');
        expect(lengthLabel(60)).toBe('1 hr');
        expect(lengthLabel(90)).toBe('1 hr 30 min');
    });
});
