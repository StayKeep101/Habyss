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
    it('starts something that would run into one when it ends', () => {
        // Breakfast 8–9, a 2 hr task, lunch 12:30: a 4 hr habit cannot fit 11–12:30, so it starts at 1.
        const items = [meal('breakfast', 480, 60), meal('lunch', 750, 30), task('jobs', { minutes: 120 }), habit('long', { minutes: 240 })];
        expect(slot(items, 'jobs')).toEqual([540, 660]);
        expect(slot(items, 'long')).toEqual([780, 1020]);
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
    it('gives something with no length 30 minutes', () => {
        expect(slot([task('call', { minutes: 0 })], 'call')).toEqual([480, 510]);
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
