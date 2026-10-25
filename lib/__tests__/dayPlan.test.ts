import { buildDayPlan, spanLabel } from '../dayPlan';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';

const habit = (over: Partial<Habit>): Habit => ({ id: 'h', name: 'Gym', goalValue: 1, unit: 'times', type: 'build', ...over } as Habit);
const task = (over: Partial<Task>): Task => ({ id: 't', title: 'Proposal', priority: 2, status: 'open', source: 'app', createdAt: '', updatedAt: '', ...over });

describe('the day as hours', () => {
    it('counts what is left from now until bed, and what is planned in it', () => {
        const plan = buildDayPlan({
            habits: [habit({ startTime: '18:00', durationMinutes: 60 })],
            tasks: [task({ estimatedMinutes: 90 })],
            completions: {}, wake: '07:00', sleep: '23:00', now: 13 * 60,
        });
        expect(plan.left).toBe(10 * 60);
        expect(plan.planned).toBe(150);
        expect(plan.spare).toBe(600 - 150);
        expect(plan.unplaced.map(item => item.title)).toEqual(['Proposal']);
        // 13:00-18:00 and 19:00-23:00 are free; the longer first.
        expect(plan.free).toEqual([{ start: 780, end: 1080 }, { start: 1140, end: 1380 }]);
    });

    it('takes a timed habit at its target and drops what is done', () => {
        const plan = buildDayPlan({
            habits: [habit({ id: 'a', goalValue: 240, unit: 'minutes' }), habit({ id: 'b', durationMinutes: 30 })],
            tasks: [], completions: { b: true }, wake: '07:00', sleep: '23:00', now: null,
        });
        expect(plan.planned).toBe(240);
        expect(plan.left).toBe(16 * 60);
        expect(spanLabel(plan.planned)).toBe('4 h');
    });

    it('handles a bedtime after midnight', () => {
        const plan = buildDayPlan({ habits: [], tasks: [], completions: {}, wake: '09:00', sleep: '01:00', now: 23 * 60 });
        expect(plan.left).toBe(120);
    });
});

describe('what is on at a minute', () => {
    it('finds what is running, or what is about to start nearby', () => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { blocksAt } = require('../dayPlan') as typeof import('../dayPlan');
        const plan = { blocks: [
            { id: 'run', kind: 'habit' as const, title: 'Run', start: 480, end: 510, done: false },
            { id: 'call', kind: 'task' as const, title: 'Call', start: 600, end: 600, done: true },
        ] };
        expect(blocksAt(plan, 495).map(block => block.id)).toEqual(['run']);
        expect(blocksAt(plan, 595).map(block => block.id)).toEqual(['call']);
        expect(blocksAt(plan, 700)).toEqual([]);
    });
});

describe('a timed habit\'s length on the timeline', () => {
    it('follows its goal after an edit, not the slot or length it had before', () => {
        const { habitMinutes } = require('../dayPlan') as typeof import('../dayPlan');
        // "Study" was 4 hours (09:00–13:00, 240 minutes), then edited to a 2-hour goal.
        const study = { id: 's', name: 'Study', startTime: '09:00', endTime: '13:00', durationMinutes: 240, unit: 'hours', goalValue: 2, trackingMethod: 'numeric', type: 'build' } as any;
        expect(habitMinutes(study)).toBe(120);
    });
});
