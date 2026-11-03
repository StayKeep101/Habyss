import { describe, expect, it } from 'vitest';
import type { CloudData, CompletionRow, HabitRow, TaskRow } from '../types';
import { buildToday } from './today';
import { rowToHabit, rowToTask } from '../shared/rows';
import { streakFrom } from '../shared/dayComplete';
const at = (day: string, h = 10, m = 0) => new Date(`${day}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
const habit = (id: string, over: Partial<HabitRow> = {}): HabitRow => ({ id, user_id: null, name: id, description: null, category: null, icon: null, is_goal: 0, target_date: null, goal_id: null, task_days: null, reminders: null, start_date: '2026-01-01', end_date: null, duration_minutes: null, start_time: null, end_time: null, type: null, color: null, goal_period: null, goal_value: null, unit: null, chart_type: null, is_archived: 0, show_memo: null, frequency: null, week_interval: null, time_of_day: null, graph_style: null, tracking_method: null, reminder_offset: null, reminder_message: null, recurrence: null, location_reminders: null, health_kit_metric: null, health_kit_target: null, ringtone: null, goal_spec: null, priority: null, difficulty: null, flexible: null, created_at: '2026-01-01T00:00:00', updated_at: null, deleted: 0, synced: 1, owner_id: null, refused: 0, ...over });
const task = (id: string, over: Partial<TaskRow> = {}): TaskRow => ({ id, user_id: null, title: id, description: null, due_date: null, due_time: null, estimated_minutes: null, priority: null, goal_id: null, status: 'open', completed_at: null, source: null, external_id: null, measure: null, target: null, unit: null, amount: null, milestone_id: null, subtasks: null, deadline: null, section: null, difficulty: null, flexible: null, created_at: '2026-01-01T00:00:00', updated_at: null, deleted: 0, synced: 1, owner_id: null, refused: 0, ...over });
const done = (habitId: string, date: string, over: Partial<CompletionRow> = {}): CompletionRow => ({ id: `${habitId}-${date}`, user_id: null, habit_id: habitId, date, value: null, memo: null, created_at: `${date}T09:00:00`, updated_at: null, evidence: null, skipped: 0, deleted: 0, synced: 1, owner_id: null, refused: 0, ...over });
const cloud = (over: Partial<CloudData> = {}): CloudData => ({ habits: [], completions: [], tasks: [], milestones: [], ...over });
const TODAY = '2026-11-02';
const TOMORROW = '2026-11-03';
const build = (data: CloudData | null, now: Date, signedIn = true) => buildToday(data, { now, signedIn });

describe('buildToday', () => {
    it('scheduled_habits_and_due_tasks_make_the_day', () => {
        const data = cloud({
            habits: [habit('daily'), habit('tue-only', { task_days: '["tue"]' })],
            tasks: [task('today-task', { due_date: TODAY }), task('tomorrow-task', { due_date: TOMORROW })],
        });
        expect(build(data, at(TODAY)).items.map(i => i.id).sort()).toEqual(['daily', 'today-task']);
    });
    it('ticked_habit_is_done_and_counts', () => {
        const data = cloud({ habits: [habit('daily')], tasks: [task('t', { due_date: TODAY })], completions: [done('daily', TODAY)] });
        const today = build(data, at(TODAY));
        expect(today.items.find(i => i.id === 'daily')?.done).toBe(true);
        expect(today.done).toBe(1);
        expect(today.total).toBe(2);
    });
    it('tasks_count_only_listed_tasks', () => {
        // Ruling P6: "Tasks" is task-only, over the tasks the day lists (overdue and undated included), with no habits and no cap.
        const data = cloud({ habits: [habit('daily')], completions: [done('daily', TODAY)], tasks: [task('a', { due_date: TODAY }), task('b', { due_date: TODAY, status: 'done', completed_at: `${TODAY}T08:00:00` }), task('overdue', { due_date: '2026-10-30' }), task('undated'), task('later', { due_date: TOMORROW })] });
        const today = build(data, at(TODAY));
        const listed = today.items.filter(i => i.kind === 'task');
        expect(listed.map(i => i.id).sort()).toEqual(['a', 'b', 'overdue', 'undated']);
        expect([today.tasksDone, today.tasksTotal]).toEqual([1, 4]);
        expect([build(data, at(TODAY), false).tasksDone, build(null, at(TODAY)).tasksTotal]).toEqual([0, 0]);
    });
    it('counts_an_item_split_into_parts_once', () => {
        // Rule 4 can list one task in several parts; it is still one task and one row in the counts.
        const data = cloud({ tasks: [task('Ship', { due_date: TODAY, status: 'done', completed_at: at(TODAY, 20, 4).toISOString() }), task('Overdue', { due_date: '2026-10-30' }), task('Undated'), task('Done', { due_date: TODAY, status: 'done', completed_at: `${TODAY}T09:00:00` })] });
        const today = build(data, at(TODAY, 20, 4));
        expect(today.items.filter(i => i.id === 'Undated').length).toBeGreaterThan(1);
        expect([today.tasksDone, today.tasksTotal, today.listedDone, today.listedTotal]).toEqual([2, 4, 2, 4]);
    });
    it('current_is_the_item_on_now', () => {
        const data = cloud({ habits: [habit('h')], tasks: [task('t', { due_date: TODAY })] });
        // Tasks come first: t 07:00-08:30, h 08:30-09:00.
        const today = build(data, at(TODAY, 7, 30));
        expect(today.current?.id).toBe('t');
        expect(today.next?.id).toBe('h');
    });
    it('overdue_and_undated_open_tasks_show_today', () => {
        const data = cloud({ tasks: [task('overdue', { due_date: '2026-10-30' }), task('undated'), task('goal-todo', { goal_id: 'g' }), task('done-old', { due_date: '2026-10-30', status: 'done', completed_at: '2026-10-30T09:00:00' })] });
        expect(build(data, at(TODAY)).items.map(i => i.id).sort()).toEqual(['overdue', 'undated']);
    });
    it('midnight_rolls_the_day', () => {
        const data = cloud({ tasks: [task('t', { due_date: TODAY }), task('n', { due_date: TOMORROW })] });
        const before = build(data, at(TODAY, 23, 59));
        const after = build(data, at('2026-11-03', 0, 1));
        expect(before.day).toBe(TODAY);
        expect(after.day).toBe(TOMORROW);
        expect(before.items.map(i => i.id)).toEqual(['t']);
        expect(after.items.map(i => i.id).sort()).toEqual(['n', 't']); // t is now overdue and carries over
    });
    it('streak_matches_shared_rule', () => {
        const data = cloud({ habits: [habit('h')], completions: [done('h', '2026-10-31'), done('h', '2026-11-01'), done('h', TODAY)] });
        const history = { '2026-10-31': ['h'], '2026-11-01': ['h'], [TODAY]: ['h'] };
        const expected = streakFrom(data.habits.map(rowToHabit), data.tasks.map(rowToTask), history, {}, TODAY).streak;
        expect(expected).toBe(3);
        expect(build(data, at(TODAY)).streak).toBe(expected);
    });
    it('goals_sorted_by_progress_and_counted', () => {
        const data = cloud({
            habits: [habit('g-low', { is_goal: 1, name: 'Low', start_date: '2026-11-01', target_date: '2026-11-05' }), habit('g-high', { is_goal: 1, name: 'High', start_date: '2026-11-01', target_date: '2026-11-05' }), habit('h1', { goal_id: 'g-high' }), habit('h2', { goal_id: 'g-low' })],
            completions: [done('h1', '2026-11-01'), done('h1', TODAY)],
        });
        const today = build(data, at(TODAY));
        expect(today.goals.map(g => g.id)).toEqual(['g-high', 'g-low']);
        expect(today.goals[0].percent).toBeGreaterThan(today.goals[1].percent);
        expect(today.goalsTotal).toBe(2);
        expect(today.goalsDone).toBe(today.goals.filter(g => g.percent === 100).length);
    });
    it('done_time_uses_created_at_on_the_same_day_only', () => {
        const base = { habits: [habit('h')] };
        const end = (c: CompletionRow) => build(cloud({ ...base, completions: [c] }), at(TODAY, 12)).items[0].end;
        // 07:00 start, 30 min long; ticked 07:10 ends at 07:10, a later updated_at does not move it.
        expect(end(done('h', TODAY, { created_at: `${TODAY}T07:10:00`, updated_at: `${TODAY}T07:25:00` }))).toBe(430);
        expect(end(done('h', TODAY, { created_at: '2026-11-01T07:10:00', updated_at: `${TODAY}T07:10:00` }))).toBe(450);
    });
    it('skipped_completion_is_marked_and_not_counted', () => {
        const data = cloud({ habits: [habit('a'), habit('b')], completions: [done('a', TODAY, { skipped: 1 })] });
        const today = build(data, at(TODAY));
        const a = today.items.find(i => i.id === 'a');
        expect(a).toMatchObject({ skipped: true, done: false });
        expect(today.total).toBe(1);
    });
    it('goals_done_counts_goals_at_100', () => {
        const goal = (id: string) => habit(id, { is_goal: 1, start_date: '2026-11-01', target_date: '2026-11-02' });
        const data = cloud({
            habits: [goal('won'), goal('open'), habit('h1', { goal_id: 'won' }), habit('h2', { goal_id: 'open' })],
            completions: [done('h1', '2026-11-01'), done('h1', TODAY), done('h2', TODAY)],
        });
        const today = build(data, at(TODAY));
        expect(today.goals.find(g => g.id === 'won')?.percent).toBe(100);
        expect(today.goalsDone).toBe(1);
        expect(today.goalsTotal).toBe(2);
    });
    it('signed_out_gives_empty_model', () => {
        const data = cloud({ habits: [habit('h')], completions: [done('h', TODAY)] });
        const today = build(data, at(TODAY), false);
        expect(today).toMatchObject({ items: [], streak: 0, goals: [], signedIn: false });
        expect(build(null, at(TODAY)).signedIn).toBe(false);
    });
    it('deleted_and_archived_are_ignored', () => {
        const data = cloud({
            habits: [habit('gone', { deleted: 1 }), habit('old', { is_archived: 1 }), habit('g', { is_goal: 1 }), habit('ok')],
            tasks: [task('dead', { due_date: TODAY, deleted: 1 }), task('live', { due_date: TODAY })],
            completions: [done('ok', TODAY, { deleted: 1 })],
        });
        const today = build(data, at(TODAY));
        expect(today.items.map(i => i.id).sort()).toEqual(['live', 'ok']);
        expect(today.items.find(i => i.id === 'ok')?.done).toBe(false);
        expect(today.goals.map(g => g.id)).toEqual(['g']);
    });
});
