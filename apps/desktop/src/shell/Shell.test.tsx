// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act as rtlAct, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CloudData, HabitRow, Snapshot, SyncStatus, TaskRow } from '../types';
import { buildToday } from '../today/today';

let navigate: ((e: { payload: string }) => void) | undefined;
const SIGNED_OUT: SyncStatus = { state: 'signed_out', account: false, email: null, last_sync: null, pending: 0, refused: 0, error: null };
const SIGNED_IN: SyncStatus = { ...SIGNED_OUT, state: 'idle', account: true, email: 'a@b.c' };
const EMPTY: CloudData = { habits: [], completions: [], tasks: [], milestones: [], day_inputs: {} };
const calls: [string, Record<string, unknown> | undefined][] = [];
let handlers: Record<string, (args?: Record<string, unknown>) => unknown> = {};
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: (cmd: string, args?: Record<string, unknown>) => { calls.push([cmd, args]); const h = handlers[cmd]; return Promise.resolve(h ? h(args) : undefined); },
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: (name: string, cb: (e: { payload: string }) => void) => { if (name === 'navigate') navigate = cb; return Promise.resolve(() => {}); },
}));
import { Shell } from './Shell';

const NOW = new Date('2026-11-02T20:04:00').getTime();
const data = (): Snapshot => ({ settings: { tracking_enabled: true, onboarding_complete: true, idle_threshold: 120, collect_titles: false, excluded_apps: [], excluded_title_patterns: [], start_minimized: false, appearance: 'dark', retention_days: 90, menu_bar_timer: false, menu_bar_task: false }, intervals: [], applications: [], focus: [], trusted: true, current_app: null, current_since: null, state: 'active', error: null, widget_available: false, database_path: '', version: '0.1.0', classifications: {} });
const wire = (status: SyncStatus | null, cloud: CloudData = EMPTY, over: typeof handlers = {}) => {
  handlers = { cloud_data: () => structuredClone(cloud), cloud_status: () => (status === null ? new Promise(() => {}) : status), ...over };
};
const mount = () => render(<Shell data={data()} act={() => Promise.resolve()} date="2026-11-02" setDate={() => {}} now={NOW} />);
const habit = (id: string): HabitRow => ({ id, user_id: null, name: id, description: null, category: null, icon: null, is_goal: 0, target_date: null, goal_id: null, task_days: null, reminders: null, start_date: '2026-01-01', end_date: null, duration_minutes: null, start_time: null, end_time: null, type: null, color: null, goal_period: null, goal_value: null, unit: null, chart_type: null, is_archived: 0, show_memo: null, frequency: null, week_interval: null, time_of_day: null, graph_style: null, tracking_method: null, reminder_offset: null, reminder_message: null, recurrence: null, location_reminders: null, health_kit_target: null, health_kit_metric: null, ringtone: null, goal_spec: null, priority: null, difficulty: null, flexible: null, created_at: '2026-01-01T00:00:00', updated_at: null, deleted: 0, synced: 1, owner_id: null, refused: 0 });
const task = (id: string, over: Partial<TaskRow> = {}): TaskRow => ({ id, user_id: null, title: id, description: null, due_date: '2026-11-02', due_time: null, estimated_minutes: null, priority: null, goal_id: null, status: 'open', completed_at: null, source: null, external_id: null, measure: null, target: null, unit: null, amount: null, milestone_id: null, subtasks: null, deadline: null, section: null, difficulty: null, flexible: null, created_at: '2026-01-01T00:00:00', updated_at: null, deleted: 0, synced: 1, owner_id: null, refused: 0, ...over });
/** A plan where the old definitions disagreed: an overdue and an undated task, a habit, and one task done today. */
const PLAN: CloudData = { habits: [habit('Read')], completions: [], milestones: [], day_inputs: {}, tasks: [task('Ship'), task('Overdue', { due_date: '2026-10-30' }), task('Undated', { due_date: null }), task('Done', { status: 'done', completed_at: '2026-11-02T09:00:00' })] };
const panelTasks = () => screen.getByText('Tasks', { selector: '.tp-stat small' }).previousElementSibling?.textContent;
const dashTasks = () => screen.getByText('Tasks', { selector: '.ui-stat-label' }).closest('.ui-stat')?.querySelector('.ui-stat-value')?.textContent;
const TABS = ['Dashboard', 'Calendar', 'Progress', 'Analytics', 'Friends', 'Profile', 'Settings'];
const selected = () => screen.getByRole('navigation').querySelector('[aria-current="page"]')?.textContent;

beforeEach(() => { navigate = undefined; calls.length = 0; wire(SIGNED_OUT); vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); try { localStorage.clear(); } catch { /* unavailable */ } });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Shell', () => {
  it('sidebar_lists_seven_tabs_in_order', () => {
    mount();
    expect(Array.from(screen.getByRole('navigation').querySelectorAll('button')).map(b => b.textContent)).toEqual(TABS);
    expect(selected()).toBe('Dashboard');
  });

  it('clicking_tab_switches_screen', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Friends' }));
    expect(selected()).toBe('Friends');
    expect(screen.getByText(/arrive here soon/)).toBeTruthy();
  });

  it('cmd_number_switches_tab', () => {
    mount();
    fireEvent.keyDown(window, { key: '4', metaKey: true });
    expect(selected()).toBe('Analytics');
    fireEvent.keyDown(window, { key: '7', metaKey: true });
    expect(selected()).toBe('Settings');
    fireEvent.keyDown(window, { key: '2', metaKey: true });
    expect(selected()).toBe('Calendar');
    fireEvent.keyDown(window, { key: ',', metaKey: true });
    expect(selected()).toBe('Settings');
  });

  it('navigate_event_maps_old_names', async () => {
    mount();
    await waitFor(() => expect(navigate).toBeTruthy());
    for (const [name, tab] of [['Timeline', 'Calendar'], ['Focus', 'Dashboard'], ['Settings', 'Settings'], ['Friends', 'Friends'], ['Bogus', 'Friends']]) {
      rtlAct(() => navigate?.({ payload: name }));
      expect(selected()).toBe(tab);
    }
  });

  it('right_panel_collapses_and_remembers', async () => {
    const first = mount();
    const wrapper = () => document.querySelector('.app-right');
    expect(wrapper()?.querySelector('.tp-window')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Collapse panel' }));
    expect(wrapper()?.querySelector('.tp-collapsed')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Expand panel' })).toBeTruthy();
    first.unmount();
    mount();
    expect(await screen.findByRole('button', { name: 'Expand panel' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Expand panel' }));
    expect(await screen.findByRole('button', { name: 'Collapse panel' })).toBeTruthy();
  });

  it('signed_out_shell_still_shows_activity', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(screen.getByText('Your activity, in sequence')).toBeTruthy();
  });

  it('shortcuts_ignored_while_typing', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Calendar' }));
    const input = screen.getByLabelText('Selected date');
    input.focus();
    fireEvent.keyDown(input, { key: '3', metaKey: true });
    expect(selected()).toBe('Calendar');
    fireEvent.keyDown(document.body, { key: '3', metaKey: true });
    expect(selected()).toBe('Progress');
  });

  it('privacy_footer_reflects_sign_in', async () => {
    const out = mount();
    expect(await screen.findByText('Private by design. No accounts. No uploads.')).toBeTruthy();
    out.unmount();
    wire(SIGNED_IN);
    mount();
    expect(await screen.findByText('Activity stays on this Mac. Habits and tasks sync with your Habyss account.')).toBeTruthy();
  });

  it('privacy_footer_waits_for_the_status', async () => {
    wire(null);
    mount();
    await waitFor(() => expect(calls.some(c => c[0] === 'cloud_data')).toBe(true));
    expect(document.querySelector('.app-privacy')).toBeNull();
  });

  it('shell_shares_one_cloud_read', async () => {
    wire(SIGNED_IN, PLAN);
    mount();
    await waitFor(() => expect(dashTasks()).not.toBe('–'));
    expect(calls.filter(c => c[0] === 'cloud_data')).toHaveLength(1);
    expect(calls.filter(c => c[0] === 'cloud_status')).toHaveLength(1);
  });

  it('panel_and_dashboard_show_the_same_tasks', async () => {
    wire(SIGNED_IN, PLAN);
    mount();
    const today = buildToday(PLAN, { now: new Date(NOW), signedIn: true });
    const expected = `${today.tasksDone}/${today.tasksTotal}`;
    expect(expected).toBe('1/4');
    await waitFor(() => expect(dashTasks()).toBe(expected));
    expect(panelTasks()).toBe(expected);
    // The header counts the rows it lists.
    expect(screen.getByText(/Due Today/).textContent).toContain(`${today.listedDone}/${today.listedTotal}`);
  });

  it('a_tick_in_the_panel_updates_the_dashboard', async () => {
    let release!: () => void;
    wire(SIGNED_IN, PLAN, { cloud_set_task_done: () => new Promise<void>(r => { release = r; }) });
    mount();
    await waitFor(() => expect(dashTasks()).toBe('1/4'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark Ship done' }));
    // Before the command resolves: one shared copy, so the Dashboard moves with the panel.
    await waitFor(() => expect(dashTasks()).toBe('2/4'));
    expect(screen.getByText(/Due Today/).textContent).toContain('2/5');
    expect(panelTasks()).toBe('2/4');
    release();
  });
});
