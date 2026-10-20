import { goalsWaiting, openNextGoal, queueGoals } from '../goalQueue';
import { emit } from '../appEvents';

jest.mock('../appEvents', () => ({ emit: jest.fn() }));
jest.useFakeTimers();

describe('several goals from the brain dump', () => {
    it('opens the goal sheet for each in turn, as the last one closes', () => {
        queueGoals(['Run a marathon', '  ', 'Read 20 books']);
        jest.runAllTimers();
        expect(emit).toHaveBeenLastCalledWith('show_goal_quick_add', { prefill: 'Run a marathon' });
        expect(goalsWaiting()).toBe(1);
        expect(openNextGoal()).toBe(true);
        jest.runAllTimers();
        expect(emit).toHaveBeenLastCalledWith('show_goal_quick_add', { prefill: 'Read 20 books' });
        expect(openNextGoal()).toBe(false);
        expect(emit).toHaveBeenCalledTimes(2);
    });
});
