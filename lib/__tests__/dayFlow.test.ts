import { flowDay, lengthLabel, upNext, urgencyOf, type FlowInput } from '../dayFlow';

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

    it('gives things with no time a slot in the day, never a separate list', () => {
        const flow = flowDay([...day, item('read', null, 20)], at(8));
        expect(flow.anytime).toEqual([]);
        expect(flow.timeline).toHaveLength(6);
        const read = flow.timeline.find(row => row.id === 'read')!;
        expect(read.auto).toBe(true);
        // In a free gap, overlapping nothing else.
        for (const other of flow.timeline.filter(row => row.id !== 'read')) {
            expect(read.end <= other.start || read.start >= other.end).toBe(true);
        }
    });

    it('labels lengths plainly', () => {
        expect(lengthLabel(30)).toBe('30 min');
        expect(lengthLabel(60)).toBe('1 hr');
        expect(lengthLabel(90)).toBe('1 hr 30 min');
    });
});

describe('what comes next after a focus', () => {
    it('is the next open thing on the timeline, then anything untimed', () => {
        const items = [
            { id: 'report', kind: 'task' as const, title: 'Report', start: 570, minutes: 0, done: false },
            { id: 'workout', kind: 'habit' as const, title: 'Workout', start: 1080, minutes: 39, done: false },
            { id: 'call', kind: 'task' as const, title: 'Call mum', start: null, minutes: 0, done: false },
        ];
        const flow = flowDay(items, 600);
        // The untimed call is given the first free slot, so it comes first.
        expect(upNext(flow, 'report')?.id).toBe('call');
        expect(upNext(flowDay(items.map(item => item.id === 'call' ? { ...item, done: true } : item), 600), 'report')?.id).toBe('workout');
        expect(upNext(flowDay([items[0]], 600), 'report')).toBeNull();
    });
});

describe('meals in the flow', () => {
    const lunch = { id: 'meal:lunch', kind: 'meal' as const, title: 'Lunch', start: 750, minutes: 45, done: false, fixed: true };
    it('never moves a meal, and pushes what would land on it past its end', () => {
        // A task running late at 12:20 for 30 minutes would hit lunch at 12:30.
        const items = [
            { id: 'report', kind: 'task' as const, title: 'Report', start: 690, minutes: 60, done: false },
            { id: 'email', kind: 'task' as const, title: 'Email', start: 740, minutes: 20, done: false },
            lunch,
        ];
        const flow = flowDay(items, 700);
        const meal = flow.timeline.find(item => item.id === 'meal:lunch')!;
        expect([meal.start, meal.end, meal.shift]).toEqual([750, 795, 0]);
        const email = flow.timeline.find(item => item.id === 'email')!;
        expect(email.start).toBe(795);
        // Shown in time order: the email after lunch now.
        expect(flow.timeline.map(item => item.id)).toEqual(['report', 'meal:lunch', 'email']);
        // A meal is never what comes next to focus on.
        expect(upNext(flowDay([lunch, items[1]], 700), 'report')?.id).toBe('email');
    });
    it('is over once its time has passed, and on while it lasts', () => {
        expect(flowDay([lunch], 760).timeline[0].state).toBe('now');
        expect(flowDay([lunch], 800).timeline[0].state).toBe('done');
    });
});

describe('filling the day', () => {
    const task = (id: string, minutes: number, urgency: number) => ({ id, kind: 'task' as const, title: id, start: null, minutes, done: false, urgency });
    const lunch = { id: 'meal:lunch', kind: 'meal' as const, title: 'Lunch', start: 720, minutes: 60, done: false, fixed: true };
    const meeting = { id: 'event:1', kind: 'event' as const, title: 'Meeting', start: 600, minutes: 60, done: false, fixed: true };

    it('places the most urgent first, from now, around meals and events, within the waking day', () => {
        const flow = flowDay([task('low', 30, 30), task('urgent', 90, 0), lunch, meeting], 540, { wake: 420, sleep: 1380 });
        const at = (id: string) => flow.timeline.find(row => row.id === id)!;
        // 9:00 now; the meeting is 10–11, so the 90-minute urgent task goes after it, before lunch would cut it.
        expect([at('urgent').start, at('urgent').end]).toEqual([785, 875]);
        // The short low one fits before the meeting, right away.
        expect(at('low').start).toBe(540);
        expect(at('low').state).toBe('now');
        expect(at('urgent').state).toBe('next');
        expect(flow.timeline.map(row => row.id)).toEqual(['low', 'event:1', 'meal:lunch', 'urgent']);
    });

    it('never schedules before waking, and spills past bedtime only when the day is full', () => {
        const flow = flowDay([task('a', 600, 0), task('b', 600, 1)], null, { wake: 480, sleep: 1320 });
        const a = flow.timeline.find(row => row.id === 'a')!;
        const b = flow.timeline.find(row => row.id === 'b')!;
        expect(a.start).toBe(480);
        expect(a.overflow).toBe(false);
        expect(b.overflow).toBe(true);
        expect(b.start).toBeGreaterThanOrEqual(1320);
    });

    it('ranks by priority, then how overdue a task is', () => {
        expect(urgencyOf(1, undefined, '2026-10-20')).toBeLessThan(urgencyOf(2, undefined, '2026-10-20'));
        expect(urgencyOf(2, '2026-10-15', '2026-10-20')).toBeLessThan(urgencyOf(2, '2026-10-20', '2026-10-20'));
        expect(urgencyOf(3, '2026-10-01', '2026-10-20')).toBeGreaterThan(urgencyOf(1, undefined, '2026-10-20'));
    });
});
