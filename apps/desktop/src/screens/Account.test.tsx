// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SyncStatus } from '../types';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(() => Promise.resolve(() => {})) }));
import { Account } from './Account';

const st = (o: Partial<SyncStatus>): SyncStatus => ({ state: 'signed_out', email: null, last_sync: null, pending: 0, refused: 0, error: null, ...o });
const mockStatus = (s: SyncStatus, extra: Record<string, unknown> = {}) => invoke.mockImplementation((cmd: string) => cmd === 'cloud_status' ? Promise.resolve(s) : Promise.resolve(extra[cmd] ?? null));

beforeEach(() => invoke.mockReset());
afterEach(cleanup);

describe('Account', () => {
    it('shows_code_field_after_send', async () => {
        mockStatus(st({}));
        render(<Account />);
        fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'a@b.co' } });
        fireEvent.click(screen.getByText('Send code'));
        expect(await screen.findByLabelText('6-digit code')).toBeTruthy();
        expect(invoke).toHaveBeenCalledWith('cloud_send_code', { email: 'a@b.co' });
    });
    it('verify_calls_cloud_verify_code_with_email_and_code', async () => {
        mockStatus(st({}));
        render(<Account />);
        fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'a@b.co' } });
        fireEvent.click(screen.getByText('Send code'));
        fireEvent.change(await screen.findByLabelText('6-digit code'), { target: { value: '123456' } });
        fireEvent.click(screen.getByText('Verify'));
        await waitFor(() => expect(invoke).toHaveBeenCalledWith('cloud_verify_code', { email: 'a@b.co', code: '123456' }));
    });
    it('signed_in_shows_pending_and_refused_counts', async () => {
        mockStatus(st({ state: 'idle', email: 'a@b.co', pending: 3, refused: 2 }));
        render(<Account />);
        expect(await screen.findByText('3 changes waiting')).toBeTruthy();
        expect(screen.getByText("2 changes couldn't sync")).toBeTruthy();
        expect(screen.getByText('a@b.co')).toBeTruthy();
    });
    it('unconfigured_shows_not_set_up', async () => {
        mockStatus(st({ state: 'unconfigured' }));
        render(<Account />);
        expect(await screen.findByText("Sync isn't set up in this build.")).toBeTruthy();
    });
});
