import { buildWidgetDay, buildWidgetShards } from '../widgetDay';
import type { DayFlow, FlowItem } from '../dayFlow';

const item = (over: Partial<FlowItem>): FlowItem => ({
    id: 'a', kind: 'habit', title: 'Read', start: 480, end: 510, minutes: 30, done: false,
    plannedStart: 480, shift: 0, state: 'later', ...over,
} as FlowItem);

const flow = (timeline: FlowItem[]): DayFlow => ({ timeline, anytime: [], unfit: [], current: null });

describe('widget day', () => {
    it('keeps the line in order with its times and kinds', () => {
        const day = buildWidgetDay(flow([
            item({ id: 'h', title: 'Run', start: 420, end: 450, color: '#FF0000' }),
            item({ id: 'e', kind: 'event', title: 'Standup', start: 540, end: 555, color: 'red' }),
        ]), '2026-11-10', 420, 1380);
        expect(day.items).toEqual([
            { id: 'h', kind: 'habit', title: 'Run', start: 420, end: 450, done: false, color: '#FF0000' },
            { id: 'e', kind: 'event', title: 'Standup', start: 540, end: 555, done: false },
        ]);
        expect(day).toMatchObject({ version: 1, day: '2026-11-10', wake: 420, sleep: 1380 });
    });

    it('shows a split item once, from its first part to its last', () => {
        const day = buildWidgetDay(flow([
            item({ id: 't', kind: 'task', start: 480, end: 500, part: { index: 0, of: 2 } }),
            item({ id: 'm', kind: 'meal', title: 'Lunch', start: 500, end: 530 }),
            item({ id: 't', kind: 'task', start: 530, end: 550, part: { index: 1, of: 2 } }),
        ]), 'd', 0, 0);
        expect(day.items.map(entry => [entry.id, entry.start, entry.end])).toEqual([['t', 480, 550], ['m', 500, 530]]);
    });

    it('is empty without a flow', () => {
        expect(buildWidgetDay(null, 'd', 1, 2).items).toEqual([]);
    });
});

describe('widget shards', () => {
    it('samples the last day every half hour and ends on the balance', () => {
        const now = 100 * 3600_000;
        const shards = buildWidgetShards(140, 20, [
            { t: now - 48 * 3600_000, value: 100 },
            { t: now - 2 * 3600_000, value: 120 },
            { t: now - 60_000, value: 140 },
        ], now);
        expect(shards.line).toHaveLength(49);
        expect(shards.line[0]).toBe(100);
        expect(shards.line[shards.line.length - 3]).toBe(100 + 20);
        expect(shards.line[shards.line.length - 1]).toBe(140);
        expect(shards).toMatchObject({ balance: 140, today: 20, version: 1 });
    });
});
