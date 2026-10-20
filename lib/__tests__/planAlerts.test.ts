import { flowDay, type FlowInput } from '../dayFlow';
import { planAlert } from '../planAlerts';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

const window = { wake: 7 * 60, sleep: 23 * 60 };
const task = (id: string, start: number | null, minutes: number): FlowInput => ({ id, kind: 'task', title: id, start, minutes, done: false });

describe('Echo, when the plan moves', () => {
    it('says ahead of time where the thing will go if it is not done in its time', () => {
        const items = [task('Workout', 540, 45), task('Read', 840, 30)];
        const alert = planAlert(items, flowDay(items, 545, window), 545, window);
        // 9:45 end, ten minutes' grace: at 9:55 it moves to then.
        expect(alert?.at).toBe(595);
        expect(alert?.body).toMatch(/^Workout didn't get done by .+, so I moved it to .+\.$/);
    });

    it('says so when there is no room left before bedtime', () => {
        const items = [task('Essay', 1260, 90)];
        const alert = planAlert(items, flowDay(items, 1265, window), 1265, window);
        expect(alert?.body).toMatch(/no room left for it before bedtime/);
    });

    it('has nothing to say when everything is done', () => {
        const items = [{ ...task('Done', 540, 30), done: true }];
        expect(planAlert(items, flowDay(items, 600, window), 600, window)).toBeNull();
    });
});
