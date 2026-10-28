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
    it('ends when nothing is left', () => {
        expect(nextStep(flowDay([job('a', 30, { done: true })], 800, window), 800)).toBeNull();
    });
});
