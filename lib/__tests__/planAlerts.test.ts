import { flowDay, type FlowInput } from '../dayFlow';
import { planAlert } from '../planAlerts';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

const window = { wake: 7 * 60, sleep: 23 * 60 };
const task = (id: string, start: number | null, minutes: number): FlowInput => ({ id, kind: 'task', title: id, start, minutes, done: false });

describe('Echo, when the plan moves', () => {
    it('has nothing to say when something runs over: the line never moves', () => {
        const items = [task('Workout', null, 45), task('Email', null, 30)];
        expect(planAlert(items, flowDay(items, 430, window), 430, window)).toBeNull();
    });

    it('has nothing to say when everything is done', () => {
        const items = [{ ...task('Done', 540, 30), done: true }];
        expect(planAlert(items, flowDay(items, 600, window), 600, window)).toBeNull();
    });
});
