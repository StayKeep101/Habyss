import { describe, expect, it } from 'vitest';
import type { Interval, TaskRow } from '../types';
import { allocation, greeting, productivePercent, rangeBounds, tasksInRange } from './stats';

const at = (s: string) => new Date(s).getTime();
const MIN = 60000;
const iv = (category: string, start: number, mins: number, state = 'active'): Interval => ({ id: `${category}-${start}`, application_id: null, bundle_id: category, name: category, title: null, start, end: start + mins * MIN, state, category, availability: 'available', pid: 1, window_id: null });
const task = (id: string, over: Partial<TaskRow> = {}): TaskRow => ({ id, user_id: null, title: id, description: null, due_date: null, due_time: null, estimated_minutes: null, priority: null, goal_id: null, status: 'open', completed_at: null, source: null, external_id: null, measure: null, target: null, unit: null, amount: null, milestone_id: null, subtasks: null, deadline: null, section: null, difficulty: null, flexible: null, created_at: null, updated_at: null, deleted: 0, synced: 1, owner_id: null, refused: 0, ...over });

describe('stats', () => {
  it('week_starts_monday', () => {
    // 2026-11-02 is a Monday; 2026-11-08 is the Sunday of the same week.
    expect(rangeBounds('Week', new Date('2026-11-02T20:04:00'))).toEqual([at('2026-11-02T00:00:00'), at('2026-11-02T20:04:00')]);
    expect(rangeBounds('Week', new Date('2026-11-08T09:00:00'))).toEqual([at('2026-11-02T00:00:00'), at('2026-11-08T09:00:00')]);
    expect(rangeBounds('Week', new Date('2026-11-04T09:00:00'))[0]).toBe(at('2026-11-02T00:00:00'));
    expect(rangeBounds('Today', new Date('2026-11-04T09:00:00'))).toEqual([at('2026-11-04T00:00:00'), at('2026-11-04T09:00:00')]);
  });

  it('month_and_year_bounds_local', () => {
    const now = new Date('2026-11-17T08:30:00');
    expect(rangeBounds('Month', now)).toEqual([new Date(2026, 10, 1).getTime(), now.getTime()]);
    expect(rangeBounds('Year', now)).toEqual([new Date(2026, 0, 1).getTime(), now.getTime()]);
    expect(new Date(rangeBounds('Month', now)[0]).getHours()).toBe(0);
  });

  it('greeting_boundaries', () => {
    expect(greeting(new Date('2026-11-02T04:59:00'))).toBe('Good Evening');
    expect(greeting(new Date('2026-11-02T05:00:00'))).toBe('Good Morning');
    expect(greeting(new Date('2026-11-02T11:59:00'))).toBe('Good Morning');
    expect(greeting(new Date('2026-11-02T12:00:00'))).toBe('Good Afternoon');
    expect(greeting(new Date('2026-11-02T17:59:00'))).toBe('Good Afternoon');
    expect(greeting(new Date('2026-11-02T18:00:00'))).toBe('Good Evening');
  });

  it('allocation_folds_small_into_other', () => {
    const t = at('2026-11-02T08:00:00');
    // 1000 minutes in all: five big categories, two under 5% and one idle stretch that never counts.
    const list = [iv('development', t, 400), iv('research', t, 200), iv('design', t, 150), iv('communication', t, 100), iv('personal', t, 60), iv('social', t, 49), iv('games', t, 41), iv('development', t, 500, 'idle')];
    const end = t + 1000 * MIN;
    expect(allocation(list, t, end, end)).toEqual([
      { label: 'development', value: 400 * MIN }, { label: 'research', value: 200 * MIN }, { label: 'design', value: 150 * MIN },
      { label: 'communication', value: 100 * MIN }, { label: 'personal', value: 60 * MIN }, { label: 'Other', value: 90 * MIN },
    ]);
    // More than five large categories: the sixth also folds into Other.
    const six = ['a', 'b', 'c', 'd', 'e', 'f'].map((c, i) => iv(c, t, 100 - i));
    const out = allocation(six, t, end, end);
    expect(out.map(s => s.label)).toEqual(['a', 'b', 'c', 'd', 'e', 'Other']);
    expect(out[5].value).toBe(95 * MIN);
  });

  it('allocation_empty_is_empty', () => {
    const t = at('2026-11-02T08:00:00');
    expect(allocation([], t, t + 3600000, t + 3600000)).toEqual([]);
    expect(allocation([iv('development', t, 30, 'idle')], t, t + 3600000, t + 3600000)).toEqual([]);
    // Clipped to the range and to now.
    expect(allocation([iv('development', t - 30 * MIN, 60)], t, t + 3600000, t + 10 * MIN)).toEqual([{ label: 'development', value: 10 * MIN }]);
  });

  it('productive_null_without_classified_time', () => {
    const t = at('2026-11-02T08:00:00'), end = t + 3600000;
    expect(productivePercent([], { development: 'productive' }, t, end, end)).toBeNull();
    // Only neutral or unclassified time: nothing to judge.
    expect(productivePercent([iv('uncategorized', t, 30), iv('personal', t, 10)], { personal: 'neutral' }, t, end, end)).toBeNull();
    // Productive time that is idle does not count.
    expect(productivePercent([iv('development', t, 30, 'idle')], { development: 'productive' }, t, end, end)).toBeNull();
  });

  it('productive_percent_counts_active_only', () => {
    const t = at('2026-11-02T08:00:00'), end = t + 3 * 3600000;
    const list = [iv('development', t, 60), iv('social', t + 60 * MIN, 20), iv('uncategorized', t + 80 * MIN, 20), iv('development', t + 100 * MIN, 60, 'idle')];
    const classes = { development: 'productive', social: 'unproductive' } as const;
    // 60 productive of 100 active; uncategorized counts in the denominator.
    expect(productivePercent(list, classes, t, end, end)).toBe(60);
    // Clipped to now: 30 productive of 30 active.
    expect(productivePercent(list, classes, t, end, t + 30 * MIN)).toBe(100);
  });

  it('tasks_in_range_counts_due_and_completed', () => {
    const tasks = [
      task('due-open', { due_date: '2026-11-03' }),
      task('due-done', { due_date: '2026-11-02', status: 'done', completed_at: new Date('2026-11-04T21:30:00').toISOString() }),
      task('due-done-late', { due_date: '2026-11-08', status: 'done', completed_at: new Date('2026-11-10T09:00:00').toISOString() }),
      task('before', { due_date: '2026-11-01', status: 'done', completed_at: new Date('2026-11-02T09:00:00').toISOString() }),
      task('after', { due_date: '2026-11-09' }),
      task('undated', { status: 'done', completed_at: new Date('2026-11-02T09:00:00').toISOString() }),
      task('deleted', { due_date: '2026-11-03', deleted: 1 }),
      task('cancelled', { due_date: '2026-11-03', status: 'cancelled' }),
    ];
    expect(tasksInRange(tasks, '2026-11-02', '2026-11-08')).toEqual({ done: 1, total: 3 });
    expect(tasksInRange([], '2026-11-02', '2026-11-08')).toEqual({ done: 0, total: 0 });
  });
});
