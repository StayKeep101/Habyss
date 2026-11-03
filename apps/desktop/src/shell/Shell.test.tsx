// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act as rtlAct, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Snapshot } from '../types';

let navigate: ((e: { payload: string }) => void) | undefined;
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: (cmd: string) => Promise.resolve(cmd === 'cloud_data' ? { habits: [], completions: [], tasks: [], milestones: [] } : cmd === 'cloud_status' ? { state: 'signed_out', email: null, last_sync: null, pending: 0, refused: 0, error: null } : undefined),
}));
vi.mock('@tauri-apps/api/event', () => ({
  listen: (name: string, cb: (e: { payload: string }) => void) => { if (name === 'navigate') navigate = cb; return Promise.resolve(() => {}); },
}));
import { Shell } from './Shell';

const NOW = new Date('2026-11-02T20:04:00').getTime();
const data = (): Snapshot => ({ settings: { tracking_enabled: true, onboarding_complete: true, idle_threshold: 120, collect_titles: false, excluded_apps: [], excluded_title_patterns: [], start_minimized: false, appearance: 'dark', retention_days: 90, menu_bar_timer: false, menu_bar_task: false }, intervals: [], applications: [], focus: [], trusted: true, current_app: null, current_since: null, state: 'active', error: null, widget_available: false, database_path: '', version: '0.1.0', classifications: {} });
const mount = () => render(<Shell data={data()} act={() => Promise.resolve()} date="2026-11-02" setDate={() => {}} now={NOW} />);
const TABS = ['Dashboard', 'Calendar', 'Progress', 'Analytics', 'Friends', 'Profile', 'Settings'];
const selected = () => screen.getByRole('navigation').querySelector('[aria-current="page"]')?.textContent;

beforeEach(() => { navigate = undefined; try { localStorage.clear(); } catch { /* unavailable */ } });
afterEach(cleanup);

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
    fireEvent.click(await screen.findByRole('button', { name: 'Collapse panel' }));
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
});
