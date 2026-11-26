// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CloudData, CompletionRow, FocusSession, HabitRow, Interval, Snapshot, TaskRow } from '../types';
import { rangeBounds } from './stats';

const calls: [string, Record<string, unknown> | undefined][] = [];
let handlers: Record<string, (args?: Record<string, unknown>) => unknown> = {};
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: (cmd: string, args?: Record<string, unknown>) => { calls.push([cmd, args]); const h = handlers[cmd]; try { return Promise.resolve(h ? h(args) : undefined); } catch (e) { return Promise.reject(e); } },
}));
const listeners: Record<string, () => void> = {};
vi.mock('@tauri-apps/api/event', () => ({ listen: (name: string, cb: () => void) => { listeners[name] = cb; return Promise.resolve(() => {}); } }));
import { Dashboard } from './Dashboard';

const NOW = new Date('2026-11-02T20:04:00');
const SIGNED_IN = { state: 'idle', account: true, email: 'a@b.c', last_sync: null, pending: 0, refused: 0, error: null };
const SIGNED_OUT = { ...SIGNED_IN, state: 'signed_out', account: false, email: null };
const EMPTY: CloudData = { habits: [], completions: [], tasks: [], milestones: [] };
const iv = (name: string, category: string, startMin: number, mins: number): Interval => { const start = NOW.getTime() - startMin * 60000; return { id: `${name}-${start}`, application_id: null, bundle_id: name, name, title: null, start, end: start + mins * 60000, state: 'active', category, availability: 'available', pid: 1, window_id: null, url: null, domain: null, document: null, typing_ms: 0, pointer_ms: 0, meeting_ms: 0, media_ms: 0 }; };
const snap = (over: Partial<Snapshot> = {}): Snapshot => ({ settings: { tracking_enabled: true } as Snapshot['settings'], intervals: [], applications: [], focus: [], trusted: true, current_app: null, current_since: null, state: 'active', error: null, widget_available: false, database_path: '', version: '', classifications: {}, ...over });
const cached = (value: unknown) => ({ value, fetched_at: NOW.toISOString(), stale: false });
const wire = (over: Record<string, (args?: Record<string, unknown>) => unknown> = {}) => {
  handlers = { cloud_data: () => structuredClone(EMPTY), cloud_status: () => SIGNED_IN, snapshot: () => snap(), cloud_rpc: () => cached([{ display_name: 'Erwan', username: 'erwan' }]), ...over };
};
const habit = (id: string, over: Partial<HabitRow> = {}): HabitRow => ({ id, user_id: null, name: id, description: null, category: null, icon: null, is_goal: 0, target_date: null, goal_id: null, task_days: null, reminders: null, start_date: '2026-01-01', end_date: null, duration_minutes: null, start_time: null, end_time: null, type: null, color: null, goal_period: null, goal_value: null, unit: null, chart_type: null, is_archived: 0, show_memo: null, frequency: null, week_interval: null, time_of_day: null, graph_style: null, tracking_method: null, reminder_offset: null, reminder_message: null, recurrence: null, location_reminders: null, health_kit_target: null, health_kit_metric: null, ringtone: null, goal_spec: null, priority: null, difficulty: null, flexible: null, created_at: '2026-01-01T00:00:00', updated_at: null, deleted: 0, synced: 1, owner_id: null, refused: 0, ...over });
const task = (id: string, over: Partial<TaskRow> = {}): TaskRow => ({ id, user_id: null, title: id, description: null, due_date: '2026-11-02', due_time: null, estimated_minutes: null, priority: null, goal_id: null, status: 'open', completed_at: null, source: null, external_id: null, measure: null, target: null, unit: null, amount: null, milestone_id: null, subtasks: null, deadline: null, section: null, difficulty: null, flexible: null, created_at: '2026-01-01T00:00:00', updated_at: null, deleted: 0, synced: 1, owner_id: null, refused: 0, ...over });
const completion = (habitId: string): CompletionRow => ({ id: `c-${habitId}`, user_id: null, habit_id: habitId, date: '2026-11-02', value: 1, memo: null, created_at: '2026-11-02T09:00:00', updated_at: null, evidence: null, skipped: 0, deleted: 0, synced: 1, owner_id: null, refused: 0 });
const PLAN: CloudData = { habits: [habit('Read')], completions: [], tasks: [task('Ship')], milestones: [] };
const session = (itemId: string | null, itemKind: string | null): FocusSession => ({ id: 'f', label: itemId ?? 'Focus', start: NOW.getTime() - 60000, end: null, target_ms: 1500000, state: 'running', paused_ms: 0, paused_at: null, item_id: itemId, item_kind: itemKind });
const withPlan = (plan: CloudData, focus: FocusSession[] = [], over: Record<string, (args?: Record<string, unknown>) => unknown> = {}) => wire({ cloud_data: () => structuredClone(plan), snapshot: () => snap({ focus }), ...over });
const order = (cmd: string) => calls.findIndex(c => c[0] === cmd);
const called = (cmd: string) => calls.filter(c => c[0] === cmd);
const tile = (label: string) => screen.getByText(label, { selector: '.ui-stat-label' }).closest('.ui-stat')?.querySelector('.ui-stat-value')?.textContent;

beforeEach(() => { calls.length = 0; vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); wire(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Dashboard', () => {
  it('greets_by_display_name', async () => {
    const first = render(<Dashboard />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Good Evening, Erwan.' })).toBeTruthy();
    expect(called('cloud_rpc')[0][1]).toEqual({ name: 'profile', args: {} });
    expect(screen.getByText('DASHBOARD')).toBeTruthy();
    expect(screen.getByText('Discipline compounds. So does freedom.')).toBeTruthy();
    first.unmount();
    // The profile can also come back as a single row; the username stands in for a missing display name.
    wire({ cloud_rpc: () => cached({ display_name: '  ', username: 'erwan' }) });
    render(<Dashboard />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Good Evening, erwan.' })).toBeTruthy();
  });

  it('greeting_without_name_has_no_comma', async () => {
    wire({ cloud_rpc: () => { throw new Error('offline'); } });
    const first = render(<Dashboard />);
    await waitFor(() => expect(called('cloud_rpc')).toHaveLength(1));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Good Evening.');
    first.unmount();
    wire({ cloud_rpc: () => cached([]) });
    render(<Dashboard />);
    await waitFor(() => expect(called('cloud_rpc')).toHaveLength(2));
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Good Evening.');
  });

  it('range_switch_requeries_snapshot_with_bounds', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(called('snapshot')).toHaveLength(1));
    const [todayFrom, end] = rangeBounds('Today', NOW);
    expect(called('snapshot')[0][1]).toEqual({ from: todayFrom, to: end });
    fireEvent.click(screen.getByRole('tab', { name: 'Week' }));
    await waitFor(() => expect(called('snapshot')).toHaveLength(2));
    const [weekFrom] = rangeBounds('Week', NOW);
    expect(called('snapshot')[1][1]).toEqual({ from: weekFrom, to: end });
    fireEvent.click(screen.getByRole('tab', { name: 'Year' }));
    await waitFor(() => expect(called('snapshot')).toHaveLength(3));
    expect(called('snapshot')[2][1]).toEqual({ from: new Date(2026, 0, 1).getTime(), to: end });
  });

  it('signed_out_shows_dash_tiles_and_prompt', async () => {
    wire({ cloud_status: () => SIGNED_OUT, snapshot: () => snap({ intervals: [iv('VS Code', 'development', 60, 30)], classifications: { development: 'productive' } }) });
    render(<Dashboard />);
    expect(await screen.findByText('VS Code')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByText(/^Sign in to see/)).toHaveLength(2));
    expect(tile('Goals')).toBe('–');
    expect(tile('Tasks')).toBe('–');
    expect(tile('Day Streak')).toBe('–');
    // Activity still works without an account.
    expect(tile('Productive')).toBe('100%');
    expect(tile('Focus Time')).toBe('0m');
    expect(screen.getByText('Productive', { selector: '.ui-tag' })).toBeTruthy();
    expect(screen.getByText('Total Tracked')).toBeTruthy();
    expect(called('cloud_rpc')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Good Evening.');
  });

  it('syncing_without_an_account_shows_the_prompt_and_dashes', async () => {
    withPlan(PLAN, [], { cloud_status: () => ({ ...SIGNED_OUT, state: 'syncing' }) });
    render(<Dashboard />);
    await waitFor(() => expect(screen.getAllByText(/^Sign in to see/)).toHaveLength(2));
    expect(tile('Tasks')).toBe('–');
    expect(tile('Day Streak')).toBe('–');
  });

  it('signed_out_at_launch_with_an_account_shows_the_plan', async () => {
    withPlan(PLAN, [], { cloud_status: () => ({ ...SIGNED_IN, state: 'signed_out' }) });
    render(<Dashboard />);
    await waitFor(() => expect(tile('Tasks')).toBe('0/1'));
    expect(screen.queryByText(/^Sign in to see/)).toBeNull();
  });

  it('no_status_yet_shows_neither_prompt_nor_numbers', async () => {
    withPlan(PLAN, [], { cloud_status: () => new Promise(() => {}) });
    render(<Dashboard />);
    await waitFor(() => expect(called('cloud_data')).toHaveLength(1));
    expect(screen.getAllByText('Loading…').length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Sign in to see/)).toBeNull();
    expect([tile('Tasks'), tile('Goals'), tile('Day Streak')]).toEqual(['–', '–', '–']);
  });

  it('tasks_tile_today_counts_listed_tasks_and_wider_ranges_count_due_tasks', async () => {
    // Overdue and undated tasks are listed today (Ruling P2), so the Today tile counts them, as the panel does (Ruling P6).
    withPlan({ ...PLAN, tasks: [task('Ship'), task('Overdue', { due_date: '2026-10-30' }), task('Undated', { due_date: null })] });
    render(<Dashboard />);
    await waitFor(() => expect(tile('Tasks')).toBe('0/3'));
    fireEvent.click(screen.getByRole('tab', { name: 'Week' }));
    await waitFor(() => expect(tile('Tasks')).toBe('0/1'));
  });

  it('focus_clock_rounds_remaining_time_up_like_the_menu_bar', async () => {
    withPlan(PLAN, [{ ...session('Ship', 'task'), start: NOW.getTime() - 1 }]);
    render(<Dashboard />);
    expect(await screen.findByText('25:00')).toBeTruthy();
  });

  it('idle_clock_shows_the_session_length', async () => {
    render(<Dashboard />);
    expect(await screen.findByText('25:00')).toBeTruthy();
  });

  it('finish_after_midnight_completes_on_the_new_day', async () => {
    withPlan(PLAN, [session('Read', 'habit')]);
    render(<Dashboard />);
    const finish = await screen.findByRole('button', { name: 'Finish focus' });
    vi.setSystemTime(new Date('2026-11-03T00:00:10'));
    fireEvent.click(finish);
    await waitFor(() => expect(called('cloud_set_completion')).toHaveLength(1));
    expect(called('cloud_set_completion')[0][1]).toMatchObject({ habitId: 'Read', date: '2026-11-03' });
  });

  it('empty_day_shows_empty_states', async () => {
    render(<Dashboard />);
    expect(await screen.findByText('Nothing scheduled today.')).toBeTruthy();
    expect(screen.getByText('No goals yet.')).toBeTruthy();
    expect(screen.getByText('No tracked time yet.')).toBeTruthy();
    expect(screen.getByText('No app activity yet.')).toBeTruthy();
    expect(tile('Productive')).toBe('–');
    expect(tile('Goals')).toBe('0/0');
    expect(tile('Tasks')).toBe('0/0');
    expect(tile('Day Streak')).toBe('0');
    fireEvent.click(screen.getByRole('tab', { name: 'Activity' }));
    expect(screen.getByText('No activity recorded today.')).toBeTruthy();
  });

  it('signed_in_without_data_shows_dashes', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    wire({ cloud_data: () => { throw new Error('offline'); } });
    render(<Dashboard />);
    expect(await screen.findAllByText('Your plan could not be loaded.')).toHaveLength(2);
    expect(tile('Day Streak')).toBe('–');
    expect(tile('Goals')).toBe('–');
    expect(tile('Tasks')).toBe('–');
    expect(screen.queryByText('No goals yet.')).toBeNull();
    expect(quiet).toHaveBeenCalledWith('cloud_data failed', expect.any(Error));
    quiet.mockRestore();
  });

  it('finish_on_task_stops_then_marks_it_done', async () => {
    withPlan(PLAN, [session('Ship', 'task')]);
    render(<Dashboard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Finish focus' }));
    await waitFor(() => expect(called('cloud_set_task_done')).toHaveLength(1));
    expect(called('cloud_set_task_done')[0][1]).toEqual({ id: 'Ship', done: true });
    expect(order('stop_focus')).toBeLessThan(order('cloud_set_task_done'));
    expect(called('cloud_set_completion')).toHaveLength(0);
  });

  it('finish_on_habit_stops_then_completes_it', async () => {
    withPlan(PLAN, [session('Read', 'habit')]);
    render(<Dashboard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Finish focus' }));
    await waitFor(() => expect(called('cloud_set_completion')).toHaveLength(1));
    expect(called('cloud_set_completion')[0][1]).toEqual({ habitId: 'Read', date: '2026-11-02', value: 1, skipped: false, memo: null, evidence: null });
    expect(order('stop_focus')).toBeLessThan(order('cloud_set_completion'));
    expect(called('cloud_set_task_done')).toHaveLength(0);
  });

  it('finish_hidden_when_unlinked_mismatched_or_done', async () => {
    for (const [focus, plan] of [[session(null, null), PLAN], [session('Ship', 'habit'), PLAN], [session('Read', 'habit'), { ...PLAN, completions: [completion('Read')] }]] as [FocusSession, CloudData][]) {
      withPlan(plan, [focus]);
      render(<Dashboard />);
      expect(await screen.findByRole('button', { name: 'Stop focus' })).toBeTruthy();
      await waitFor(() => expect(screen.queryAllByText(/Ship|Read/).length).toBeGreaterThan(0));
      expect(screen.queryByRole('button', { name: 'Finish focus' })).toBeNull();
      cleanup();
    }
  });

  it('nothing_written_when_stop_fails', async () => {
    withPlan(PLAN, [session('Ship', 'task')], { stop_focus: () => { throw new Error('engine busy'); } });
    render(<Dashboard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Finish focus' }));
    expect((await screen.findByRole('alert')).textContent).toContain('engine busy');
    fireEvent.click(screen.getByRole('button', { name: 'Next item' }));
    await waitFor(() => expect(called('stop_focus')).toHaveLength(2));
    expect(called('cloud_set_task_done')).toHaveLength(0);
    expect(called('cloud_set_completion')).toHaveLength(0);
    expect(called('start_focus')).toHaveLength(0);
  });

  it('step_offered_only_when_signed_in_with_another_open_item', async () => {
    withPlan(PLAN, [], { cloud_status: () => SIGNED_OUT });
    const out = render(<Dashboard />);
    expect(await screen.findByRole('button', { name: 'Start focus' })).toBeTruthy();
    await waitFor(() => expect(called('cloud_status')).toHaveLength(1));
    expect(screen.queryByRole('button', { name: 'Next item' })).toBeNull();
    out.unmount();
    // One open item: nothing to step to.
    withPlan({ ...PLAN, tasks: [] });
    const one = render(<Dashboard />);
    await waitFor(() => expect(document.querySelector('.fc-label')?.textContent).toBe('Read'));
    expect(screen.queryByRole('button', { name: 'Next item' })).toBeNull();
    one.unmount();
    // Two open items, idle: next picks the other one, and play starts on it.
    withPlan(PLAN);
    render(<Dashboard />);
    const next = await screen.findByRole('button', { name: 'Next item' });
    const first = document.querySelector('.fc-label')?.textContent;
    fireEvent.click(next);
    const other = first === 'Ship' ? 'Read' : 'Ship';
    expect(document.querySelector('.fc-label')?.textContent).toBe(other);
    expect(called('start_focus')).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: 'Start focus' }));
    await waitFor(() => expect(called('start_focus')).toHaveLength(1));
    expect(called('start_focus')[0][1]).toEqual({ label: other, minutes: 25, itemId: other, itemKind: other === 'Ship' ? 'task' : 'habit' });
  });

  it('wide_ranges_requery_at_most_once_a_minute', async () => {
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
    render(<Dashboard />);
    await flush();
    expect(called('snapshot')).toHaveLength(1);
    // Today stays live.
    act(() => listeners['activity-updated']());
    await flush();
    expect(called('snapshot')).toHaveLength(2);
    fireEvent.click(screen.getByRole('tab', { name: 'Month' }));
    await flush();
    expect(called('snapshot')).toHaveLength(3);
    for (let n = 0; n < 5; n++) { act(() => listeners['activity-updated']()); await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); }
    expect(called('snapshot')).toHaveLength(3);
    await act(async () => { await vi.advanceTimersByTimeAsync(35000); });
    expect(called('snapshot')).toHaveLength(4);
    expect(called('snapshot')[3][1]).toEqual({ from: new Date(2026, 10, 1).getTime(), to: NOW.getTime() + 60000 });
  });
});
