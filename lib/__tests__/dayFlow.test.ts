import { flowDay, flowInputs, lengthLabel, upNext, urgencyOf, type FlowInput } from '../dayFlow';

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
        // Its time passed today and it is not ticked: it keeps its start and runs on until it is.
        const late = flowDay([item('read', at(9), 45)], at(11), window);
        expect(late.timeline[0]).toMatchObject({ start: at(9), end: at(11) });
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
        // Lunch ends at 13:00, and it starts straight after.
        expect([at('urgent').start, at('urgent').end]).toEqual([780, 870]);
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
        // 3 hours left (20:00–23:00) for 2h + 1h30 + 30 min, most important first.
        const flow = flowDay([{ ...job('essay', 120), urgency: 0 }, { ...job('reading', 90), urgency: 10 }, { ...job('email', 30), urgency: 20 }], 1200, { wake: 420, sleep: 1380 });
        const at = (id: string) => flow.timeline.find(row => row.id === id)!;
        // The essay keeps its two hours, and is first.
        expect([at('essay').start, at('essay').end]).toEqual([1200, 1320]);
        expect(at('essay').cutFrom).toBeUndefined();
        // Reading is the last that fits: cut to the time before bedtime.
        // Straight after, with what is left before bedtime.
        expect(at('reading')).toMatchObject({ start: 1320, end: 1380, cutFrom: 90 });
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
    it('puts every task before every habit, then the more urgent, then the harder', () => {
        const row = (id: string, kind: 'task' | 'habit', urgency: number, difficulty: 1 | 2 | 3) => ({ id, kind, title: id, start: null, minutes: 30, done: false, urgency, difficulty });
        const order = flowDay([
            row('easy chore', 'task', 30, 1), row('hard habit', 'habit', 30, 3), row('urgent habit', 'habit', 10, 1),
            row('normal task', 'task', 30, 2), row('urgent task', 'task', 10, 2),
        ], null, window).timeline.map(item => item.id);
        expect(order).toEqual(['urgent task', 'normal task', 'easy chore', 'urgent habit', 'hard habit']);
    });
});

describe('exact time or flexible', () => {
    const window = { wake: 420, sleep: 1380 };
    it('keeps an exact-time one where it is, and a late flexible one at its start until it is ticked', () => {
        // The 8:00 shower runs over to 8:38; at 8:30 a flexible task follows it, an exact one does not.
        const shower = { id: 'shower', kind: 'habit' as const, title: 'shower', start: 480, minutes: 30, done: false };
        const flexible = flowDay([shower, { id: 'call', kind: 'task' as const, title: 'call', start: 510, minutes: 30, done: false }], 518, window);
        expect(flexible.timeline.find(row => row.id === 'call')!.start).toBe(510);
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


describe('where a done thing sits', () => {
    const window = { wake: 420, sleep: 1380 };
    const done = (id: string, minutes: number, extra: Partial<FlowInput> = {}): FlowInput => ({ id, kind: 'task', title: id, start: null, minutes, done: true, ...extra });
    it('stays where it was planned when it was done before its time came', () => {
        // Planned 18:00–18:30, ticked at 17:55: still 18:00–18:30, ticked.
        const early = flowDay([done('essay', 30, { kept: { start: 1080, end: 1110 }, doneAt: 1075 })], 1200, window);
        expect(early.timeline[0]).toMatchObject({ start: 1080, end: 1110, state: 'done' });
        // Sourcing, 21:00–23:00 every day, done by noon: 21:00 is not asked for again.
        const sourcing = flowDay([done('sourcing', 120, { planned: { start: 1260, end: 1380 }, kept: { start: 600, end: 720 }, doneAt: 720 })], 730, window);
        expect(sourcing.timeline[0]).toMatchObject({ start: 1260, end: 1380, state: 'done' });
    });
    it('ends when it was ticked and is as long as it was expected to take, once its time has come', () => {
        // Started at 17:00, ticked at 17:10: still the 30 minutes it was expected to take, ending at 17:10.
        const partway = flowDay([done('essay', 30, { kept: { start: 1020, end: 1050 }, doneAt: 1030 })], 1200, window);
        expect(partway.timeline[0]).toMatchObject({ start: 1000, end: 1030 });
        // Never placed at all (ticked from the list): the same rule.
        const unplaced = flowDay([done('call', 20, { doneAt: 600 })], 700, window);
        expect(unplaced.timeline[0]).toMatchObject({ start: 580, end: 600 });
    });
    it('counts a cut one at the length it was cut to', () => {
        const cut = flowDay([done('read', 60, { kept: { start: 1320, end: 1350 }, doneAt: 1345 })], 1360, window);
        expect(cut.timeline[0]).toMatchObject({ start: 1315, end: 1345 });
    });
    it('reads the time a task was finished, on the day it was finished', () => {
        const at = new Date(2026, 9, 22, 17, 55).toISOString();
        const items = flowInputs({ habits: [], tasks: [{ id: 't', title: 't', status: 'done', completedAt: at, estimatedMinutes: 30 } as never], done: {}, today: '2026-10-22' });
        expect(items[0].doneAt).toBe(1075);
        expect(flowInputs({ habits: [], tasks: [{ id: 't', title: 't', status: 'done', completedAt: at } as never], done: {}, today: '2026-10-23' })[0].doneAt).toBeUndefined();
    });
});

describe('calendar events', () => {
    const window = { wake: 420, sleep: 1380 };
    const meeting = (start: number, minutes: number): FlowInput => ({ id: 'event:m', kind: 'event', title: 'Meeting', start, minutes, done: false, fixed: true });
    const job = (id: string, minutes: number, extra: Partial<FlowInput> = {}): FlowInput => ({ id, kind: 'task', title: id, start: null, minutes, done: false, ...extra });
    const clash = (flow: ReturnType<typeof flowDay>) => flow.timeline.filter(item => item.kind !== 'event' && item.start < 630 && item.end > 570);
    it('ends the one you are on when a meeting begins inside it, and fits it in again after', () => {
        // Started at 9:00 for an hour; a 9:30 meeting came in.
        const items = [meeting(570, 60), job('essay', 60, { kept: { start: 540, end: 600 } }), job('email', 30)];
        const before = flowDay(items, 550, window);
        expect(before.current).toMatchObject({ id: 'essay', start: 540, end: 570 });
        expect(clash(before)).toEqual([]);
        // At 9:40, in the meeting: the essay waits until it is over.
        const during = flowDay(items, 580, window);
        expect(clash(during)).toEqual([]);
        expect(during.timeline.find(item => item.id === 'essay')!.start).toBeGreaterThanOrEqual(630);
    });
});

describe('something not ticked keeps its start', () => {
    it('stays at 4 PM and runs past its end until it is ticked', () => {
        const study = { id: 'study', kind: 'habit' as const, title: 'Study', start: 16 * 60, minutes: 120, done: false };
        const window = { wake: 7 * 60, sleep: 23 * 60 };
        expect(flowDay([study], 16 * 60 + 42, window).timeline[0]).toMatchObject({ start: 960, end: 1080 });
        expect(flowDay([study], 19 * 60, window).timeline[0]).toMatchObject({ start: 960, end: 1140 });
        // Ticked: it sits where it was done, and stops growing.
        expect(flowDay([{ ...study, done: true, doneAt: 18 * 60 }], 19 * 60, window).timeline[0]).toMatchObject({ start: 960, end: 1080 });
    });
});

describe('taking a tick back puts the day back', () => {
    it('returns the task to its planned place, and what moved up returns behind it', () => {
        const { remember, emptyMemory } = require('../dayMemory') as typeof import('../dayMemory');
        const window = { wake: 420, sleep: 1380 };
        const day = '2026-10-25';
        const a = { id: 'essay', kind: 'task' as const, title: 'Essay', start: null, minutes: 60, done: false, urgency: 10 };
        const b = { id: 'email', kind: 'task' as const, title: 'Email', start: null, minutes: 30, done: false, urgency: 30 };
        const withMemory = (items: FlowInput[], memory: ReturnType<typeof emptyMemory>) => items.map(item => ({
            ...item, kept: (!item.done && memory.planned?.[item.id]) || memory.slots[item.id],
        }));
        const first = flowDay([a, b], 600, window);
        expect(first.timeline.map(item => [item.id, item.start])).toEqual([['essay', 600], ['email', 660]]);
        const seen = remember(emptyMemory(day), day, first, 600);
        // Ticked by accident at 10:05.
        const ticked = flowDay(withMemory([{ ...a, done: true, doneAt: 605 }, b], seen), 605, window);
        const afterTick = remember(seen, day, ticked, 605);
        // Taken back a minute later: Essay where it was, Email behind it.
        const back = flowDay(withMemory([a, b], afterTick), 606, window);
        const order = back.timeline.map(item => [item.id, item.start]);
        expect(order[0]).toEqual(['essay', 600]);
        expect(back.timeline.find(item => item.id === 'email')!.start).toBeGreaterThanOrEqual(back.timeline.find(item => item.id === 'essay')!.end);
    });
});

describe('travel to and from a calendar event', () => {
    it('keeps an hour before and after School free, and plans around it', () => {
        const items = flowInputs({
            habits: [], tasks: [{ id: 'essay', title: 'Essay', status: 'open', priority: 2, estimatedMinutes: 60 } as never], done: {}, today: '2026-10-26',
            events: [{ id: 'school', title: 'School', start: 690, minutes: 80 }],
            travel: { school: { before: 60, after: 60 } },
        });
        expect(items.filter(item => item.kind === 'event').map(item => [item.title, item.start, item.minutes])).toEqual([
            ['School', 690, 80], ['To School', 630, 60], ['Back from School', 770, 60],
        ]);
        // At 10:00 an hour-long essay does not fit before the 10:30 travel, so it goes after the trip back (13:50).
        const flow = flowDay(items, 600, { wake: 8 * 60, sleep: 23 * 60 });
        const essay = flow.timeline.find(item => item.id.includes('essay'))!;
        expect(essay.start).toBe(830);
    });
});
