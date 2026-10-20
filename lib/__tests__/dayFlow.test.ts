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

    it('running over a little pushes what follows later', () => {
        const flow = flowDay(day, at(8, 38));
        expect(flow.current).toMatchObject({ id: 'shower', end: at(8, 38) });
        expect(flow.timeline.find(row => row.id === 'chores')).toMatchObject({ start: at(8, 38), shift: 8 });
        expect(flow.timeline.find(row => row.id === 'homework')).toMatchObject({ start: at(9, 8) });
        expect(flow.timeline.find(row => row.id === 'run')).toMatchObject({ start: at(18) });
    });

    it('something not done in its time is moved to the next free slot, not left behind', () => {
        // The 9:00 workout never happened; at 10:30 it is fitted in again from now.
        const items = [item('workout', at(9), 45), item('read', at(14), 30)];
        const flow = flowDay(items, at(10, 30), { wake: at(7), sleep: at(23) });
        const workout = flow.timeline.find(row => row.id === 'workout')!;
        expect(workout).toMatchObject({ start: at(10, 30), moved: true, auto: true, state: 'now' });
        // Unless you are focusing on it right now.
        expect(flowDay(items, at(10, 30), { wake: at(7), sleep: at(23), active: 'workout' }).current).toMatchObject({ id: 'workout', start: at(9) });
    });

    it('something done stays where it was done', () => {
        const items = [{ ...item('report', null, 60, true), kept: { start: at(10), end: at(10, 20) } }, item('email', null, 30)];
        const flow = flowDay(items, at(10, 20), { wake: at(7), sleep: at(23) });
        expect(flow.timeline.find(row => row.id === 'report')).toMatchObject({ start: at(10), end: at(10, 20), state: 'done' });
        // Finished in 20 minutes instead of an hour: the next one starts now.
        expect(flow.timeline.find(row => row.id === 'email')).toMatchObject({ start: at(10, 20), state: 'now' });
    });

    it('just ticked, it ends now in one move: early, or placed where it was really done', () => {
        const window = { wake: at(7), sleep: at(23) };
        const early = flowDay([{ ...item('report', null, 60, true), kept: { start: at(10), end: at(11) } }], at(10, 20), window);
        expect(early.timeline[0]).toMatchObject({ start: at(10), end: at(10, 20) });
        // Planned for 22:30, done at 17:15: shown as done just now, its 30 minutes ending at 17:15.
        const ahead = flowDay([{ ...item('workout', null, 30, true), kept: { start: at(22, 30), end: at(23) } }], at(17, 15), window);
        expect(ahead.timeline[0]).toMatchObject({ start: at(16, 45), end: at(17, 15) });
    });

    it('holds the slot of something under way, and moves it once it runs out', () => {
        const kept = { start: at(9), end: at(10) };
        const items = [{ ...item('essay', null, 60), kept }];
        expect(flowDay(items, at(9, 30), { wake: at(7), sleep: at(23) }).current).toMatchObject({ id: 'essay', start: at(9), end: at(10) });
        const later = flowDay(items, at(10, 15), { wake: at(7), sleep: at(23) });
        expect(later.timeline[0]).toMatchObject({ id: 'essay', start: at(10, 15), moved: true });
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

    it('never schedules before waking or after bedtime: what has no room is named instead', () => {
        const flow = flowDay([task('a', 600, 0), task('b', 600, 1)], null, { wake: 480, sleep: 1320 });
        expect(flow.timeline.find(row => row.id === 'a')!.start).toBe(480);
        expect(flow.timeline.find(row => row.id === 'b')).toBeUndefined();
        expect(flow.unfit.map(row => row.id)).toEqual(['b']);
    });

    it('lets a flexible meal wait on a full day, so more fits', () => {
        // 8:00–15:00 awake, lunch 10:00–11:00; two 2h50 jobs do not both fit around it.
        const meal = { ...lunch, start: 600, flex: true };
        const window = { wake: 480, sleep: 900 };
        expect(flowDay([meal, task('a', 170, 0), task('b', 170, 1)].map(row => ({ ...row, flex: false })), 480, window).unfit).toHaveLength(1);
        const flow = flowDay([meal, task('a', 170, 0), task('b', 170, 1)], 480, window);
        expect(flow.unfit).toEqual([]);
        const moved = flow.timeline.find(row => row.id === 'meal:lunch')!;
        expect(moved).toMatchObject({ plannedStart: 600, shift: 60, start: 660 });
    });

    it('ranks by priority, then how overdue a task is', () => {
        expect(urgencyOf(1, undefined, '2026-10-20')).toBeLessThan(urgencyOf(2, undefined, '2026-10-20'));
        expect(urgencyOf(2, '2026-10-15', '2026-10-20')).toBeLessThan(urgencyOf(2, '2026-10-20', '2026-10-20'));
        expect(urgencyOf(3, '2026-10-01', '2026-10-20')).toBeGreaterThan(urgencyOf(1, undefined, '2026-10-20'));
    });
});

describe('waking and bedtime are walls', () => {
    const window = { wake: 480, sleep: 1410 };
    it('moves something set too close to bedtime to where it fits', () => {
        // 23:15 for 30 minutes would end at 23:45, past 23:30.
        const flow = flowDay([item('late', 1395, 30), item('early', 420, 20)], 600, window);
        for (const row of flow.timeline) {
            expect(row.start).toBeGreaterThanOrEqual(480);
            expect(row.end).toBeLessThanOrEqual(1410);
        }
        expect(flow.timeline.find(row => row.id === 'late')).toMatchObject({ moved: true, auto: true });
    });
    it('never lets the flow push something past bedtime: it has no room today instead', () => {
        // Running over at 23:05 pushes the 23:00 reading past 23:30.
        const items = [item('dishes', 1350, 50), item('read', 1385, 20)];
        const flow = flowDay(items, 1395, window);
        expect(flow.timeline.every(row => row.state === 'now' || row.end <= 1410)).toBe(true);
        expect(flow.unfit.map(row => row.id)).toEqual(['read']);
    });
});

describe('hard things first, or in your best hours', () => {
    const job = (id: string, difficulty: 1 | 2 | 3) => ({ id, kind: 'task' as const, title: id, start: null, minutes: 60, done: false, urgency: 10, difficulty });
    const day = { wake: 480, sleep: 1380 };
    it('puts the hardest first and the easiest last, by default', () => {
        const flow = flowDay([job('easy', 1), job('hard', 3), job('medium', 2)], null, day);
        expect(flow.timeline.map(row => row.id)).toEqual(['hard', 'medium', 'easy']);
    });
    it('gives a night owl the hard one in the evening, and fills the morning with the rest', () => {
        const flow = flowDay([job('easy', 1), job('hard', 3), job('medium', 2)], null, { ...day, peak: { start: 1080, end: 1320 } });
        const at = (id: string) => flow.timeline.find(row => row.id === id)!.start;
        expect(at('hard')).toBe(1080);
        expect(at('medium')).toBe(480);
        expect(flow.timeline.map(row => row.id)).toEqual(['medium', 'easy', 'hard']);
    });
});
