// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { CloudData, HabitRow, Snapshot, TaskRow } from '../types';

const calls: [string, Record<string, unknown> | undefined][] = [];
let handlers: Record<string, (args?: Record<string, unknown>) => unknown> = {};
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: (cmd: string, args?: Record<string, unknown>) => { calls.push([cmd, args]); const h = handlers[cmd]; return Promise.resolve(h ? h(args) : undefined); },
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: () => Promise.resolve(() => {}) }));
import { MenuPanel } from './MenuPanel';

const NOW = new Date('2026-11-26T09:00:07');
const habit = (id: string, over: Partial<HabitRow> = {}): HabitRow => ({ id, user_id: null, name: id, start_date: '2026-01-01', created_at: '2026-01-01T00:00:00', is_archived: 0, deleted: 0, duration_minutes: 10, start_time: '09:00', flexible: 0, ...over } as HabitRow);
const task = (id: string, over: Partial<TaskRow> = {}): TaskRow => ({ id, user_id: null, title: id, due_date: '2026-11-26', status: 'open', priority: 2, estimated_minutes: 30, created_at: '2026-11-01T00:00:00', deleted: 0, ...over } as TaskRow);
const cloud: CloudData = { habits: [habit('Shower')], tasks: [task('Email prof', { due_date: '2026-11-25', status: 'done', completed_at: '2026-11-25T15:00:00' })], completions: [], day_inputs: { day_window: { wake: '08:00', sleep: '23:30' } } };
const snap = (): Snapshot => ({ settings: { collect_titles: true } as Snapshot['settings'], intervals: [], applications: [], focus: [], trusted: true, current_app: null, current_since: null, state: 'active', error: null, widget_available: false, database_path: '', version: '', classifications: {} });
const signedIn = { state: 'idle', account: true, email: 'a@b.c', last_sync: null, pending: 0, refused: 0, error: null };
const wire = (over: Record<string, (args?: Record<string, unknown>) => unknown> = {}) => { handlers = { cloud_data: () => structuredClone(cloud), cloud_status: () => signedIn, snapshot: snap, ...over }; };
const called = (cmd: string) => calls.filter(c => c[0] === cmd);

beforeEach(() => { calls.length = 0; vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); wire(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('MenuPanel', () => {
  it('shows what is on now, counting down like the Live Activity', async () => {
    render(<MenuPanel />);
    const card = await screen.findByRole('region', { name: 'Now' });
    await waitFor(() => expect(card.textContent).toContain('Shower'));
    expect(card.textContent).toContain('9:53');
  });

  it('checks the current habit off from the Now card', async () => {
    render(<MenuPanel />);
    const card = await screen.findByRole('region', { name: 'Now' });
    fireEvent.click(await within(card).findByRole('button', { name: 'Mark Shower done' }));
    await waitFor(() => expect(called('cloud_set_completion')).toHaveLength(1));
    expect(called('cloud_set_completion')[0][1]).toMatchObject({ habitId: 'Shower', date: '2026-11-26', value: 1 });
  });

  it('shows the waking window and the time left in it', async () => {
    render(<MenuPanel />);
    expect(await screen.findByText('08:00–23:30')).toBeTruthy();
    expect(screen.getByText('14 h 30 min left')).toBeTruthy();
  });

  it('signed out: asks to sign in on the planned side, and still shows tracking', async () => {
    wire({ cloud_status: () => ({ ...signedIn, state: 'signed_out', account: false }) });
    render(<MenuPanel />);
    expect(await screen.findByText(/Sign in to see your habits and tasks/)).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Tracked' })).toBeTruthy();
  });

  it('picking a day in the week shows that day', async () => {
    render(<MenuPanel />);
    const planned = await screen.findByRole('region', { name: 'Planned' });
    await waitFor(() => expect(planned.textContent).toContain('Shower'));
    expect(planned.textContent).not.toContain('Email prof');
    fireEvent.click(screen.getByRole('button', { name: /Wednesday, November 25/ }));
    await waitFor(() => expect(planned.textContent).toContain('Email prof'));
  });

  it('sends today\'s plan to the menu bar pill', async () => {
    render(<MenuPanel />);
    await waitFor(() => expect(called('set_day_plan').some(c => (c[1]!.slots as { title: string }[]).some(s => s.title === 'Shower'))).toBe(true));
  });

  it('opens scrolled to now, not to the start of the day', async () => {
    render(<MenuPanel />);
    await screen.findByRole('region', { name: 'Planned' });
    const cols = document.querySelector('.mp-cols') as HTMLElement;
    // 9:00 is 60 minutes after the 8:00 wake, at 1.6 px a minute; now sits a little below the top.
    await waitFor(() => expect(cols.dataset.scrolledTo).toBe('540'));
  });

  it('opens the add forms from the keyboard, never while typing', async () => {
    render(<MenuPanel />);
    await screen.findByRole('region', { name: 'Planned' });
    await waitFor(() => expect(screen.getByRole('region', { name: 'Planned' }).textContent).toContain('Shower'));
    fireEvent.keyDown(window, { key: 't' });
    const field = await screen.findByRole('textbox', { name: 'Task' });
    fireEvent.keyDown(field, { key: 'h' });
    expect(screen.queryByRole('textbox', { name: 'Habit' })).toBeNull();
    fireEvent.keyDown(field, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Task' })).toBeNull());
    fireEvent.keyDown(window, { key: 'l' });
    expect(await screen.findByRole('textbox', { name: 'What' })).toBeTruthy();
  });

  it('opens the app from the panel', async () => {
    render(<MenuPanel />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Open Habyss' }))[0]);
    expect(called('open_dashboard').length).toBeGreaterThan(0);
  });

  it('opens the month and folds it back to the week', async () => {
    render(<MenuPanel />);
    expect(await screen.findByRole('navigation', { name: 'Week' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'm' });
    const month = await screen.findByRole('navigation', { name: 'Month' });
    expect(month.querySelectorAll('.mp-day').length % 7).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: /Thursday, November 12/ }));
    expect(await screen.findByRole('navigation', { name: 'Week' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Thursday, November 12/ }).getAttribute('aria-pressed')).toBe('true');
  });
});
