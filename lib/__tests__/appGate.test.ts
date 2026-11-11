import { gateView } from '../appGate';
import type { FlowInput } from '../dayFlow';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

const DAY = '2026-11-08';
const item = (id: string, extra: Partial<FlowInput> = {}): FlowInput =>
    ({ id, kind: 'habit', title: id, start: null, minutes: 30, done: false, priority: 2, difficulty: 2, ...extra });

describe('earn your scroll', () => {
    const day = [
        item('read'), item('walk', { priority: 3 }),
        item('study', { kind: 'task', priority: 1, difficulty: 3 }), item('emails', { kind: 'task', difficulty: 1 }),
        item('gym', { difficulty: 3 }),
        item('meal:lunch', { kind: 'meal', fixed: true }), item('event:class', { kind: 'event', fixed: true }),
    ];
    it('the top 3 are the timeline’s first three: tasks, then urgent, then hard; never a meal or event', () => {
        expect(gateView(day, DAY, null).top.map(entry => entry.id)).toEqual(['study', 'emails', 'gym']);
        expect(gateView(day, DAY, null).planned).toBe(5);
    });
    it('opens once all three are done, and stays open today even if something new comes first', () => {
        const done = day.map(entry => (['study', 'emails', 'gym'].includes(entry.id) ? { ...entry, done: true } : entry));
        expect(gateView(done, DAY, null).earned).toBe(true);
        const more = [...day, item('urgent', { kind: 'task', priority: 1 })];
        expect(gateView(more, DAY, null).earned).toBe(false);
        expect(gateView(more, DAY, DAY).earned).toBe(true);
        expect(gateView(more, DAY, '2026-11-07').earned).toBe(false);
    });
    it('nothing planned is not a way out', () => {
        expect(gateView([item('meal:lunch', { kind: 'meal', fixed: true })], DAY, null)).toMatchObject({ earned: false, planned: 0, top: [] });
    });
    it('fewer than three: all of them', () => {
        expect(gateView([item('read', { done: true })], DAY, null).earned).toBe(true);
    });
});

describe('the block screen, in Echo’s voice', () => {
    const { shieldWords } = require('../appGate') as typeof import('../appGate');
    it('lists the top 3 with the done ones ticked, and counts them', () => {
        const words = shieldWords({ top: [{ id: 'a', title: 'Apply to 50 jobs', done: true }, { id: 'b', title: 'Read', done: false }, { id: 'c', title: 'Gym', done: false }], earned: false, planned: 5 });
        expect(words.title).toBe('Earn your scroll');
        expect(words.lines).toEqual(['Complete your priorities or redeem Shards.', '', '✓  Apply to 50 jobs', '○  Read', '○  Gym', '', '1 / 3 complete']);
    });
    it('asks for a plan when nothing is planned', () => {
        expect(shieldWords({ top: [], earned: false, planned: 0 }).title).toBe('Plan your day first');
    });
});
