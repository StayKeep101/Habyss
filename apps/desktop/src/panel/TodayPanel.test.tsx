// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CloudData, CompletionRow, HabitRow, Snapshot, TaskRow } from '../types';
import { buildToday } from '../today/today';

const calls: [string, Record<string, unknown> | undefined][] = [];
let handlers: Record<string, (args?: Record<string, unknown>) => unknown> = {};
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: (cmd: string, args?: Record<string, unknown>) => { calls.push([cmd, args]); const h = handlers[cmd]; return Promise.resolve(h ? h(args) : undefined); },
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: () => Promise.resolve(() => {}) }));
import { TodayPanel } from './TodayPanel';

const NOW = new Date('2026-11-02T07:30:00');
const TODAY = '2026-11-02';
const habit = (id: string, over: Partial<HabitRow> = {}): HabitRow => ({ id, user_id: null, name: id, description: null, category: null, icon: null, is_goal: 0, target_date: null, goal_id: null, task_days: null, reminders: null, start_date: '2026-01-01', end_date: null, duration_minutes: null, start_time: null, end_time: null, type: null, color: null, goal_period: null, goal_value: null, unit: null, chart_type: null, is_archived: 0, show_memo: null, frequency: null, week_interval: null, time_of_day: null, graph_style: null, tracking_method: null, reminder_offset: null, reminder_message: null, recurrence: null, location_reminders: null, health_kit_target: null, health_kit_metric: null, ringtone: null, goal_spec: null, priority: null, difficulty: null, flexible: null, created_at: '2026-01-01T00:00:00', updated_at: null, deleted: 0, synced: 1, owner_id: null, refused: 0, ...over });
const task = (id: string, over: Partial<TaskRow> = {}): TaskRow => ({ id, user_id: null, title: id, description: null, due_date: null, due_time: null, estimated_minutes: null, priority: null, goal_id: null, status: 'open', completed_at: null, source: null, external_id: null, measure: null, target: null, unit: null, amount: null, milestone_id: null, subtasks: null, deadline: null, section: null, difficulty: null, flexible: null, created_at: '2026-01-01T00:00:00', updated_at: null, deleted: 0, synced: 1, owner_id: null, refused: 0, ...over });
const completion = (habitId: string): CompletionRow => ({ id: `c-${habitId}`, user_id: null, habit_id: habitId, date: TODAY, value: 1, memo: null, created_at: `${TODAY}T09:00:00`, updated_at: null, evidence: null, skipped: 0, deleted: 0, synced: 1, owner_id: null, refused: 0 });
const cloud: CloudData = { habits: [habit('Workout'), habit('Read')], completions: [completion('Read')], tasks: [task('Deep Work', { due_date: TODAY })], milestones: [] };
const snap = (over: Partial<Snapshot> = {}): Snapshot => ({ settings: {} as Snapshot['settings'], intervals: [], applications: [], focus: [], trusted: true, current_app: null, current_since: null, state: 'active', error: null, widget_available: false, database_path: '', version: '', classifications: {}, ...over });
const wire = (over: Record<string, (args?: Record<string, unknown>) => unknown> = {}) => {
  handlers = { cloud_data: () => structuredClone(cloud), cloud_status: () => ({ state: 'idle', email: 'a@b.c', last_sync: null, pending: 0, refused: 0, error: null }), snapshot: () => snap(), ...over };
};
const called = (cmd: string) => calls.filter(c => c[0] === cmd);

beforeEach(() => { calls.length = 0; vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); wire(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('TodayPanel', () => {
  it('shows_due_count_and_rows', async () => {
    render(<TodayPanel mode="menubar" />);
    expect(await screen.findByRole('button', { name: 'Mark Deep Work done' })).toBeTruthy();
    expect(screen.getByText('Workout')).toBeTruthy();
    expect(screen.getByText('Read')).toBeTruthy();
    expect(screen.getByText(/Due Today/).textContent).toContain('1/3');
  });

  it('ticking_a_habit_calls_set_completion_and_strikes_it', async () => {
    let release!: () => void;
    wire({ cloud_set_completion: () => new Promise<void>(r => { release = r; }) });
    render(<TodayPanel mode="menubar" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Workout done' }));
    // Optimistic: struck through before the command resolves.
    await waitFor(() => expect(screen.getByText('Workout').closest('li')?.className).toContain('done'));
    expect(called('cloud_set_completion')[0][1]).toMatchObject({ habitId: 'Workout', date: TODAY, value: 1, skipped: false });
    release();
  });

  it('unticking_sends_null_value', async () => {
    render(<TodayPanel mode="menubar" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Read not done' }));
    await waitFor(() => expect(called('cloud_set_completion')).toHaveLength(1));
    expect(called('cloud_set_completion')[0][1]).toMatchObject({ habitId: 'Read', date: TODAY, value: null });
    await waitFor(() => expect(screen.getByText('Read').closest('li')?.className).not.toContain('done'));
  });

  it('task_tick_calls_set_task_done', async () => {
    render(<TodayPanel mode="menubar" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Deep Work done' }));
    await waitFor(() => expect(called('cloud_set_task_done')).toHaveLength(1));
    expect(called('cloud_set_task_done')[0][1]).toEqual({ id: 'Deep Work', done: true });
  });

  it('focus_switch_starts_with_current_item', async () => {
    const today = buildToday(cloud, { now: NOW, signedIn: true });
    const current = today.current;
    expect(current).not.toBeNull();
    render(<TodayPanel mode="menubar" />);
    await screen.findByRole('button', { name: 'Mark Deep Work done' });
    fireEvent.click(screen.getByRole('switch', { name: 'Focus Mode' }));
    await waitFor(() => expect(called('start_focus')).toHaveLength(1));
    expect(called('start_focus')[0][1]).toEqual({ label: current!.title, minutes: 25, itemId: current!.id, itemKind: current!.kind });
  });

  it('focus_switch_off_stops', async () => {
    const running = { id: 'f', label: 'Focus', start: NOW.getTime() - 60000, end: null, target_ms: 1500000, state: 'running', paused_ms: 0, paused_at: null, item_id: null, item_kind: null };
    wire({ snapshot: () => snap({ focus: [running] }) });
    render(<TodayPanel mode="menubar" />);
    const sw = await screen.findByRole('switch', { name: 'Focus Mode' });
    await waitFor(() => expect(sw.getAttribute('aria-checked')).toBe('true'));
    fireEvent.click(sw);
    await waitFor(() => expect(called('stop_focus')).toHaveLength(1));
  });

  it('plus_adds_task_due_today', async () => {
    wire({ cloud_save: () => 'new-id' });
    render(<TodayPanel mode="menubar" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add task' }));
    const input = screen.getByRole('textbox', { name: 'New task' });
    fireEvent.change(input, { target: { value: 'Call bank' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(called('cloud_save')).toHaveLength(1));
    expect(called('cloud_save')[0][1]).toEqual({ table: 'tasks', row: { title: 'Call bank', due_date: TODAY, status: 'open' } });
  });

  it('signed_out_shows_prompt_but_glance_still_renders', async () => {
    wire({ cloud_status: () => ({ state: 'signed_out', email: null, last_sync: null, pending: 0, refused: 0, error: null }), cloud_data: () => ({ habits: [], completions: [], tasks: [], milestones: [] }), snapshot: () => snap({ intervals: [{ start: NOW.getTime() - 3600000, end: NOW.getTime(), state: 'active', name: 'Code', bundle_id: 'x', category: 'development' } as never] }) });
    render(<TodayPanel mode="menubar" />);
    expect((await screen.findAllByText('Sign in to see your habits and tasks')).length).toBeGreaterThan(0);
    expect(screen.getByText('Today at a Glance')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Screen Time').previousElementSibling?.textContent).toBe('1h 0m'));
    expect(screen.getByRole('switch', { name: 'Focus Mode' })).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Open Settings' })[0]);
    expect(called('open_dashboard')[0][1]).toEqual({ screen: 'Settings' });
  });

  it('productive_shows_dash_without_classified_time', async () => {
    const hour = { start: NOW.getTime() - 3600000, end: NOW.getTime(), state: 'active', name: 'Code', bundle_id: 'x', category: 'development' } as never;
    wire({ snapshot: () => snap({ intervals: [hour] }) });
    render(<TodayPanel mode="menubar" />);
    await waitFor(() => expect(screen.getByText('Screen Time').previousElementSibling?.textContent).toBe('1h 0m'));
    expect(screen.getByText('Productive').previousElementSibling?.textContent).toBe('–');
    cleanup();
    wire({ snapshot: () => snap({ intervals: [hour], classifications: { development: 'productive' } }) });
    render(<TodayPanel mode="menubar" />);
    await waitFor(() => expect(screen.getByText('Productive').previousElementSibling?.textContent).toBe('100%'));
  });
  it('failed_tick_reverts_and_shows_the_error', async () => {
    wire({ cloud_set_completion: () => { throw new Error('offline'); } });
    render(<TodayPanel mode="menubar" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark Workout done' }));
    expect((await screen.findByRole('alert')).textContent).toContain('offline');
    await waitFor(() => expect(screen.getByText('Workout').closest('li')?.className).not.toContain('done'));
    expect(called('cloud_data').length).toBeGreaterThan(1);
  });

  it('failed_add_keeps_the_draft_open', async () => {
    wire({ cloud_save: () => { throw new Error('nope'); } });
    render(<TodayPanel mode="menubar" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add task' }));
    const input = screen.getByRole('textbox', { name: 'New task' }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Call bank' } });
    fireEvent.submit(input.closest('form')!);
    expect((await screen.findByRole('alert')).textContent).toContain('nope');
    expect((screen.getByRole('textbox', { name: 'New task' }) as HTMLInputElement).value).toBe('Call bank');
  });

  it('signed_out_hides_a_cloud_data_error', async () => {
    wire({ cloud_status: () => ({ state: 'signed_out', email: null, last_sync: null, pending: 0, refused: 0, error: null }), cloud_data: () => { throw new Error('boom'); } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<TodayPanel mode="menubar" />);
    expect((await screen.findAllByText('Sign in to see your habits and tasks')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/boom/)).toBeNull();
  });
});
