import { flowDay, type FlowInput } from '../dayFlow';
import { nextStep } from '../todayFlow';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

const window = { wake: 420, sleep: 1380 };
const job = (id: string, minutes: number, extra: Partial<FlowInput> = {}): FlowInput => ({ id, kind: 'task', title: id, start: null, minutes, done: false, ...extra });
const lunch: FlowInput = { id: 'meal:lunch', kind: 'meal', title: 'Lunch', start: 720, minutes: 60, done: false, fixed: true };

describe('focusing all day', () => {
    it('goes to the next habit or task, skipping the one just finished', () => {
        const flow = flowDay([job('essay', 30), job('email', 20)], 600, window);
        // Tied on every rule: by name, email first.
        expect(nextStep(flow, 600)?.item.id).toBe('email');
        expect(nextStep(flow, 600, 'email')).toMatchObject({ item: { id: 'essay' }, wait: false });
    });
    it('makes a meal a step of its own, waiting for it when it has not started', () => {
        const flow = flowDay([lunch, job('essay', 30, { done: true, doneAt: 700 })], 705, window);
        expect(nextStep(flow, 705)).toMatchObject({ item: { id: 'meal:lunch' }, wait: true });
        expect(nextStep(flowDay([lunch], 730, window), 730)).toMatchObject({ item: { id: 'meal:lunch' }, wait: false });
    });
    it('a gap before the next thing is free time, from when the last thing ended', () => {
        const flow = flowDay([lunch, job('essay', 30, { kept: { start: 660, end: 690 } })], 700, window);
        expect(nextStep(flow, 700)).toMatchObject({ item: { id: 'meal:lunch' }, freeFrom: 690 });
        expect(nextStep(flowDay([lunch], 730, window), 730)?.freeFrom).toBeUndefined();
    });
    it('ends when nothing is left', () => {
        expect(nextStep(flowDay([job('a', 30, { done: true })], 800, window), 800)).toBeNull();
    });
});

describe('what Next picks', () => {
    // 9:00 task, still open at 10:30; the 10:30 job on now; something at noon.
    const late = job('nine', 30, { start: 540, locked: true });
    const now = job('apply', 60, { start: 630, locked: true });
    const later = job('noon', 30, { start: 720, locked: true });
    it('what is on now, before something whose time has gone by', () => {
        const flow = flowDay([late, now, later], 640, window);
        expect(nextStep(flow, 640)?.item.id).toBe('apply');
    });
    it('then what comes after now, and only then what was missed', () => {
        const flow = flowDay([late, now, later], 640, window);
        expect(nextStep(flow, 640, 'apply')?.item.id).toBe('noon');
        expect(nextStep(flowDay([late], 640, window), 640)?.item.id).toBe('nine');
    });
});
