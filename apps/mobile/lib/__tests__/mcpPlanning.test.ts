import { planningRows, validateInput, PLANNING_TOOLS } from '../mcpPlanning';
import { taskToLocal } from '../cloudMapping';
let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const plan = (name: string, args: Record<string, unknown>) => planningRows(name, args, '2026-11-03', id);
beforeEach(() => { n = 0; });
it('creates app-readable tasks and habits with their defaults', () => {
    const task = plan('add_task', { title: 'Prototype', subtasks: ['Sketch', 'Implement'] }).tasks[0];
    expect(JSON.parse(taskToLocal(task).subtasks)).toHaveLength(2);
    expect(task.estimated_minutes).toBe(90);
    const habit = plan('add_habit', { name: 'Build daily', task_days: ['mon', 'wed'] }).habits[0];
    expect(habit).toMatchObject({ duration_minutes: 30, task_days: ['mon', 'wed'], start_date: '2026-11-03' });
});
it('offers only tasks and habits', () => {
    expect(PLANNING_TOOLS.map(tool => tool.name)).toEqual(['add_task', 'add_habit']);
});
it.each([
    ['add_task', { title: 'x', due_date: '2026-02-30' }],
    ['add_task', { title: 'x', due_time: '25:00' }],
    ['add_task', { title: 'x', estimated_minutes: 1441 }],
    ['add_task', { title: 'x', user_id: 'someone else' }],
    ['add_task', { title: ' ' }],
    ['add_task', { title: 'x', goal_id: '00000000-0000-4000-8000-000000000001' }],
    ['add_habit', { name: 'x', task_days: ['monday'] }],
    ['add_habit', { name: 'x', start_date: '2026-12-01', end_date: '2026-11-01' }],
    ['add_goal', { name: 'x' }],
])('rejects invalid %s input before writing', (name, args) => {
    expect(() => plan(name as string, args as Record<string, unknown>)).toThrow();
});
it('stores numeric habits in the app format', () => {
    expect(plan('add_habit', { name: 'Read', goal_value: 20, unit: 'pages' }).habits[0]).toMatchObject({ tracking_method: 'numeric', goal_value: 20 });
});
it('rejects malformed input', () => {
    const schema = PLANNING_TOOLS.find(t => t.name === 'add_task')!.inputSchema;
    expect(() => validateInput(null, schema)).toThrow();
});
