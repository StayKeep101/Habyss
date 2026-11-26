// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { CloudData, SyncStatus } from '../types';

const calls: string[] = [];
let handlers: Record<string, () => unknown> = {};
const listeners: Record<string, () => void> = {};
const disposed: string[] = [];
vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => true,
  invoke: (cmd: string) => { calls.push(cmd); try { return Promise.resolve(handlers[cmd]?.()); } catch (e) { return Promise.reject(e); } },
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: (name: string, cb: () => void) => { listeners[name] = cb; return Promise.resolve(() => { disposed.push(name); }); } }));
import { isSignedIn, useCloud } from './useCloud';

const STATUS: SyncStatus = { state: 'idle', account: true, email: 'a@b.c', last_sync: null, pending: 0, refused: 0, error: null };
const data = (title: string): CloudData => ({ habits: [], completions: [], day_inputs: {}, tasks: [{ title } as never] });
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };

beforeEach(() => { calls.length = 0; disposed.length = 0; for (const k of Object.keys(listeners)) delete listeners[k]; handlers = { cloud_data: () => data('first'), cloud_status: () => STATUS }; });
afterEach(cleanup);

describe('isSignedIn', () => {
  it('reads_the_account_flag_not_the_pass_state', () => {
    expect(isSignedIn(null)).toBe(false);
    expect(isSignedIn({ ...STATUS, state: 'syncing', account: false })).toBe(false);
    expect(isSignedIn({ ...STATUS, state: 'signed_out', account: true })).toBe(true);
    expect(isSignedIn({ ...STATUS, state: 'offline' })).toBe(true);
    expect(isSignedIn({ ...STATUS, state: 'unconfigured' })).toBe(false);
  });
});

describe('useCloud', () => {
  it('loads_data_and_status', async () => {
    const { result } = renderHook(() => useCloud());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.tasks[0].title).toBe('first');
    expect(result.current.status).toEqual(STATUS);
    expect(result.current.error).toBeNull();
  });

  it('a_failed_read_sets_the_error_and_stops_loading', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    handlers.cloud_data = () => { throw new Error('offline'); };
    const { result } = renderHook(() => useCloud());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toContain('offline');
    expect(result.current.data).toBeNull();
    // A later success clears it.
    handlers.cloud_data = () => data('back');
    await act(() => result.current.refresh());
    expect([result.current.error, result.current.data?.tasks[0].title]).toEqual([null, 'back']);
    quiet.mockRestore();
  });

  it('only_the_latest_read_lands', async () => {
    const slow = deferred<CloudData>();
    handlers.cloud_data = () => slow.promise;
    const { result } = renderHook(() => useCloud());
    await waitFor(() => expect(calls.filter(c => c === 'cloud_data')).toHaveLength(1));
    handlers.cloud_data = () => data('new');
    await act(() => result.current.refresh());
    expect(result.current.data?.tasks[0].title).toBe('new');
    // The first read answers late, with older data: it is dropped.
    await act(async () => { slow.resolve(data('stale')); await slow.promise; });
    expect(result.current.data?.tasks[0].title).toBe('new');
  });

  it('cloud_changed_reloads_data_and_sync_status_reloads_status', async () => {
    const { result, unmount } = renderHook(() => useCloud());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(listeners['cloud-changed'] && listeners['sync-status']).toBeTruthy());
    handlers.cloud_data = () => data('changed');
    act(() => listeners['cloud-changed']());
    await waitFor(() => expect(result.current.data?.tasks[0].title).toBe('changed'));
    handlers.cloud_status = () => ({ ...STATUS, state: 'syncing' });
    act(() => listeners['sync-status']());
    await waitFor(() => expect(result.current.status?.state).toBe('syncing'));
    unmount();
    expect(disposed.sort()).toEqual(['cloud-changed', 'sync-status']);
  });

  it('set_local_edits_the_loaded_copy', async () => {
    const { result } = renderHook(() => useCloud());
    await waitFor(() => expect(result.current.data).not.toBeNull());
    act(() => result.current.setLocal(d => ({ ...d, tasks: [] })));
    expect(result.current.data?.tasks).toEqual([]);
  });
});
