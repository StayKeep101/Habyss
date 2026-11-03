// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { SyncStatus } from '../types';

const invoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({ invoke: (...a: unknown[]) => invoke(...a) }));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(() => Promise.resolve(() => {})) }));
import { Account, ago } from './Account';

const st = (o: Partial<SyncStatus>): SyncStatus => ({ state: 'signed_out', account: false, email: null, last_sync: null, pending: 0, refused: 0, error: null, ...o });
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
    it('offline_shows_error_text', async () => {
        mockStatus(st({ state: 'offline', email: 'a@b.co', error: 'network down' }));
        render(<Account />);
        expect((await screen.findByRole('alert')).textContent).toBe('network down');
    });
    it('code_must_be_six_digits', async () => {
        mockStatus(st({}));
        render(<Account />);
        fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'a@b.co' } });
        fireEvent.click(screen.getByText('Send code'));
        fireEvent.change(await screen.findByLabelText('6-digit code'), { target: { value: '12a456' } });
        expect((screen.getByText('Verify') as HTMLButtonElement).disabled).toBe(true);
        fireEvent.click(screen.getByText('Use a different email'));
        expect((screen.getByLabelText('Email') as HTMLInputElement).disabled).toBe(false);
    });
});

describe('ago', () => {
    const now = Date.parse('2026-11-02T12:00:00Z');
    it('formats relative times', () => {
        expect(ago('2026-11-02T11:59:40Z', now)).toBe('just now');
        expect(ago('2026-11-02T11:57:00Z', now)).toBe('3 min ago');
        expect(ago('2026-11-02T10:00:00Z', now)).toBe('2 h ago');
        expect(ago('garbage', now)).toBe('never');
    });
});
