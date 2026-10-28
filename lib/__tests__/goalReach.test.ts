import { buildGoalInsights, goalCompletedOn, goalDoneOn, withCompletedOn } from '../goalInsights';
import type { Habit } from '../habitsSQLite';

const TODAY = '2026-10-28';
const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
// "Get a 7 CGPA": reached by logging 7 or more, never added up.
const cgpa = (over: Record<string, unknown> = {}): Habit => ({
    id: 'g', name: 'Get a 7 CGPA', isGoal: true, startDate: '2026-10-28', targetDate: '2026-12-20', createdAt: '2026-10-28T08:00:00.000Z',
    taskDays: EVERY_DAY, goalSpec: JSON.stringify({ kind: 'number', target: 7, metric_unit: 'gpa', aggregation: 'latest', ...over }),
} as Habit);
const study = (id: string): Habit => ({ id, name: `Study ${id}`, goalId: 'g', goalValue: 1, startDate: '2026-10-28', createdAt: '2026-10-28T08:00:00.000Z', taskDays: EVERY_DAY } as Habit);
const habits = ['a', 'b', 'c', 'd', 'e'].map(study);
const allStudied = { [TODAY]: ['a', 'b', 'c', 'd', 'e'] };

describe('a goal you reach (a 7 CGPA)', () => {
    it('reads the number logged against the target: 5.6 of 7 is 80%', () => {
        const insights = buildGoalInsights({ goal: cgpa(), habits, tasks: [], history: {}, logs: [{ date: TODAY, amount: 5.6 }], today: TODAY });
        expect(insights.progress).toBe(80);
    });
    it('is never pushed up by its study habits', () => {
        const insights = buildGoalInsights({ goal: cgpa(), habits, tasks: [], history: allStudied, logs: [{ date: TODAY, amount: 5.6 }], today: TODAY });
        expect(insights.progress).toBe(80);
        expect(goalDoneOn(insights)).toBeNull();
    });
    it('stays at 0% until a number is logged, however much is studied', () => {
        const insights = buildGoalInsights({ goal: cgpa(), habits, tasks: [], history: allStudied, logs: [], today: TODAY });
        expect(insights.progress).toBe(0);
    });
    it('shows the latest number, never a sum: 5.6, then 5.9 is 5.9 of 7', () => {
        const logs = [{ date: '2026-10-26', amount: 5.6 }, { date: TODAY, amount: 5.9 }];
        const insights = buildGoalInsights({ goal: cgpa({}), habits, tasks: [], history: {}, logs, today: TODAY });
        expect(insights.progress).toBe(84);
    });
    it('with no deadline, is reached by logging the target or more', () => {
        const open = { ...cgpa(), targetDate: undefined } as Habit;
        const insights = buildGoalInsights({ goal: open, habits, tasks: [], history: {}, logs: [{ date: TODAY, amount: 7.1 }], today: TODAY });
        expect(goalDoneOn(insights, open)).toBe(TODAY);
    });
    it('with a deadline, is judged on the deadline: still 7 or more then', () => {
        const goal = cgpa();
        const reachedEarly = [{ date: '2026-11-10', amount: 7.1 }];
        const before = buildGoalInsights({ goal, habits, tasks: [], history: {}, logs: reachedEarly, today: '2026-11-15' });
        expect(goalDoneOn(before, goal)).toBeNull();
        const held = buildGoalInsights({ goal, habits, tasks: [], history: {}, logs: reachedEarly, today: '2026-12-21' });
        expect(goalDoneOn(held, goal)).toBe('2026-12-20');
        const dropped = buildGoalInsights({ goal, habits, tasks: [], history: {}, logs: [...reachedEarly, { date: '2026-12-01', amount: 6 }], today: '2026-12-21' });
        expect(goalDoneOn(dropped, goal)).toBeNull();
    });
});

describe('a reached goal stays reached', () => {
    it('is done from the day saved on it, whatever its habits do after', () => {
        const goal = cgpa();
        const saved = { ...goal, goalSpec: withCompletedOn(goal, '2026-10-28') } as Habit;
        expect(goalCompletedOn(saved)).toBe('2026-10-28');
        // Its habits moved to another goal: nothing counts toward it now, still done.
        const insights = buildGoalInsights({ goal: saved, habits: [], tasks: [], history: {}, logs: [], today: TODAY });
        expect(goalDoneOn(insights, saved)).toBe('2026-10-28');
        expect(goalDoneOn(insights, goal)).toBeNull();
    });
});
