import { carryOver, emptyMemory, remember, seen } from '../dayMemory';
import type { DayFlow, FlowItem } from '../dayFlow';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

const DAY = '2026-10-20';
const row = (id: string, start: number, end: number, extra: Partial<FlowItem> = {}): FlowItem =>
    ({ id, kind: 'task', title: id, start, end, minutes: end - start, done: false, plannedStart: start, shift: 0, state: 'later', ...extra });
const flowOf = (timeline: FlowItem[], unfit: FlowItem[] = []): DayFlow => ({ timeline, anytime: [], unfit, current: null });

describe('what the timeline remembers', () => {
    it('keeps a finished thing in its slot, cut short when it was done early', () => {
        const before = remember(emptyMemory(DAY), DAY, flowOf([row('report', 600, 660)]), 590);
        const after = remember(before, DAY, flowOf([row('report', 480, 540, { done: true, state: 'done' })]), 620);
        expect(after.slots.report).toEqual({ start: 600, end: 620 });
        // Seen done again later, it stays put.
        expect(remember(after, DAY, flowOf([row('report', 480, 540, { done: true, state: 'done' })]), 700).slots.report).toEqual({ start: 600, end: 620 });
    });

    it('done before its slot came: placed where it was really done', () => {
        const before = remember(emptyMemory(DAY), DAY, flowOf([row('call', 900, 930)]), 600);
        expect(remember(before, DAY, flowOf([row('call', 900, 930, { done: true })]), 610).slots.call).toEqual({ start: 580, end: 610 });
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
});

describe('the next day', () => {
    it('carries over dated tasks that had no room, still open', () => {
        const memory = remember(emptyMemory(DAY), DAY, flowOf([], [row('essay', 0, 60), row('call', 0, 30)]), 1300);
        const tasks = [
            { id: 'essay', status: 'open', dueDate: DAY },
            { id: 'call', status: 'done', dueDate: DAY },
            { id: 'other', status: 'open', dueDate: DAY },
            { id: 'undated', status: 'open', dueDate: null },
        ];
        expect(carryOver(memory, '2026-10-21', tasks)).toEqual(['essay']);
        // Not on the same day.
        expect(carryOver(memory, DAY, tasks)).toEqual([]);
    });
});
