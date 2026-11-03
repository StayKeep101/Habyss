// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CloudData, Interval, Snapshot } from '../types';
import { rangeBounds } from './stats';

const calls: [string, Record<string, unknown> | undefined][] = [];
let handlers: Record<string, (args?: Record<string, unknown>) => unknown> = {};
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: (cmd: string, args?: Record<string, unknown>) => { calls.push([cmd, args]); const h = handlers[cmd]; try { return Promise.resolve(h ? h(args) : undefined); } catch (e) { return Promise.reject(e); } },
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: () => Promise.resolve(() => {}) }));
import { Dashboard } from './Dashboard';

const NOW = new Date('2026-11-02T20:04:00');
const SIGNED_IN = { state: 'idle', email: 'a@b.c', last_sync: null, pending: 0, refused: 0, error: null };
const SIGNED_OUT = { ...SIGNED_IN, state: 'signed_out', email: null };
const EMPTY: CloudData = { habits: [], completions: [], tasks: [], milestones: [] };
const iv = (name: string, category: string, startMin: number, mins: number): Interval => { const start = NOW.getTime() - startMin * 60000; return { id: `${name}-${start}`, application_id: null, bundle_id: name, name, title: null, start, end: start + mins * 60000, state: 'active', category, availability: 'available', pid: 1, window_id: null }; };
const snap = (over: Partial<Snapshot> = {}): Snapshot => ({ settings: { tracking_enabled: true } as Snapshot['settings'], intervals: [], applications: [], focus: [], trusted: true, current_app: null, current_since: null, state: 'active', error: null, widget_available: false, database_path: '', version: '', classifications: {}, ...over });
const cached = (value: unknown) => ({ value, fetched_at: NOW.toISOString(), stale: false });
const wire = (over: Record<string, (args?: Record<string, unknown>) => unknown> = {}) => {
  handlers = { cloud_data: () => structuredClone(EMPTY), cloud_status: () => SIGNED_IN, snapshot: () => snap(), cloud_rpc: () => cached([{ display_name: 'Erwan', username: 'erwan' }]), ...over };
};
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
});
