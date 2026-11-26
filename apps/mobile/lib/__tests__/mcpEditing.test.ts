import { EDITING_TOOLS, checkEditing, daysBetween, habitPatch, percent, taskPatch } from '../mcpEditing';

describe('MCP editing tools', () => {
    it('every tool has a description and an object schema', () => {
        for (const tool of EDITING_TOOLS) {
            expect(tool.description.length).toBeGreaterThan(10);
            expect(tool.inputSchema.type).toBe('object');
        }
    });

    it('rejects unknown fields and bad values', () => {
        expect(() => checkEditing('update_task', { find: 'Essay', due_date: '2026-02-30' })).toThrow(/real YYYY-MM-DD/);
        expect(() => checkEditing('update_task', { find: 'Essay', colour: 'red' })).toThrow(/unknown field/);
        expect(() => checkEditing('update_habit', { find: 'Read', paused: 'yes' })).toThrow(/true or false/);
        expect(() => checkEditing('get_range', { from: '2026-11-01' })).toThrow(/missing to/);
        expect(() => checkEditing('add_thought', { text: '   ' })).toThrow();
        expect(() => checkEditing('update_habit', { find: 'Read', paused: true })).not.toThrow();
    });

    it('reschedules, reopens and ticks a task', () => {
        expect(taskPatch({ due_date: '2026-11-21', due_time: '09:00' }, 'now')).toEqual({ due_date: '2026-11-21', due_time: '09:00' });
        expect(taskPatch({ status: 'done' }, 'now')).toEqual({ status: 'done', completed_at: 'now' });
        expect(taskPatch({ status: 'open', priority: 'high' }, 'now')).toEqual({ status: 'open', completed_at: null, priority: 1 });
        expect(() => taskPatch({}, 'now')).toThrow(/Nothing to change/);
    });

    it('changes a habit\'s days, pauses it and keeps its dates in order', () => {
        expect(habitPatch({ task_days: ['mon', 'mon', 'wed'] }, {})).toEqual({ task_days: ['mon', 'wed'], recurrence: null });
        expect(habitPatch({ paused: true }, {})).toEqual({ is_archived: true });
        expect(() => habitPatch({ end_date: '2026-01-01' }, { start_date: '2026-02-01' })).toThrow(/end_date/);
    });

    it('lists the days of a range and caps it', () => {
        expect(daysBetween('2026-02-27', '2026-03-02', 10)).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02']);
        expect(() => daysBetween('2026-03-02', '2026-03-01', 10)).toThrow(/on or after/);
        expect(() => daysBetween('2026-01-01', '2026-12-31', 92)).toThrow(/At most 92/);
        expect(percent(2, 3)).toBe('67%');
        expect(percent(0, 0)).toBe('–');
    });
});
