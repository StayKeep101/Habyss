// packages/core/src/dayMemory.ts, through the Mac's re-export (the phone's apps/mobile/lib/__tests__/dayMemory.test.ts covers its storage).
import { describe, it, expect } from 'vitest';
import { broughtBack, emptyMemory, remember, seen } from '../dayMemory';
import { nextStep } from '../todayStep';
import { flowDay, flowInputs, type DayFlow, type FlowInput, type FlowItem } from '../dayFlow';


const DAY = '2026-10-20';
const row = (id: string, start: number, end: number, extra: Partial<FlowItem> = {}): FlowItem =>
    ({ id, kind: 'task', title: id, start, end, minutes: end - start, done: false, plannedStart: start, shift: 0, state: 'later', ...extra });
const flowOf = (timeline: FlowItem[], unfit: FlowItem[] = []): DayFlow => ({ timeline, anytime: [], unfit, current: null });

describe('what the timeline remembers', () => {
    it('keeps a ticked thing exactly where the timeline shows it, and remembers its plan', () => {
        const before = remember(emptyMemory(DAY), DAY, flowOf([row('report', 600, 660)]), 590);
        const after = remember(before, DAY, flowOf([row('report', 600, 660, { done: true, state: 'done' })]), 620);
        expect(after.slots.report).toEqual({ start: 600, end: 660 });
        expect(after.planned?.report).toEqual({ start: 600, end: 660 });
        expect(remember(after, DAY, flowOf([row('report', 600, 660, { done: true, state: 'done' })]), 700).slots.report).toEqual({ start: 600, end: 660 });
    });

    it('done before its slot came: it does not move up to now', () => {
        const before = remember(emptyMemory(DAY), DAY, flowOf([row('call', 900, 930)]), 600);
        expect(remember(before, DAY, flowOf([row('call', 900, 930, { done: true })]), 610).slots.call).toEqual({ start: 900, end: 930 });
    });

    it('dots what moved until it is opened, and starts each day afresh', () => {
        const first = remember(emptyMemory(DAY), DAY, flowOf([row('a', 600, 630), row('b', 700, 730)]), 500);
        expect(first.moved).toEqual({});
        const moved = remember(first, DAY, flowOf([row('a', 660, 690), row('b', 704, 734)]), 520);
        expect(moved.moved).toEqual({ a: true });
        expect(seen(moved, 'a').moved).toEqual({});
        expect(remember(moved, '2026-10-21', flowOf([row('a', 660, 690)]), 500).moved).toEqual({});
    });

    it('dots something that no longer fits today', () => {
        const first = remember(emptyMemory(DAY), DAY, flowOf([row('a', 600, 630)]), 500);
        expect(remember(first, DAY, flowOf([], [row('a', 0, 30)]), 520).moved).toEqual({ a: true });
    });

    it('a timeline worked out without something does not forget where it was', () => {
        const first = remember(emptyMemory(DAY), DAY, flowOf([row('a', 600, 660), row('done', 540, 600, { done: true, state: 'done' })]), 610);
        const after = remember(first, DAY, flowOf([]), 611);
        expect(after.slots).toEqual(first.slots);
        expect(after.done).toEqual({ done: true });
    });
});

describe('the day moves on when the time of the one you are on runs out', () => {
    // Nov 6, 10:09 PM: "T'es A" then "Test B", one minute each, both urgent and hard.
    const task = (id: string, title: string, minutes: number, priority: 1 | 2 | 3 = 2): FlowInput =>
        ({ id, kind: 'task', title, start: null, minutes, done: false, priority, difficulty: 3, due: DAY, notBefore: 22 * 60 + 9 });
    const items = [task('a', "T'es A", 1, 1), task('b', 'Test B', 1, 1), task('fix', 'Fix 50 Bugs', 49)];
    const window = { wake: 7 * 60, sleep: 23 * 60 + 30 };
    const look = (memory: ReturnType<typeof emptyMemory>, now: number) => {
        const flow = flowDay(items.map(item => ({ ...item, kept: memory.slots[item.id], lapsed: !!memory.lapsed?.[item.id] })), now, window);
        return { flow, memory: remember(memory, DAY, flow, now) };
    };

    it('at 10:10 Test B is on, and T\'es A stays at 10:09, unticked', () => {
        let memory = look(emptyMemory(DAY), 22 * 60 + 9).memory;
        // Something else works the line out from a partial list in between (it used to forget A).
        memory = remember(memory, DAY, flowOf([]), 22 * 60 + 9);
        const { flow } = look(memory, 22 * 60 + 10);
        expect(flow.current?.id).toBe('b');
        expect(flow.timeline.find(item => item.id === 'a')).toMatchObject({ done: false, start: 22 * 60 + 9, end: 22 * 60 + 10 });
    });

    it('unticked after it was done: laid out again from now, not put back where it was', () => {
        const habit = (id: string, _done: boolean) => ({ id, name: id, isGoal: false, isArchived: false, priority: 2, difficulty: 2, estimatedMinutes: 30 } as never);
        const window = { wake: 7 * 60, sleep: 23 * 60 };
        const lay = (memory: ReturnType<typeof emptyMemory>, done: Record<string, boolean>, now: number) => {
            const items = flowInputs({ habits: [habit('read', !!done.read), habit('walk', false)], tasks: [], done, day: DAY, today: DAY,
                kept: memory.slots, planned: memory.planned, lapsed: memory.lapsed, wasDone: memory.done });
            const flow = flowDay(items, now, window);
            return { flow, memory: remember(memory, DAY, flow, now) };
        };
        // 8:00: read is on. Ticked at 8:10, then unticked at 10:00.
        let { memory } = lay(emptyMemory(DAY), {}, 480);
        ({ memory } = lay(memory, { read: true }, 490));
        const { flow, memory: after } = lay(memory, {}, 600);
        const read = flow.timeline.find(item => item.id === 'read')!;
        expect(read.done).toBe(false);
        expect(read.start).toBeGreaterThanOrEqual(600);
        expect(after.done.read).toBeUndefined();
        // And from then on it keeps that new place.
        expect(lay(after, {}, 601).flow.timeline.find(item => item.id === 'read')).toMatchObject({ start: read.start, end: read.end });
    });
});

describe('the near future holds still, missed ones come back, and moves say why', () => {
    const window = { wake: 540, sleep: 1380 };
    const item = (id: string, minutes: number, extra: Partial<FlowInput> = {}): FlowInput =>
        ({ id, kind: 'habit', title: id, start: null, minutes, done: false, priority: 2, difficulty: 2, ...extra });
    const day = (base: FlowInput[]) => {
        let memory = emptyMemory(DAY);
        let items = base;
        const look = (now: number) => {
            const flow = flowDay(items.map(entry => ({ ...entry, kept: entry.done || memory.again?.[entry.id] ? undefined : memory.slots[entry.id],
                lapsed: !!memory.lapsed?.[entry.id] && !memory.again?.[entry.id], fresh: !!memory.again?.[entry.id] || undefined })), now, window);
            memory = remember(memory, DAY, flow, now);
            return flow;
        };
        const at = (flow: DayFlow, id: string) => flow.timeline.filter(row => row.id === id).map(row => [row.start, row.end]);
        return { look, at, set: (next: FlowInput[]) => { items = next; }, get memory() { return memory; }, back: (ids: string[]) => { memory = broughtBack(memory, ids); } };
    };

    it('something added that is not urgent waits behind what was next', () => {
        const d = day([item('a', 30), item('b', 30)]);
        d.look(540);
        d.set([item('a', 30), item('b', 30), item('hard', 30, { difficulty: 3, notBefore: 550 })]);
        const flow = d.look(550);
        expect(d.at(flow, 'b')).toEqual([[570, 600]]);
        expect(d.at(flow, 'hard')).toEqual([[600, 630]]);
    });
    it('something urgent added never replaces what is on: it goes next, ahead of what was next', () => {
        const d = day([item('meditate', 15), item('read', 30)]);
        d.look(540);
        d.set([item('meditate', 15), item('read', 30), item('call', 20, { kind: 'task', priority: 1, notBefore: 545 })]);
        const flow = d.look(545);
        expect(flow.current?.id).toBe('meditate');
        expect(d.at(flow, 'meditate')).toEqual([[540, 555]]);
        expect(d.at(flow, 'call')).toEqual([[555, 575]]);
        expect(d.at(flow, 'read')).toEqual([[575, 605]]);
    });
    it('something urgent already planned later does not interrupt what is on', () => {
        const d = day([item('first', 30, { kind: 'task', due: '2026-10-19' }), item('urgent', 30, { kind: 'task', priority: 1 })]);
        expect(d.look(540).current?.id).toBe('first');
        expect(d.look(550).current?.id).toBe('first');
    });
    it('missed ones brought back are fitted in from now, then keep that place', () => {
        const d = day([item('walk', 20), item('read', 30)]);
        d.look(540);
        const later = d.look(700);
        expect(later.current).toBeNull();
        expect(nextStep(later, 700)?.missed?.sort()).toEqual(['read', 'walk']);
        d.back(['walk', 'read']);
        const back = d.look(700);
        expect(d.at(back, 'read')).toEqual([[700, 730]]);
        expect(d.at(back, 'walk')).toEqual([[730, 750]]);
        expect(d.memory.again).toEqual({});
        expect(d.at(d.look(705), 'read')).toEqual([[700, 730]]);
    });
    it('says why something moved, and forgets once it is opened', () => {
        const d = day([item('study', 60, { kind: 'task', priority: 1 }), item('read', 30), item('walk', 20)]);
        d.look(540);
        d.set([item('study', 60, { kind: 'task', priority: 1, done: true, doneAt: 560, planned: { start: 540, end: 600 } }), item('read', 30), item('walk', 20)]);
        d.look(560);
        expect(d.memory.why).toEqual({ walk: 'Moved up · study done early' });
        expect(seen(d.memory, 'walk').why).toEqual({});
    });
});

