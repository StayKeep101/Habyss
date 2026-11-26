import { flowDay, flowInputs, mealAround, lengthLabel, lineOrder, upNext, whenLabel, type FlowInput } from '../dayFlow';

const day = { wake: 480, sleep: 1410 };
const meal = (id: string, start: number, minutes: number): FlowInput => ({ id, kind: 'meal', title: id, start, minutes, done: false, fixed: true });
const task = (id: string, extra: Partial<FlowInput> = {}): FlowInput => ({ id, kind: 'task', title: id, start: null, minutes: 30, done: false, ...extra });
const habit = (id: string, extra: Partial<FlowInput> = {}): FlowInput => ({ id, kind: 'habit', title: id, start: null, minutes: 60, done: false, ...extra });
const ids = (items: FlowInput[], now: number | null = null) => flowDay(items, now, day).timeline.filter(row => !row.fixed).map(row => row.id);
const slot = (items: FlowInput[], id: string, now: number | null = null) => {
    const row = flowDay(items, now, day).timeline.find(entry => entry.id === id)!;
    return [row.start, row.end];
};

describe('rule 1: meals and events do not move', () => {
    it('keeps them at their time, whatever else is on the day', () => {
        const items = [meal('breakfast', 480, 60), meal('lunch', 750, 30), task('a', { minutes: 300 })];
        expect(slot(items, 'breakfast')).toEqual([480, 540]);
        expect(slot(items, 'lunch')).toEqual([750, 780]);
    });
    it('never has anything placed on top of one', () => {
        const items = [meal('breakfast', 480, 60), meal('lunch', 750, 30), task('jobs', { minutes: 120 }), habit('long', { minutes: 240 })];
        expect(slot(items, 'jobs')).toEqual([540, 660]);
        const flow = flowDay(items, null, day);
        const lunch = flow.timeline.find(row => row.id === 'lunch')!;
        expect(flow.timeline.filter(row => !row.fixed).every(row => row.end <= lunch.start || row.start >= lunch.end)).toBe(true);
    });
});

describe('rule 2: tasks (deadline, urgency, difficulty) before habits (urgency, difficulty)', () => {
    it('puts every task before every habit', () => {
        expect(ids([habit('walk', { priority: 1, difficulty: 3 }), task('email', { priority: 3, difficulty: 1 })])).toEqual(['email', 'walk']);
    });
    it('orders tasks by deadline first, then urgency, then difficulty', () => {
        const items = [
            task('later-urgent', { due: '2026-10-31', priority: 1 }),
            task('soon-normal', { due: '2026-10-29', priority: 2 }),
            task('soon-urgent-easy', { due: '2026-10-29', priority: 1, difficulty: 1 }),
            task('soon-urgent-hard', { due: '2026-10-29', priority: 1, difficulty: 3 }),
            task('no-deadline', { priority: 1, difficulty: 3 }),
        ];
        expect(ids(items)).toEqual(['soon-urgent-hard', 'soon-urgent-easy', 'soon-normal', 'later-urgent', 'no-deadline']);
    });
    it('orders habits by urgency, then difficulty', () => {
        const items = [habit('easy-urgent', { priority: 1, difficulty: 1 }), habit('hard-normal', { priority: 2, difficulty: 3 }), habit('hard-urgent', { priority: 1, difficulty: 3 })];
        expect(ids(items)).toEqual(['hard-urgent', 'easy-urgent', 'hard-normal']);
    });
    it('ignores the time a habit or task was given', () => {
        expect(ids([habit('a', { start: 1200, priority: 1 }), habit('b', { start: 540, priority: 2 })])).toEqual(['a', 'b']);
    });
    it('falls back to the name, so the order never flips between looks', () => {
        expect(lineOrder(habit('b'), habit('a'))).toBeGreaterThan(0);
    });
});

describe('the line', () => {
    it('starts at waking, one thing straight after another, around meals', () => {
        // This morning: breakfast 8–9, Answer mom (task), Fix bugs, Apply to jobs, lunch 12:30.
        const items = [meal('breakfast', 480, 60), meal('lunch', 750, 30),
            task('mom', { minutes: 30, due: '2026-10-30' }), habit('bugs', { minutes: 60, difficulty: 3 }), habit('jobs', { minutes: 120 })];
        expect(slot(items, 'mom')).toEqual([540, 570]);
        expect(slot(items, 'bugs')).toEqual([570, 630]);
        expect(slot(items, 'jobs')).toEqual([630, 750]);
    });
    it('gives something with no length its kind\'s default: a task 90 minutes, a habit 30', () => {
        expect(slot([task('call', { minutes: 0 })], 'call')).toEqual([480, 570]);
        expect(slot([habit('stretch', { minutes: 0 })], 'stretch')).toEqual([480, 510]);
    });
    it('with auto-reschedule off, moves nothing: things keep their times, and a reschedule or an early finish lays nothing out again', () => {
        const items = [task('report', { start: 600, minutes: 60 }), habit('run', { start: 540, minutes: 30, rescheduledAt: 700 }), task('loose', { minutes: 30 })];
        const off = flowDay(items, 720, day, { auto: false });
        const at = (id: string) => { const row = off.timeline.find(item => item.id === id)!; return [row.start, row.end]; };
        expect(at('report')).toEqual([600, 660]);
        expect(at('run')).toEqual([540, 570]);
        // What has no time is not placed: it waits in Anytime.
        expect(off.timeline.some(item => item.id === 'loose')).toBe(false);
        expect(off.anytime.map(item => item.id)).toEqual(['loose']);
        // Like a calendar: nothing wears the lock, and a tick before the end changes nothing.
        expect(off.timeline.every(item => !item.locked)).toBe(true);
        const ticked = flowDay(items.map(item => item.id === 'report' ? { ...item, done: true, doneAt: 610 } : item), 720, day, { auto: false });
        expect(ticked.timeline.find(item => item.id === 'report')!.end).toBe(660);
        // On, today: the day was planned from waking, so the run had its place this morning
        // and the clock has passed it; made just now, it lines up from now instead.
        const on = flowDay(items, 720, day);
        expect(on.timeline.find(item => item.id === 'run')!.start).toBeLessThan(720);
        const made = flowDay(items.map(item => item.id === 'run' ? { ...item, notBefore: 719 } : item), 720, day);
        expect(made.timeline.find(item => item.id === 'run')!.start).toBeGreaterThanOrEqual(720);
    });
    it('says what is on now and what is next, and nothing else', () => {
        const flow = flowDay([meal('breakfast', 480, 60), task('mom'), habit('bugs')], 552, day);
        const state = (id: string) => flow.timeline.find(row => row.id === id)!.state;
        expect(state('breakfast')).toBe('done');
        expect(state('mom')).toBe('now');
        expect(state('bugs')).toBe('next');
        expect(flow.current?.id).toBe('mom');
        expect(flowDay([task('mom', { done: true })], 552, day).timeline[0].state).toBe('done');
    });
    it('shows another day with nothing on now', () => {
        const flow = flowDay([task('mom')], null, day);
        expect(flow.current).toBeNull();
        expect(flow.timeline[0].state).toBe('later');
    });
});

describe('reading habits and tasks in', () => {
    it('takes a task\'s deadline, else its planned day, for ordering', () => {
        const items = flowInputs({
            habits: [], done: {},
            tasks: [
                { id: 't1', title: 'A', status: 'todo', priority: 2, dueDate: '2026-10-28', deadline: '2026-10-30' } as never,
                { id: 't2', title: 'B', status: 'todo', priority: 1, dueDate: '2026-10-28' } as never,
            ],
        });
        expect(items.find(item => item.id === 't1')).toMatchObject({ due: '2026-10-30', priority: 2 });
        expect(items.find(item => item.id === 't2')).toMatchObject({ due: '2026-10-28', priority: 1 });
    });
});

describe('labels', () => {
    it('labels lengths plainly', () => {
        expect(lengthLabel(30)).toBe('30 min');
        expect(lengthLabel(60)).toBe('1 hr');
        expect(lengthLabel(90)).toBe('1 hr 30 min');
    });
    it('reads a slot', () => {
        expect(whenLabel({ start: 1170, end: 1170, state: 'done' })).toBe('7:30 PM–7:30 PM');
        expect(whenLabel({ start: 1045, end: 1165, state: 'later' })).toBe('5:25 PM–7:25 PM (2 hr)');
    });
});

describe('what comes next after a focus', () => {
    it('is the next open thing on the line', () => {
        const items = [task('report'), task('call'), habit('workout')];
        expect(upNext(flowDay(items, 490, day), 'report')?.id).toBe('call');
        expect(upNext(flowDay(items.map(item => item.id === 'call' ? { ...item, done: true } : item), 490, day), 'report')?.id).toBe('workout');
        expect(upNext(flowDay([items[0]], 490, day), 'report')).toBeNull();
    });
});

describe('rule 3: exact time stays at its time', () => {
    it('keeps it there with everything else flowing around it, and it can still be done', () => {
        const items = [task('mom'), habit('call', { start: 510, minutes: 30, locked: true }), habit('bugs', { minutes: 60 })];
        // mom 8:00–8:30, the call holds 8:30–9:00, bugs after it.
        expect(slot(items, 'call')).toEqual([510, 540]);
        expect(slot(items, 'bugs')).toEqual([540, 600]);
        const flow = flowDay(items.map(item => item.id === 'call' ? { ...item, done: true } : item), 515, day);
        expect(flow.timeline.find(row => row.id === 'call')).toMatchObject({ start: 510, state: 'done', locked: true });
    });
});

describe('rule 4: too long for the time before a meal, it splits around it', () => {
    it('takes the time left before, and the rest after', () => {
        // Breakfast 8–9, lunch 12:30–1: a 4 hr habit fills 9–12:30 and finishes 1–1:30.
        const items = [meal('breakfast', 480, 60), meal('lunch', 750, 30), habit('long', { minutes: 240 })];
        const parts = flowDay(items, null, day).timeline.filter(row => row.id === 'long');
        expect(parts.map(row => [row.start, row.end, row.part])).toEqual([
            [540, 750, { index: 1, of: 2 }],
            [780, 810, { index: 2, of: 2 }],
        ]);
    });
    it('splits around an exact-time thing too, and the next one follows the last part', () => {
        const items = [habit('call', { start: 540, minutes: 30, locked: true }), task('essay', { minutes: 90 }), habit('walk', { minutes: 30 })];
        const flow = flowDay(items, null, day).timeline.filter(row => !row.locked);
        expect(flow.map(row => [row.id, row.start, row.end])).toEqual([['essay', 480, 540], ['essay', 570, 600], ['walk', 600, 630]]);
    });
});

describe('bedtime is the end of the line (rule 7)', () => {
    // Free from 20:35, booked 21:00–23:30, bed at 23:30.
    const evening = { wake: 1235, sleep: 1410 };
    const booked = { id: 'event', kind: 'event' as const, title: 'event', start: 1260, minutes: 150, done: false, fixed: true };

    it('cuts the last free thing short to fit, instead of running past bedtime', () => {
        const flow = flowDay([booked, habit('sales', { minutes: 30 })], null, evening);
        const parts = flow.timeline.filter(row => row.id === 'sales');
        expect(parts).toHaveLength(1);
        expect([parts[0].start, parts[0].end]).toEqual([1235, 1260]);
        expect(parts[0].cutFrom).toBe(30);
        expect(flow.unfit).toEqual([]);
    });

    it('puts what has no room at all under the line', () => {
        const flow = flowDay([booked, habit('a', { minutes: 30 }), habit('b', { minutes: 30 })], null, evening);
        expect(flow.timeline.some(row => row.id === 'b')).toBe(false);
        expect(flow.unfit.map(item => item.id)).toEqual(['b']);
        expect(flow.timeline.every(row => row.fixed || row.end <= 1410)).toBe(true);
    });

    it('reads a bedtime after midnight as that night', () => {
        const flow = flowDay([habit('late', { minutes: 60 })], null, { wake: 1380, sleep: 30 });
        const late = flow.timeline.find(row => row.id === 'late')!;
        expect([late.start, late.end, late.cutFrom]).toEqual([1380, 1440, undefined]);
    });
});

describe('travel either side of an event', () => {
    it('is told apart from the event itself', () => {
        const { isTravel } = require('../dayFlow') as typeof import('../dayFlow');
        expect(isTravel('event:abc:to')).toBe(true);
        expect(isTravel('event:abc:back')).toBe(true);
        expect(isTravel('event:abc')).toBe(false);
        expect(isTravel('task:to')).toBe(false);
    });
    const school = { id: 'ev1', title: 'School', start: 690, minutes: 80 };
    it('puts the trip there and back on the line, fixed, and plans nothing in them', () => {
        const travel = { school: { before: 60, after: 45 } };
        const items = flowInputs({ habits: [], tasks: [], done: {}, day: '2026-11-12', events: [school], travel });
        expect(items.find(i => i.id === 'event:ev1:to')).toMatchObject({ start: 630, minutes: 60, fixed: true });
        expect(items.find(i => i.id === 'event:ev1:back')).toMatchObject({ start: 770, minutes: 45, fixed: true });
        const flow = flowDay([...items, task('essay', { minutes: 120 })], 480, day);
        const essay = flow.timeline.filter(row => row.id === 'essay');
        for (const part of essay) expect(part.end <= 630 || part.start >= 815).toBe(true);
    });
    it('set for this day only, wins over the one for its name, even when it is none', () => {
        const travel = { school: { before: 60, after: 45 }, '#2026-11-12#ev1': { before: 0, after: 0 } };
        const today = flowInputs({ habits: [], tasks: [], done: {}, day: '2026-11-12', events: [school], travel });
        const tomorrow = flowInputs({ habits: [], tasks: [], done: {}, day: '2026-11-13', events: [school], travel });
        expect(today.some(i => i.id.endsWith(':to'))).toBe(false);
        expect(tomorrow.some(i => i.id.endsWith(':to'))).toBe(true);
    });
    it('the way back leaves when the event was ended early, and carries the heads-up on the way there', () => {
        const travel = { school: { before: 30, after: 20, warn: 10 } };
        const items = flowInputs({ habits: [], tasks: [], done: {}, day: '2026-11-12', events: [school], travel, ended: { 'event:ev1': 720 } });
        expect(items.find(i => i.id === 'event:ev1:back')!.start).toBe(720);
        expect(items.find(i => i.id === 'event:ev1:to')!.warn).toBe(10);
    });
});

describe('free time', () => {
    it('is the waking day less what is planned, overlaps counted once', () => {
        const { freeTime: free } = require('../dayFlow') as typeof import('../dayFlow');
        const flow = { timeline: [{ start: 480, end: 540 }, { start: 520, end: 600 }, { start: 1380, end: 1500 }] as never[] };
        // 8:00–23:30 awake (930 min); busy 8:00–10:00 (120) and 23:00–23:30 (30).
        expect(free(flow, day)).toMatchObject({ free: 780, awake: 930 });
    });
});

describe('a meal or event that finished early', () => {
    it('ticked, it keeps its whole place: fixed things never move', () => {
        const items = [
            { id: 'event:class', kind: 'event' as const, title: 'Class', start: 600, minutes: 120, done: true, doneAt: 650, fixed: true },
            task('essay', { minutes: 60, notBefore: 650 }),
        ];
        const flow = flowDay(items, 652, day);
        expect(flow.timeline.find(row => row.id === 'event:class')).toMatchObject({ start: 600, end: 720, state: 'done' });
        expect(flow.timeline.find(row => row.id === 'essay')!.start).toBe(720);
    });
    it('an exact-time habit ticked before its time stays at its time, whole', () => {
        const gym = { id: 'gym', kind: 'habit' as const, title: 'Gym', start: 840, minutes: 60, done: true, doneAt: 610, locked: true };
        expect(flowDay([gym, task('work', { minutes: 90 })], 610, day).timeline.find(row => row.id === 'gym')).toMatchObject({ start: 840, end: 900, state: 'done' });
    });
    it('is read from what was ended early', () => {
        const { flowInputs } = require('../dayFlow') as typeof import('../dayFlow');
        const items = flowInputs({ habits: [], tasks: [], done: {}, meals: [{ id: 'supper', name: 'Supper', start: 1110, minutes: 45 }], ended: { 'meal:supper': 1130 } });
        expect(items[0]).toMatchObject({ done: true, doneAt: 1130 });
    });
});

describe('today: done stays where it was done, what you are on stays, the rest from now', () => {
    it('what you are on keeps the place you saw it in', () => {
        const items = [meal('breakfast', 480, 60), task('mom', { kept: { start: 540, end: 570 } }), habit('bugs', { kept: { start: 570, end: 630 } })];
        expect(slot(items, 'mom', 552)).toEqual([540, 570]);
        expect(slot(items, 'bugs', 552)).toEqual([570, 630]);
    });
    it('the one you were on ends at the tick, and what is open after it starts then', () => {
        const items = [task('mom', { done: true, doneAt: 495, planned: { start: 480, end: 510 } }), habit('bugs', { difficulty: 3, kept: { start: 510, end: 570 } }), habit('jobs', { minutes: 120, kept: { start: 570, end: 690 } })];
        const flow = flowDay(items, 496, day);
        expect(flow.timeline.find(row => row.id === 'mom')).toMatchObject({ start: 480, end: 495, state: 'done' });
        expect(flow.timeline.find(row => row.id === 'bugs')).toMatchObject({ start: 496, end: 556, state: 'now' });
    });
    it('keeps a ticked task where it was on the line (Study Spanish 8:09–8:39, ticked 8:11)', () => {
        const items = [habit('walk', { minutes: 30 }), task('spanish', { minutes: 30, done: true, doneAt: 1211, planned: { start: 1209, end: 1239 } })];
        expect(flowDay(items, 1212, day).timeline.find(row => row.id === 'spanish')).toMatchObject({ start: 1209, end: 1211, state: 'done' });
    });
    it('ticked ahead of its turn: at its tick, above what you are on, in the order ticked', () => {
        const ahead = (id: string, at: number, stamp: number) => task(id, { minutes: 30, done: true, doneAt: at, doneStamp: stamp, planned: { start: 540, end: 570 } });
        const items = [task('now', { minutes: 30, kept: { start: 480, end: 510 } }), ahead('b', 490, 2000), ahead('a', 490, 1000), habit('c', { minutes: 30, kept: { start: 570, end: 600 } })];
        expect(flowDay(items, 491, day).timeline.map(row => row.id)).toEqual(['a', 'b', 'now', 'c']);
    });
    it('puts an urgent task added in the evening now, not at the start of the day', () => {
        const items = [task('urgent', { priority: 1, minutes: 60, notBefore: 1178 }), habit('read'), habit('walk', { done: true, doneAt: 600 })];
        expect(slot(items, 'urgent', 1178)).toEqual([1178, 1238]);
    });
    it('time up and not done: the next one takes over, and it stays where it was, unticked', () => {
        const items = [task('read', { minutes: 30, kept: { start: 480, end: 510 } }), habit('gym', { minutes: 60, kept: { start: 510, end: 570 } }), task('call', { minutes: 30, kept: { start: 570, end: 600 } })];
        const flow = flowDay(items, 511, day);
        expect(flow.current?.id).toBe('gym');
        expect(flow.timeline.find(row => row.id === 'read')).toMatchObject({ start: 480, end: 510, done: false });
    });
    it('nothing ticked all along: the clock walks down the line, one thing after the next', () => {
        const { remember, emptyMemory } = require('../dayMemory') as typeof import('../dayMemory');
        const base = [task('a', { minutes: 1, priority: 1, difficulty: 3 }), task('b', { minutes: 1, priority: 1, difficulty: 3 }), habit('c', { minutes: 2 }), habit('d', { minutes: 30 })].map(item => ({ ...item, notBefore: 1329 }));
        let memory = emptyMemory('2026-11-06');
        const look = (minute: number) => {
            const flow = flowDay(base.map(item => ({ ...item, kept: memory.slots[item.id], lapsed: !!memory.lapsed?.[item.id] })), minute, day);
            memory = remember(memory, '2026-11-06', flow, minute);
            return flow;
        };
        const on = [1329, 1330, 1331, 1332, 1333, 1334, 1340].map(minute => look(minute).current?.id);
        expect(on).toEqual(['a', 'b', 'c', 'c', 'd', 'd', 'd']);
        const final = look(1341).timeline;
        expect(final.find(row => row.id === 'a')).toMatchObject({ start: 1329, end: 1330, done: false });
        expect(final.find(row => row.id === 'b')).toMatchObject({ start: 1330, end: 1331, done: false });
    });
    it('split around a meal, the one on now keeps its place minute after minute, then the day moves on', () => {
        const { remember, emptyMemory } = require('../dayMemory') as typeof import('../dayMemory');
        const dinner: FlowInput = { id: 'meal:dinner', kind: 'meal', title: 'Dinner', start: 1110, minutes: 30, done: false, fixed: true };
        const base = [task('study', { minutes: 90, priority: 1, difficulty: 3, notBefore: 1095 }), dinner, habit('read', { minutes: 30, notBefore: 1095 })];
        let memory = emptyMemory('2026-11-07');
        const look = (minute: number) => {
            const flow = flowDay(base.map(item => ({ ...item, kept: memory.slots[item.id], lapsed: !!memory.lapsed?.[item.id] })), minute, day);
            memory = remember(memory, '2026-11-07', flow, minute);
            return flow;
        };
        look(1095);
        for (const minute of [1096, 1100, 1109]) {
            const flow = look(minute);
            expect(flow.current?.id).toBe('study');
            expect(flow.timeline.filter(row => row.id === 'study').map(row => [row.start, row.end])).toEqual([[1095, 1110], [1140, 1215]]);
        }
        expect(look(1150).current?.id).toBe('study');
        const later = look(1220);
        expect(later.current?.id).toBe('read');
        expect(later.timeline.find(row => row.id === 'study')).toMatchObject({ start: 1095, end: 1110, done: false });
    });
    it('planned from waking, app open or not: a 2-hour study at 9:00 hands over at 11:00', () => {
        const { remember, emptyMemory } = require('../dayMemory') as typeof import('../dayMemory');
        const morning = { wake: 540, sleep: 1410 };
        const base = [task('study', { minutes: 120, priority: 1, difficulty: 3 }), habit('read', { minutes: 30 }), task('email', { minutes: 20 })];
        let memory = emptyMemory('2026-11-07');
        const look = (minute: number) => {
            const flow = flowDay(base.map(item => ({ ...item, kept: memory.slots[item.id], lapsed: !!memory.lapsed?.[item.id] })), minute, morning);
            memory = remember(memory, '2026-11-07', flow, minute);
            return flow;
        };
        // First opened at 10:59: Study has been on since 9:00.
        expect(look(659)).toMatchObject({ current: { id: 'study', start: 540, end: 660 } });
        // 11:00, not ticked: the next one is on, Study stays at 9:00–11:00.
        const eleven = look(660);
        expect(eleven.current?.id).toBe('email');
        expect(eleven.timeline.find(row => row.id === 'study')).toMatchObject({ start: 540, end: 660, done: false });
        // First opened at 1:00 PM instead: the whole morning has gone by on the clock.
        const late = flowDay(base, 780, morning);
        expect(late.timeline.find(row => row.id === 'study')).toMatchObject({ start: 540, end: 660 });
        expect(late.current).toBeNull();
    });
    it('a missed one ticked hours later is ticked in its own place, not at the tick', () => {
        const items = [task('emails', { minutes: 30, done: true, doneAt: 760, planned: { start: 605, end: 635 } }), habit('read', { minutes: 30, kept: { start: 755, end: 785 } })];
        expect(flowDay(items, 761, day).timeline.find(row => row.id === 'emails')).toMatchObject({ start: 605, end: 635, done: true });
    });
    it('ticked across a meal, it is drawn around the meal, never over it', () => {
        const breakfast: FlowInput = { id: 'meal:breakfast', kind: 'meal', title: 'Breakfast', start: 480, minutes: 30, done: false, fixed: true };
        const items = [breakfast, task('study', { minutes: 150, done: true, doneAt: 560, planned: { start: 420, end: 570 } })];
        const rows = flowDay(items, 561, { wake: 420, sleep: 1410 }).timeline.filter(row => row.id === 'study');
        expect(rows.map(row => [row.start, row.end])).toEqual([[420, 480], [510, 560]]);
    });
    it('ticked after its time had passed: ticked where it was, nothing else moves', () => {
        const items = [task('read', { minutes: 30, done: true, doneAt: 530, planned: { start: 480, end: 510 } }), habit('gym', { minutes: 60, kept: { start: 510, end: 570 } })];
        const flow = flowDay(items, 531, day);
        expect(flow.timeline.find(row => row.id === 'read')).toMatchObject({ start: 480, end: 510 });
        expect(flow.timeline.find(row => row.id === 'gym')).toMatchObject({ start: 510, end: 570, state: 'now' });
    });
    it('a 1-minute task whose time is up does not come back to the front on the next look', () => {
        const { remember, emptyMemory } = require('../dayMemory') as typeof import('../dayMemory');
        const base = [task('quick', { minutes: 1, notBefore: 1200 }), habit('gym', { minutes: 60, notBefore: 1200 })];
        let memory = emptyMemory('2026-11-06');
        const look = (minute: number) => {
            const items = base.map(item => ({ ...item, kept: memory.slots[item.id], lapsed: !!memory.lapsed?.[item.id] }));
            const flow = flowDay(items, minute, day);
            memory = remember(memory, '2026-11-06', flow, minute);
            return flow;
        };
        expect(look(1200).current?.id).toBe('quick');
        for (const minute of [1201, 1202, 1205, 1230]) expect(look(minute).current?.id).toBe('gym');
    });
});


describe('remembered places never overlap', () => {
    // A habit away from the list for a moment came back with its old place (11:00–12:30),
    // over a task's (10:30–12:00): it took "now" from the one really on, and two rows overlapped.
    const at = (h: number, m = 0) => h * 60 + m;
    const items = [
        task('repair', { minutes: 90, kept: { start: at(10, 30), end: at(12) } }),
        habit('engineer', { minutes: 90, kept: { start: at(11), end: at(12, 30) } }),
        habit('sales', { minutes: 60, kept: { start: at(12), end: at(13) } }),
        meal('lunch', at(13), 30),
    ];

    it('keeps the one really on now', () => {
        expect(flowDay(items, at(12, 11), day).current?.id).toBe('sales');
    });

    it('lines the stale one up again, after what is on', () => {
        const rows = flowDay(items, at(12, 11), day).timeline.filter(row => !row.fixed);
        const engineer = rows.filter(row => row.id === 'engineer');
        expect(Math.min(...engineer.map(row => row.start))).toBeGreaterThanOrEqual(at(13));
    });

    it('never draws two open things over each other', () => {
        for (const now of [at(9), at(11, 15), at(12, 11), at(14)]) {
            const rows = flowDay(items, now, day).timeline.filter(row => !row.done && row.end > row.start);
            for (const a of rows) for (const b of rows) {
                if (a === b) continue;
                expect(a.start < b.end && b.start < a.end).toBe(false);
            }
        }
    });
});

describe('meals around classes', () => {
    const lunch = { id: 'lunch', name: 'Lunch', start: 12 * 60, minutes: 30 };
    const startOf = (input: Parameters<typeof flowInputs>[0]) => flowInputs(input).find(item => item.id === 'meal:lunch')?.start;
    const base = { habits: [], tasks: [], done: {}, day: '2026-11-10', meals: [lunch] };

    it('keeps lunch at its time when no class covers it', () => {
        expect(mealAround(720, 30, [{ start: 600, end: 700 }])).toBe(720);
    });
    it('moves lunch to the nearest free time when a class covers it', () => {
        // Class 11:30–12:50: lunch right after it, at 12:50.
        expect(startOf({ ...base, events: [{ id: 'c', title: 'Class', start: 690, minutes: 80 }] })).toBe(770);
        // Class 12:00–14:00 with a free hour before it: lunch just before, at 11:30.
        expect(mealAround(720, 30, [{ start: 720, end: 840 }])).toBe(690);
    });
    it('counts the walk to and from class as busy too', () => {
        const travel = { class: { before: 20, after: 20 } };
        // Class 12:00–13:00, 20 min each way: 11:40–13:20 is taken; lunch at 11:10 (nearest).
        expect(startOf({ ...base, travel, events: [{ id: 'c', title: 'Class', start: 720, minutes: 60 }] })).toBe(670);
    });
    it('leaves lunch out for the day when classes fill every gap around it', () => {
        const events = [
            { id: 'a', title: 'A', start: 540, minutes: 170 }, // 9:00–11:50
            { id: 'b', title: 'B', start: 710, minutes: 30 }, // 11:50–12:20
            { id: 'c', title: 'C', start: 740, minutes: 200 }, // 12:20–15:40
        ];
        expect(startOf({ ...base, events })).toBeUndefined();
    });
});
