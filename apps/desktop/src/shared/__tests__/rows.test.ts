import { describe, expect, it } from 'vitest';
import type { HabitRow, TaskRow } from '../../types';
import { rowToHabit, rowToTask } from '../rows';

const habitRow = (over: Partial<HabitRow>): HabitRow => ({ id: 'h1', user_id: 'u', name: 'Run', created_at: '2026-01-01T00:00:00Z', is_goal: 0, is_archived: 0, show_memo: 1, task_days: '["mon","wed"]', reminders: null, location_reminders: '[{"name":"Gym","latitude":1,"longitude":2,"trigger":"nope"},{"name":"bad"}]', priority: 2, flexible: 0, deleted: 0, synced: 1, refused: 0, ...over } as HabitRow);
const taskRow = (over: Partial<TaskRow>): TaskRow => ({ id: 't1', user_id: 'u', title: 'Write', status: null, priority: null, measure: 'count', target: 25, amount: 3, subtasks: '[{"title":"a","done":1}]', flexible: 1, created_at: 'c', updated_at: 'u', deleted: 0, synced: 1, refused: 0, ...over } as TaskRow);

describe('rowToHabit', () => {
    it('maps SQLite columns with the same defaults as mobile', () => {
        const habit = rowToHabit(habitRow({}));
        expect(habit).toMatchObject({ id: 'h1', showMemo: true, type: 'build', color: '#6B46C1', goalPeriod: 'daily', goalValue: 1, unit: 'count', chartType: 'bar', ringtone: 'default', startDate: '2026-01-01T00:00:00Z', taskDays: ['mon', 'wed'], reminders: [], priority: 2, flexible: false });
        expect(habit.locationReminders).toEqual([{ name: 'Gym', latitude: 1, longitude: 2, radius: undefined, trigger: 'arrive' }]);
    });
});

describe('rowToTask', () => {
    it('maps SQLite columns with the same defaults as mobile', () => {
        expect(rowToTask(taskRow({}))).toMatchObject({ id: 't1', status: 'open', priority: 2, source: 'app', measure: 'count', target: 25, amount: 3, flexible: true, subtasks: [{ id: 'a', title: 'a', done: true }] });
    });
});
