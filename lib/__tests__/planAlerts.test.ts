import { flowDay, type FlowInput } from '../dayFlow';
import { planAlert } from '../planAlerts';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => null), setItem: jest.fn(async () => undefined) }));

const window = { wake: 7 * 60, sleep: 23 * 60 };
const task = (id: string, start: number | null, minutes: number): FlowInput => ({ id, kind: 'task', title: id, start, minutes, done: false });

describe('Echo, when the plan moves', () => {
    it('never moves the one you are on: says what its running over pushes back', () => {
        // Under way since 9:00 (its slot held), the email next.
        const items = [{ ...task('Workout', null, 45), kept: { start: 540, end: 585 } }, task('Email', null, 30)];
        const alert = planAlert(items, flowDay(items, 545, window), 545, window);
        // 9:45 end, ten minutes' grace: at 9:55 the workout is still yours, and the email waits.
        expect(alert?.at).toBe(595);
        expect(alert?.body).toMatch(/^Workout is taking longer than planned, so Email now starts at .+\.$/);
    });

    it('says so when the last thing loses its room before bedtime', () => {
        const items = [{ ...task('Essay', null, 60), kept: { start: 1260, end: 1320 } }, task('Read', null, 60)];
        const alert = planAlert(items, flowDay(items, 1265, window), 1265, window);
        expect(alert?.body).toMatch(/Read is cut to \d+ min to fit before bedtime|no room left for Read before bedtime/);
    });

    it('has nothing to say when everything is done', () => {
        const items = [{ ...task('Done', 540, 30), done: true }];
        expect(planAlert(items, flowDay(items, 600, window), 600, window)).toBeNull();
    });
});
