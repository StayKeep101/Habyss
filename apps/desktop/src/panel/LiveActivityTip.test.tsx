// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
const calls: [string, unknown][] = [];
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: (cmd: string, args: unknown) => { calls.push([cmd, args]); return Promise.resolve(); } }));
import { LiveActivityTip } from './LiveActivityTip';

beforeEach(() => { localStorage.clear(); calls.length = 0; });
afterEach(cleanup);

describe('LiveActivityTip', () => {
  it('offers once to hide the iPhone Live Activity on this Mac', () => {
    render(<LiveActivityTip />);
    expect(screen.getByText(/Seeing Habyss twice/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Menu Bar settings' }));
    expect(calls).toEqual([['open_system_settings', { pane: 'menu_bar' }]]);
  });
  it('stays gone once dismissed', () => {
    const { unmount } = render(<LiveActivityTip />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/Seeing Habyss twice/)).toBeNull();
    unmount();
    render(<LiveActivityTip />);
    expect(screen.queryByText(/Seeing Habyss twice/)).toBeNull();
  });
});
