const mockDb = {
    runAsync: jest.fn(async () => ({ changes: 1 })),
    withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
};
const mockAuth = {
    getSession: jest.fn(),
    signInWithOtp: jest.fn(async () => ({ error: null })),
    verifyOtp: jest.fn(),
    signOut: jest.fn(async () => ({ error: null })),
    onAuthStateChange: jest.fn(),
};
const mockRpc = jest.fn();

jest.mock('../supabase', () => ({ getSupabase: () => ({ auth: mockAuth, rpc: mockRpc }) }));
jest.mock('../database', () => ({ getDatabase: jest.fn(async () => mockDb) }));
jest.mock('../localUser', () => ({
    getLocalUserId: jest.fn(async () => 'local-anonymous-id'),
    adoptUserId: jest.fn(async () => undefined),
}));
jest.mock('../cloudSync', () => ({
    syncNow: jest.fn(),
    resetSyncCursor: jest.fn(async () => undefined),
}));
jest.mock('../accountDeletion', () => ({ deleteAllLocalData: jest.fn(async () => ({ ok: true })) }));

import { deleteAccount, isEmail, linkThisPhone, requestCode, signOut, verifyCode } from '../account';
import { syncNow, resetSyncCursor } from '../cloudSync';
import { deleteAllLocalData } from '../accountDeletion';
import { adoptUserId } from '../localUser';

const ACCOUNT = 'aaaaaaaa-0000-4000-8000-000000000001';

beforeEach(() => jest.clearAllMocks());

describe('signing in', () => {
    it('refuses something that is not an email without calling the server', async () => {
        const result = await requestCode('not an email');
        expect(result.ok).toBe(false);
        expect(mockAuth.signInWithOtp).not.toHaveBeenCalled();
    });

    it('sends the code to a normalised address', async () => {
        await requestCode('  Erwan@Example.COM ');
        expect(mockAuth.signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({ email: 'erwan@example.com' }));
    });

    it('refuses a malformed code without calling the server', async () => {
        const result = await verifyCode('a@b.co', 'abc');
        expect(result.ok).toBe(false);
        expect(mockAuth.verifyOtp).not.toHaveBeenCalled();
    });

    it('tolerates spaces typed into the code', async () => {
        mockAuth.verifyOtp.mockResolvedValue({ data: { session: { user: { id: ACCOUNT } } }, error: null });
        (syncNow as jest.Mock).mockResolvedValue({ ok: true, uploaded: 0, downloaded: 3, failed: 0 });
        await verifyCode('a@b.co', '123 456');
        expect(mockAuth.verifyOtp).toHaveBeenCalledWith(expect.objectContaining({ token: '123456' }));
    });

    it('links this phone to the account and then syncs', async () => {
        mockAuth.verifyOtp.mockResolvedValue({ data: { session: { user: { id: ACCOUNT } } }, error: null });
        (syncNow as jest.Mock).mockResolvedValue({ ok: true, uploaded: 2, downloaded: 5, failed: 0 });
        const result = await verifyCode('a@b.co', '123456');
        expect(adoptUserId).toHaveBeenCalledWith(ACCOUNT);
        expect(syncNow).toHaveBeenCalled();
        expect(result).toEqual({ ok: true, value: expect.objectContaining({ downloaded: 5 }) });
    });

    it('does not sync when the code is wrong', async () => {
        mockAuth.verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'Token has expired or is invalid' } });
        const result = await verifyCode('a@b.co', '123456');
        expect(result.ok).toBe(false);
        expect(syncNow).not.toHaveBeenCalled();
    });
});

describe('linking this phone to an account', () => {
    it('moves every table from the anonymous id to the account', async () => {
        await linkThisPhone(ACCOUNT);
        const statements = mockDb.runAsync.mock.calls.map((call: any[]) => call[0] as string);
        for (const table of ['habits', 'completions', 'tasks']) {
            expect(statements.some(sql => sql.startsWith(`UPDATE ${table} SET user_id = ?, synced = 0`))).toBe(true);
        }
    });

    it('marks the moved rows for upload, so they are backed up under the account', async () => {
        await linkThisPhone(ACCOUNT);
        expect(mockDb.runAsync.mock.calls.every((call: any[]) => (call[0] as string).includes('synced = 0'))).toBe(true);
    });

    it('downloads the whole account the first time, not only recent changes', async () => {
        await linkThisPhone(ACCOUNT);
        expect(resetSyncCursor).toHaveBeenCalledWith(ACCOUNT);
    });
});

describe('signing out never loses data silently', () => {
    it('backs up first, then clears this phone', async () => {
        (syncNow as jest.Mock).mockResolvedValue({ ok: true, uploaded: 1, downloaded: 0, failed: 0 });
        const result = await signOut();
        expect(result).toEqual({ ok: true });
        expect(syncNow).toHaveBeenCalled();
        expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
        expect(deleteAllLocalData).toHaveBeenCalled();
    });

    it('keeps everything and stays signed in when the last backup fails', async () => {
        (syncNow as jest.Mock).mockResolvedValue({ ok: false, uploaded: 0, downloaded: 0, failed: 3 });
        const result = await signOut();
        expect(result).toMatchObject({ ok: false, unsaved: true });
        expect(mockAuth.signOut).not.toHaveBeenCalled();
        expect(deleteAllLocalData).not.toHaveBeenCalled();
    });

    it('says how many changes would be lost', async () => {
        (syncNow as jest.Mock).mockResolvedValue({ ok: false, uploaded: 0, downloaded: 0, failed: 3 });
        const result = await signOut();
        expect(result.ok === false && result.error).toContain('3 changes');
    });

    it('signs out anyway only when the user explicitly accepts the loss', async () => {
        const result = await signOut({ discardUnsaved: true });
        expect(result).toEqual({ ok: true });
        expect(syncNow).not.toHaveBeenCalled();
        expect(deleteAllLocalData).toHaveBeenCalled();
    });

    it('signs out this phone only, leaving other devices signed in', async () => {
        (syncNow as jest.Mock).mockResolvedValue({ ok: true, uploaded: 0, downloaded: 0, failed: 0 });
        await signOut();
        expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    });
});

describe('deleting the account', () => {
    it('deletes on the server, then clears this phone', async () => {
        mockRpc.mockResolvedValue({ error: null });
        const result = await deleteAccount();
        expect(mockRpc).toHaveBeenCalledWith('delete_my_account');
        expect(result.ok).toBe(true);
        expect(deleteAllLocalData).toHaveBeenCalled();
    });

    it('keeps this phone intact when the server refuses', async () => {
        // Otherwise the data would be gone locally while the account still exists.
        mockRpc.mockResolvedValue({ error: { message: 'network request failed' } });
        const result = await deleteAccount();
        expect(result.ok).toBe(false);
        expect(deleteAllLocalData).not.toHaveBeenCalled();
    });
});

describe('isEmail', () => {
    it('accepts real addresses and refuses the rest', () => {
        expect(isEmail('a@b.co')).toBe(true);
        expect(isEmail(' a@b.co ')).toBe(true);
        expect(isEmail('a@b')).toBe(false);
        expect(isEmail('')).toBe(false);
    });
});
