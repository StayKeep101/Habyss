import { flowDay, lengthLabel, upNext, urgencyOf, type FlowInput } from '../dayFlow';

const at = (h: number, m = 0) => h * 60 + m;
const item = (id: string, start: number | null, minutes: number, done = false): FlowInput =>
    ({ id, kind: 'habit', title: id, start, minutes, done });

/** At exact times: they stay where they are set. */
const day = [
    item('shower', at(8), 30),
    item('chores', at(8, 30), 30),
    item('homework', at(9), 60),
    item('study', at(10), 25),
    item('run', at(18), 45),
].map(row => ({ ...row, locked: true }));
const window = { wake: at(7), sleep: at(23) };

describe('the day as a flow', () => {
    it('keeps exact times, on another day and today', () => {
        expect(flowDay(day, null).timeline.map(row => row.start)).toEqual([at(8), at(8, 30), at(9), at(10), at(18)]);
        expect(flowDay(day, at(9, 40)).timeline.map(row => row.start)).toEqual([at(8), at(8, 30), at(9), at(10), at(18)]);
    });

    it('is on an exact-time one while it lasts', () => {
        expect(flowDay(day, at(8, 5)).current?.id).toBe('shower');
        expect(flowDay(day, at(7)).current).toBeNull();
    });

    it('a flexible one does not have to start at its time: finishing early, it starts now', () => {
        const items = [{ ...item('report', null, 60, true), kept: { start: at(8), end: at(8, 20) } }, item('email', at(10), 30)];
        const flow = flowDay(items, at(8, 20), window);
        expect(flow.timeline.find(row => row.id === 'email')).toMatchObject({ start: at(8, 20), end: at(8, 50), state: 'now' });
    });

    it('stays on the one you are on however long it runs, and the rest waits behind it', () => {
        // Planned 20 minutes from 8:00; at noon it is still not done.
        const items = [{ ...item('essay', null, 20), kept: { start: at(8), end: at(8, 20) } }, item('email', null, 30)];
        const flow = flowDay(items, at(12), window);
        expect(flow.current).toMatchObject({ id: 'essay', start: at(8), end: at(12) });
        expect(flow.timeline.find(row => row.id === 'essay')!.moved).toBeFalsy();
        expect(flow.timeline.find(row => row.id === 'email')!.start).toBeGreaterThanOrEqual(at(12));
    });

    it('keeps a flexible one\'s length, and on another day puts it at its time when free', () => {
        const items = [item('read', at(20), 45), item('walk', null, 30)];
        const other = flowDay(items, null, window);
        expect(other.timeline.find(row => row.id === 'read')).toMatchObject({ start: at(20), end: at(20, 45) });
        // Its time passed today without it: fitted in again from now, as long as it was.
        const late = flowDay([item('read', at(9), 45)], at(11), window);
        expect(late.timeline[0]).toMatchObject({ start: at(11), end: at(11, 45) });
    });

    it('orders flexible ones of the same priority by the times they were given', () => {
        const flow = flowDay([item('b', at(15), 30), item('a', at(9), 30)], at(8), window);
        expect(flow.timeline.map(row => row.id)).toEqual(['a', 'b']);
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
        // Nothing is put on top of lunch.
        for (const other of flow.timeline.filter(item => item.id !== 'meal:lunch')) {
            expect(other.end <= 750 || other.start >= 795).toBe(true);
        }
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

    it('never schedules before waking or after bedtime: too much is cut short to fit', () => {
        const flow = flowDay([task('a', 600, 0), task('b', 600, 1)], null, { wake: 480, sleep: 1320 });
        expect(flow.timeline.find(row => row.id === 'a')!.start).toBe(480);
        expect(flow.unfit).toEqual([]);
        expect(flow.timeline.every(row => row.start >= 480 && row.end <= 1320)).toBe(true);
        expect(flow.timeline.some(row => row.cutFrom === 600)).toBe(true);
    });

    it('lets a flexible meal wait on a full day, so more fits', () => {
        // 8:00–15:00 awake, lunch 10:00–11:00; two 2h50 jobs do not both fit around it.
        const meal = { ...lunch, start: 600, flex: true };
        const window = { wake: 480, sleep: 900 };
        // Without it, something has to be cut short; with it, lunch waits and nothing is.
        expect(flowDay([meal, task('a', 170, 0), task('b', 170, 1)].map(row => ({ ...row, flex: false })), 480, window).timeline.some(row => row.cutFrom)).toBe(true);
        const flow = flowDay([meal, task('a', 170, 0), task('b', 170, 1)], 480, window);
        expect(flow.unfit).toEqual([]);
        expect(flow.timeline.some(row => row.cutFrom)).toBe(false);
        const moved = flow.timeline.find(row => row.id === 'meal:lunch')!;
        expect(moved).toMatchObject({ plannedStart: 600, shift: 60, start: 660 });
    });

    it('ranks by priority, then how overdue a task is', () => {
        expect(urgencyOf(1, undefined, '2026-10-20')).toBeLessThan(urgencyOf(2, undefined, '2026-10-20'));
        expect(urgencyOf(2, '2026-10-15', '2026-10-20')).toBeLessThan(urgencyOf(2, '2026-10-20', '2026-10-20'));
        expect(urgencyOf(3, '2026-10-01', '2026-10-20')).toBeGreaterThan(urgencyOf(1, undefined, '2026-10-20'));
    });

    it('puts a task with a deadline coming up ahead of others at its priority, never ahead of a higher priority', () => {
        const today = '2026-10-20';
        expect(urgencyOf(2, today, today, '2026-10-23')).toBeLessThan(urgencyOf(2, today, today));
        expect(urgencyOf(2, today, today, '2026-10-21')).toBeLessThan(urgencyOf(2, today, today, '2026-10-23'));
        expect(urgencyOf(2, today, today, '2026-10-21')).toBeGreaterThan(urgencyOf(1, today, today));
        // Planned for yesterday, due Friday: not overdue.
        expect(urgencyOf(2, '2026-10-19', today, '2026-10-23')).toBeGreaterThan(urgencyOf(2, '2026-10-19', today));
    });
});

describe('waking and bedtime are walls', () => {
    const walls = { wake: 480, sleep: 1410 };
    it('never places a flexible one before waking or after bedtime', () => {
        const flow = flowDay([item('late', 1395, 30), item('early', 420, 20)], 600, walls);
        for (const row of flow.timeline) {
            expect(row.start).toBeGreaterThanOrEqual(480);
            expect(row.end).toBeLessThanOrEqual(1410);
        }
    });
});

describe('a day with too little time', () => {
    const job = (id: string, minutes: number, start: number | null = null) => ({ id, kind: 'task' as const, title: id, start, minutes, done: false, urgency: 30 });
    it('keeps the order of importance and gives the last one whatever time is left', () => {
        // 3 hours left (20:00–23:00) for 2h + 1h + 30 min, most important first.
        const flow = flowDay([{ ...job('essay', 120), urgency: 0 }, { ...job('reading', 60), urgency: 10 }, { ...job('email', 30), urgency: 20 }], 1200, { wake: 420, sleep: 1380 });
        const at = (id: string) => flow.timeline.find(row => row.id === id)!;
        // The essay keeps its two hours, and is first.
        expect([at('essay').start, at('essay').end]).toEqual([1200, 1320]);
        expect(at('essay').cutFrom).toBeUndefined();
        // Reading is the last that fits: cut to the time before bedtime.
        expect(at('reading')).toMatchObject({ start: 1325, end: 1380, cutFrom: 60 });
        // Nothing left for the email.
        expect(flow.unfit.map(item => item.id)).toEqual(['email']);
    });
    it('never cuts something at an exact time, nor below ten minutes', () => {
        const flow = flowDay([{ ...job('call', 60, 1320), locked: true }, job('chores', 300)], 1200, { wake: 420, sleep: 1380 });
        expect(flow.timeline.find(row => row.id === 'call')).toMatchObject({ start: 1320, end: 1380 });
        expect(flow.timeline.find(row => row.id === 'call')!.cutFrom).toBeUndefined();
        const chores = flow.timeline.find(row => row.id === 'chores')!;
        expect(chores.end - chores.start).toBeGreaterThanOrEqual(10);
        expect(chores.end).toBeLessThanOrEqual(1320);
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

describe('tasks before habits', () => {
    it('places tasks ahead of habits, whatever their priority', () => {
        const window = { wake: 480, sleep: 1380 };
        const row = (id: string, kind: 'task' | 'habit', urgency: number) => ({ id, kind, title: id, start: null, minutes: 30, done: false, urgency });
        expect(flowDay([row('walk', 'habit', 30), row('email', 'task', 30)], null, window).timeline.map(item => item.id)).toEqual(['email', 'walk']);
        // At the same urgency the task goes first, even when the habit is a little higher.
        expect(flowDay([row('walk', 'habit', 30), row('email', 'task', 50)], null, window).timeline.map(item => item.id)).toEqual(['email', 'walk']);
    });
    it('puts the most urgent first, then the hardest, then the rest', () => {
        const row = (id: string, kind: 'task' | 'habit', urgency: number, difficulty: 1 | 2 | 3) => ({ id, kind, title: id, start: null, minutes: 30, done: false, urgency, difficulty });
        const order = flowDay([
            row('easy chore', 'task', 30, 1), row('hard habit', 'habit', 30, 3), row('urgent habit', 'habit', 10, 1),
            row('normal task', 'task', 30, 2), row('urgent task', 'task', 10, 2),
        ], null, window).timeline.map(item => item.id);
        expect(order).toEqual(['urgent task', 'urgent habit', 'hard habit', 'normal task', 'easy chore']);
    });
});

describe('exact time or flexible', () => {
    const window = { wake: 420, sleep: 1380 };
    it('keeps an exact-time habit where it is, while a flexible one slides with the day', () => {
        // The 8:00 shower runs over to 8:38; at 8:30 a flexible task follows it, an exact one does not.
        const shower = { id: 'shower', kind: 'habit' as const, title: 'shower', start: 480, minutes: 30, done: false };
        const flexible = flowDay([shower, { id: 'call', kind: 'task' as const, title: 'call', start: 510, minutes: 30, done: false }], 518, window);
        expect(flexible.timeline.find(row => row.id === 'call')!.start).toBe(518);
        const exact = flowDay([shower, { id: 'call', kind: 'task' as const, title: 'call', start: 510, minutes: 30, done: false, locked: true }], 518, window);
        expect(exact.timeline.find(row => row.id === 'call')).toMatchObject({ start: 510, end: 540, shift: 0 });
    });
    it('never moves an exact-time one when its time passes, and fits nothing on top of it', () => {
        const items = [
            { id: 'class', kind: 'task' as const, title: 'class', start: 540, minutes: 60, done: false, locked: true },
            { id: 'read', kind: 'habit' as const, title: 'read', start: null, minutes: 30, done: false },
        ];
        expect(flowDay(items, 700, window).timeline.find(row => row.id === 'class')).toMatchObject({ start: 540, end: 600 });
        const before = flowDay(items, 520, window);
        const read = before.timeline.find(row => row.id === 'read')!;
        expect(read.end <= 540 || read.start >= 600).toBe(true);
        expect(flowDay(items, 560, window).current?.id).toBe('class');
    });
});
