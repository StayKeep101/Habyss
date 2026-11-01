import { flowDay, flowInputs, lengthLabel, lineOrder, upNext, whenLabel, type FlowInput } from '../dayFlow';

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
    it('is the same whenever you look: opening late never moves a start', () => {
        const items = [meal('breakfast', 480, 60), task('mom'), habit('bugs')];
        expect(slot(items, 'mom', 552)).toEqual([540, 570]);
        expect(slot(items, 'mom', 900)).toEqual([540, 570]);
        expect(slot(items, 'mom', null)).toEqual([540, 570]);
    });
    it('does not move anything when something is ticked', () => {
        const items = [task('mom'), habit('bugs')];
        expect(slot(items.map(item => ({ ...item, done: item.id === 'mom' })), 'bugs', 500)).toEqual(slot(items, 'bugs', 500));
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
        // What has no time is placed once, in the free time.
        expect(at('loose')).toEqual([480, 510]);
        // On, the same day moves: the reschedule lays the run out again from 11:40.
        const on = flowDay(items, 720, day);
        expect(on.timeline.find(item => item.id === 'run')!.start).toBe(700);
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

describe('rule 5: a swipe reschedules from that moment, by priority', () => {
    // 8:00 mom (task), 8:30 bugs (hard habit), 9:30 jobs (habit).
    const items = [task('mom'), habit('bugs', { difficulty: 3 }), habit('jobs', { minutes: 120 })];
    it('puts a missed habit back after the moment, in order with what is still to come', () => {
        // At 9:40 bugs (8:30–9:30) was missed; jobs is on 9:30–11:30. Swiping bugs at 9:40:
        // jobs started before 9:40 and stays; bugs goes after it.
        const flow = flowDay(items.map(item => item.id === 'bugs' ? { ...item, rescheduledAt: 580 } : item), 580, day);
        expect(flow.timeline.find(row => row.id === 'jobs')).toMatchObject({ start: 570, end: 690 });
        expect(flow.timeline.find(row => row.id === 'bugs')).toMatchObject({ start: 690, end: 750 });
        expect(flow.timeline.find(row => row.id === 'mom')!.start).toBe(480);
    });
    it('lets a more important one go first: everything open after the moment is ordered again', () => {
        // Swiping mom (a task) at 8:30: it goes first from 8:30, bugs and jobs after it.
        const flow = flowDay(items.map(item => item.id === 'mom' ? { ...item, rescheduledAt: 510 } : item), 515, day);
        expect(['mom', 'bugs', 'jobs'].map(id => flow.timeline.find(row => row.id === id)!.start)).toEqual([510, 540, 600]);
    });
    it('never moves what is done', () => {
        const done = items.map(item => item.id === 'jobs' ? { ...item, done: true } : item.id === 'bugs' ? { ...item, rescheduledAt: 480 } : item);
        const flow = flowDay(done, 485, day);
        expect(flow.timeline.find(row => row.id === 'jobs')).toMatchObject({ start: 570, end: 690 });
    });
});

describe('rule 6: ticked before its end, the next one starts', () => {
    // 8:00 mom (task, 30 min), 8:30 bugs (habit, 60 min), 9:30 jobs (habit, 2 hr).
    const items = [task('mom'), habit('bugs', { difficulty: 3 }), habit('jobs', { minutes: 120 })];
    it('ends it at the tick, and what is open after it starts then', () => {
        const flow = flowDay(items.map(item => item.id === 'mom' ? { ...item, done: true, doneAt: 495 } : item), 496, day);
        expect(flow.timeline.find(row => row.id === 'mom')).toMatchObject({ start: 480, end: 495, state: 'done' });
        expect(flow.timeline.find(row => row.id === 'bugs')).toMatchObject({ start: 495, end: 555, state: 'now' });
        expect(flow.timeline.find(row => row.id === 'jobs')).toMatchObject({ start: 555, end: 675 });
    });
    it('takes no time when ticked before it began, and the next one starts then', () => {
        // bugs (8:30) ticked at 8:10, while mom is still on: bugs takes no time; jobs starts at 8:30.
        const flow = flowDay(items.map(item => item.id === 'bugs' ? { ...item, done: true, doneAt: 490 } : item), 491, day);
        expect(flow.timeline.find(row => row.id === 'bugs')).toMatchObject({ start: 510, end: 510 });
        expect(flow.timeline.find(row => row.id === 'jobs')).toMatchObject({ start: 510, end: 630 });
        expect(flow.timeline.find(row => row.id === 'mom')).toMatchObject({ start: 480, end: 510 });
    });
    it('does nothing when it was ticked at or after its end', () => {
        const flow = flowDay(items.map(item => item.id === 'mom' ? { ...item, done: true, doneAt: 520 } : item), 521, day);
        expect(flow.timeline.find(row => row.id === 'mom')).toMatchObject({ start: 480, end: 510 });
        expect(flow.timeline.find(row => row.id === 'bugs')).toMatchObject({ start: 510, end: 570 });
    });
});
