import { planningRows, PLANNING_TOOLS, validateInput } from '../mcpPlanning';
import { habitToLocal, taskToLocal, milestoneToLocal } from '../cloudMapping';
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const plan = (name: string, args: Record<string, unknown>) => planningRows(name, args, '2026-11-03', id);
beforeEach(() => { n = 0; });
it('creates an app-readable roadmap with ordered milestones and correctly linked children', () => {
    const rows = plan('create_roadmap', { goal: { name: 'Launch', target_date: '2026-12-01' }, milestones: [
        { title: 'Build', tasks: [{ title: 'Prototype', subtasks: ['Sketch', 'Implement'] }] },
        { title: 'Release', due_date: '2026-12-01' },
    ], habits: [{ name: 'Build daily', task_days: ['mon', 'wed'] }], tasks: [{ title: 'Research' }] });
    const goal = rows.habits[0];
    expect(JSON.parse(habitToLocal(goal).goal_spec).kind).toBe('complete');
    expect(rows.habits[1].goal_id).toBe(goal.id);
    expect(rows.tasks.map(t => t.goal_id)).toEqual([goal.id, goal.id]);
    expect(taskToLocal(rows.tasks[0]).milestone_id).toBe(rows.milestones[0].id);
    expect(JSON.parse(taskToLocal(rows.tasks[0]).subtasks)).toHaveLength(2);
    expect(rows.milestones.map(m => milestoneToLocal(m).position)).toEqual([0, 1]);
    expect(rows.tasks[0].estimated_minutes).toBe(90);
    expect(rows.habits[1].duration_minutes).toBe(30);
});
it.each([
    ['add_task', { title: 'x', due_date: '2026-02-30' }],
    ['add_task', { title: 'x', due_time: '25:00' }],
    ['add_task', { title: 'x', estimated_minutes: 1441 }],
    ['add_task', { title: 'x', user_id: 'someone else' }],
    ['add_task', { title: ' ' }],
    ['add_habit', { name: 'x', task_days: ['monday'] }],
    ['add_habit', { name: 'x', start_date: '2026-12-01', end_date: '2026-11-01' }],
    ['add_goal', { name: 'x', kind: 'number' }],
    ['add_goal', { name: 'x', kind: 'number', target: 10 }],
    ['add_task', { title: 'x', goal_id: 'invalid' }],
])('rejects invalid %s input before writing', (name, args) => {
    expect(() => plan(name as string, args as Record<string, unknown>)).toThrow();
});
it('stores measurable goals and numeric habits in the app format', () => {
    const goal = plan('add_goal', { name: 'Practice', kind: 'time', target: 600 }).habits[0];
    expect(goal.goal_spec).toMatchObject({ kind: 'time', target: 600, metric_unit: 'minutes', aggregation: 'sum' });
    expect(plan('add_habit', { name: 'Read', goal_value: 20, unit: 'pages' }).habits[0]).toMatchObject({ tracking_method: 'numeric', goal_value: 20 });
});
it('rejects malformed and excessive nested roadmaps', () => {
    const schema = PLANNING_TOOLS.find(t => t.name === 'create_roadmap')!.inputSchema;
    expect(() => validateInput(null, schema)).toThrow();
    expect(() => plan('create_roadmap', { goal: { name: 'x' }, milestones: Array.from({ length: 4 }, () => ({ title: 'x', tasks: Array.from({ length: 100 }, () => ({ title: 'x' })) })) })).toThrow('300');
});
