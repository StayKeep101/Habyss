import { scheduledMoments } from '../scheduledMoments';
import { buildAlivePlan } from '../echoAlive';
import { activityPlan, slotsFromFlow } from '../scheduledActivities';
import { flowDay } from '../dayFlow';
import type { Habit } from '../habitsSQLite';
import type { Task } from '../tasks';
jest.mock('@/modules/habyss-live-activity', () => ({ __esModule: true, default: null }));

const now = new Date(2026, 8, 26, 7, 0);
const habit = (over: Partial<Habit> = {}) => ({ id: 'run', name: 'Run 5 km', startDate: '2026-01-01',
    createdAt: '2026-01-01', startTime: '08:00', frequency: 'daily', taskDays: [], durationMinutes: 30, ...over } as Habit);
const task = (over: Partial<Task> = {}) => ({ id: 'proposal', title: 'Send proposal', status: 'open', dueDate: '2026-09-26',
    dueTime: '16:00', priority: 2, source: 'app', createdAt: '2026-09-01', updatedAt: '2026-09-01', ...over } as Task);
const window = { wake: '07:00', sleep: '23:00' };

describe('scheduled moments shared by Echo and Live Activities', () => {
    it('follows weekdays and excludes untimed, completed, skipped, archived and goal rows', () => {
        const moments = scheduledMoments([
            habit(), habit({ id: 'sunday', taskDays: ['sun'] }), habit({ id: 'done' }), habit({ id: 'skip' }),
            habit({ id: 'archived', isArchived: true }), habit({ id: 'goal', isGoal: true }), habit({ id: 'untimed', startTime: undefined }),
        ], [task(), task({ id: 'old', dueDate: '2026-09-25' }), task({ id: 'done-task', status: 'done' })], now,
        { done: true }, { skip: true }, 1);
        expect(moments.map(item => item.id)).toEqual(['run', 'proposal']);
        expect(moments[0].start).toEqual(new Date(2026, 8, 26, 8));
        expect(moments[0].end).toEqual(new Date(2026, 8, 26, 8, 30));
    });
    it('keeps future occurrences after today’s completion and handles midnight', () => {
        const moments = scheduledMoments([habit({ startTime: '00:00' })], [], now, { run: true });
        expect(moments).toHaveLength(6);
        expect(moments[0].start).toEqual(new Date(2026, 8, 27, 0));
        expect(moments[0].day).toBe('2026-09-27');
    });
    it('ignores invalid times and uses the actual estimated duration', () => {
        const moments = scheduledMoments([habit({ startTime: '25:00' })], [task({ estimatedMinutes: 90 })], now);
        expect(moments).toHaveLength(1);
        expect(moments[0].end).toEqual(new Date(2026, 8, 26, 17, 30));
    });
});

describe('Echo Alive planning', () => {
    const moments = scheduledMoments([habit()], [], now, {}, {}, 1);
    it('encourages ten minutes before and follows up fifteen minutes after the session', () => {
        const plan = buildAlivePlan(moments, now, window, 'friendly', { followUp: true, useName: true, name: 'Ada' });
        expect(plan.map(item => item.date)).toEqual([new Date(2026, 8, 26, 7, 50), new Date(2026, 8, 26, 8, 45)]);
        expect(plan[0].body).toContain('Ada');
        // Said the way a friend would text it, from Echo.
        expect(plan[0].title).toBe('Echo');
        expect(plan[0].body.toLowerCase()).toContain('run 5 km');
        // The follow-up asks, like a text would: "did you run 5 km yet?"
        expect(plan[1].body.toLowerCase()).toMatch(/did you run 5 km yet/);
        expect(new Set(plan.map(item => item.id)).size).toBe(2);
    });
    it('honors follow-up and name preferences, and never schedules in the past', () => {
        const plan = buildAlivePlan(moments, now, window, 'normal', { followUp: false, useName: false, name: 'Ada' });
        expect(plan).toHaveLength(1);
        expect(plan[0].body).not.toContain('Ada');
        expect(buildAlivePlan(moments, new Date(2026, 8, 26, 9), window, 'normal', { followUp: true, useName: false })).toEqual([]);
    });
    it('respects quiet hours including a window that crosses midnight', () => {
        const options = { followUp: true, useName: false };
        expect(buildAlivePlan(moments, now, { wake: '09:00', sleep: '22:00' }, 'normal', options)).toEqual([]);
        expect(buildAlivePlan(moments, now, { wake: '20:00', sleep: '09:00' }, 'normal', options)).toHaveLength(2);
    });
    it('bounds a large schedule in chronological order with stable identifiers', () => {
        const lots = scheduledMoments(Array.from({ length: 100 }, (_, index) => habit({ id: String(index) })), [], now);
        const plan = buildAlivePlan(lots, now, window, 'normal', { followUp: true, useName: false, limit: 56 });
        expect(plan).toHaveLength(56);
        expect(plan.every((item, index) => !index || item.date >= plan[index - 1].date)).toBe(true);
        expect(new Set(plan.map(item => item.id)).size).toBe(56);
    });
});

describe('Live Activity planning', () => {
    const at = (h: number, m = 0) => new Date(2026, 8, 26, h, m).getTime();
    const slots = [
        { key: 'habit:run:2026-09-26', kind: 'habit' as const, id: 'run', title: 'Run 5 km', start: at(8), end: at(8, 30) },
        { key: 'task:mail:2026-09-26', kind: 'task' as const, id: 'mail', title: 'Email', start: at(9), end: at(9, 20) },
    ];
    it('is one card: what you are on now, else what comes next', () => {
        expect(activityPlan(slots, new Date(at(8, 5)), false).map(item => item.title)).toEqual(['Run 5 km']);
        expect(activityPlan(slots, new Date(at(8, 5)), true).map(item => item.title)).toEqual(['Run 5 km']);
        expect(activityPlan(slots, new Date(at(8, 40)), false).map(item => item.title)).toEqual(['Email']);
        expect(activityPlan(slots, new Date(at(8, 40)), true).map(item => item.title)).toEqual(['Email']);
        expect(activityPlan(slots, new Date(at(10)), true)).toEqual([]);
    });
    it('carries what comes next, so the card moves on by itself, and what Done ticks', () => {
        const [card] = activityPlan(slots, new Date(at(8, 5)), false);
        expect(card).toMatchObject({ itemId: 'habit:run', nextTitle: 'Email', nextStart: at(9), nextEnd: at(9, 20), nextItemId: 'task:mail' });
        expect(activityPlan(slots, new Date(at(9, 5)), false)[0].nextTitle).toBeUndefined();
    });
    it('comes from the timeline, auto-placed things, meals and events included', () => {
        const flow = flowDay([
            { id: 'meal:lunch', kind: 'meal', title: 'Lunch', start: 720, minutes: 30, done: false, fixed: true },
            { id: 'read', kind: 'habit', title: 'Read', start: null, minutes: 20, done: false, notBefore: 599 },
        ], 600, { wake: 420, sleep: 1380 });
        const made = slotsFromFlow(flow, '2026-09-26');
        expect(made.map(slot => slot.key)).toEqual(['habit:read:2026-09-26', 'meal:meal:lunch:2026-09-26']);
        // Made at 9:59: not from waking (7:00), from now (lib/dayFlow.ts).
        expect(made[0].start).toBe(new Date(2026, 8, 26, 10, 0).getTime());
    });
});
