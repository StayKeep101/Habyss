const mockDb = {
    runAsync: jest.fn(async () => ({ changes: 1 })),
    withTransactionAsync: jest.fn(async (work: () => Promise<void>) => work()),
};
const mockAuth = {
    getSession: jest.fn(),
    signInWithOtp: jest.fn(async () => ({ error: null })),
    verifyOtp: jest.fn(),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(async () => ({ error: null })),
    onAuthStateChange: jest.fn(),
};
const mockRpc = jest.fn();
const mockProfile = { row: null as null | { id: string } };
const mockInsert = jest.fn(async () => ({ error: null }));
const mockFrom = jest.fn(() => ({
    select: () => ({ eq: (_column: string, id: string) => ({ maybeSingle: async () => ({ data: mockProfile.row?.id === id ? mockProfile.row : null }) }) }),
    insert: mockInsert,
}));

jest.mock('../supabase', () => ({ getSupabase: () => ({ auth: mockAuth, rpc: mockRpc, from: mockFrom }) }));
jest.mock('../database', () => ({ getDatabase: jest.fn(async () => mockDb) }));
jest.mock('../localUser', () => ({
    getLocalUserId: jest.fn(async () => 'local-anonymous-id'),
    adoptUserId: jest.fn(async () => undefined),
}));
jest.mock('../cloudSync', () => ({
    syncNow: jest.fn(),
    resetSyncCursor: jest.fn(async () => undefined),
}));
jest.mock('../accountDeletion', () => ({
    deleteAllLocalData: jest.fn(async () => ({ ok: true })),
    restartAfterDeletion: jest.fn(async () => true),
}));
jest.mock('../personalBackup', () => ({
    backUpPersonal: jest.fn(async () => true),
    syncPersonal: jest.fn(async () => 0),
    clearPersonal: jest.fn(async () => undefined),
    takeRestored: jest.fn(() => 0),
}));

import {
    deleteAccount, isEmail, linkThisPhone, requestCode, signInWithPassword,
    signOut, signUpWithPassword, verifyCode,
} from '../account';
import { syncNow, resetSyncCursor } from '../cloudSync';
import { deleteAllLocalData } from '../accountDeletion';
import { adoptUserId } from '../localUser';
import { backUpPersonal, clearPersonal } from '../personalBackup';

const ACCOUNT = 'aaaaaaaa-0000-4000-8000-000000000001';

beforeEach(() => { jest.clearAllMocks(); mockProfile.row = { id: ACCOUNT }; });

describe('signing in', () => {
    it('refuses something that is not an email without calling the server', async () => {
        const result = await requestCode('not an email');
        expect(result.ok).toBe(false);
        expect(mockAuth.signInWithOtp).not.toHaveBeenCalled();
    });

    it('sends the code to a normalised address', async () => {
        await requestCode('  Erwan@Example.COM ');
        expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({ email: 'erwan@example.com',
            options: { shouldCreateUser: true, emailRedirectTo: 'habyss://auth-callback' } });
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
        const backupWrites = mockDb.runAsync.mock.calls.filter((call: any[]) => !(call[0] as string).includes('habit_measurements'));
        expect(backupWrites.every((call: any[]) => (call[0] as string).includes('synced = 0'))).toBe(true);
        expect(mockDb.runAsync).toHaveBeenCalledWith('UPDATE habit_measurements SET user_id = ? WHERE user_id = ?', ACCOUNT, 'local-anonymous-id');
    });

    it('downloads the whole account the first time, not only recent changes', async () => {
        await linkThisPhone(ACCOUNT);
        expect(resetSyncCursor).toHaveBeenCalledWith(ACCOUNT);
    });

    it('never moves another account\'s rows into this one when its session ended without signing out', async () => {
        // The phone's id is an account's (it has a profile): somebody else.
        mockProfile.row = { id: 'local-anonymous-id' };
        await linkThisPhone(ACCOUNT);
        const statements = mockDb.runAsync.mock.calls.map((call: any[]) => call[0] as string);
        expect(statements.some(sql => sql.includes('SET user_id'))).toBe(false);
        expect(clearPersonal).toHaveBeenCalled();
        expect(adoptUserId).toHaveBeenCalledWith(ACCOUNT);
        mockProfile.row = null;
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

    it('stays signed in when settings, Echo and focus history could not be backed up', async () => {
        (syncNow as jest.Mock).mockResolvedValue({ ok: true, uploaded: 0, downloaded: 0, failed: 0 });
        mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: ACCOUNT } } } });
        (backUpPersonal as jest.Mock).mockResolvedValueOnce(false);
        const result = await signOut();
        expect(result).toMatchObject({ ok: false, unsaved: true });
        expect(deleteAllLocalData).not.toHaveBeenCalled();
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

describe('the profile friends search by', () => {
    it('is created when the account does not have one yet', async () => {
        mockProfile.row = null;
        mockAuth.verifyOtp.mockResolvedValue({ data: { session: { user: { id: ACCOUNT } } }, error: null });
        (syncNow as jest.Mock).mockResolvedValue({ ok: true, uploaded: 0, downloaded: 0, failed: 0 });
        await verifyCode('a@b.co', '123456');
        expect(mockInsert).toHaveBeenCalledWith({ id: ACCOUNT });
    });

    it('is left alone when it already exists', async () => {
        mockAuth.verifyOtp.mockResolvedValue({ data: { session: { user: { id: ACCOUNT } } }, error: null });
        (syncNow as jest.Mock).mockResolvedValue({ ok: true, uploaded: 0, downloaded: 0, failed: 0 });
        await verifyCode('a@b.co', '123456');
        expect(mockInsert).not.toHaveBeenCalled();
    });

    it('reports profile setup failures instead of pretending Community is ready', async () => {
        mockProfile.row = null;
        mockInsert.mockRejectedValueOnce(new Error('permission denied'));
        mockAuth.verifyOtp.mockResolvedValue({ data: { session: { user: { id: ACCOUNT } } }, error: null });
        (syncNow as jest.Mock).mockResolvedValue({ ok: true, uploaded: 0, downloaded: 2, failed: 0 });
        const result = await verifyCode('a@b.co', '123456');
        expect(result).toMatchObject({ ok: false, error: 'permission denied' });
        expect(syncNow).not.toHaveBeenCalled();
    });
});

describe('account notifications', () => {
    it('releases the Supabase auth callback before Community can query the session', () => {
        jest.useFakeTimers();
        const unsubscribe = jest.fn();
        let notify: (...args: any[]) => void = () => undefined;
        mockAuth.onAuthStateChange.mockImplementation(handler => { notify = handler; return { data: { subscription: { unsubscribe } } }; });
        const callback = jest.fn();
        const stop = require('../account').onAccountChange(callback);
        const session = { user: { id: ACCOUNT, email: 'a@b.co' } };
        expect(notify('SIGNED_IN', session)).toBeUndefined();
        expect(callback).not.toHaveBeenCalled();
        jest.runOnlyPendingTimers();
        expect(callback).toHaveBeenCalledWith({ id: ACCOUNT, email: 'a@b.co' });
        notify('SIGNED_IN', session);
        stop();
        jest.runOnlyPendingTimers();
        expect(callback).toHaveBeenCalledTimes(1);
        expect(unsubscribe).toHaveBeenCalled();
        jest.useRealTimers();
    });
});

describe('signing in with a password', () => {
    beforeEach(() => jest.clearAllMocks());

    it('refuses an address that is not one, without calling out', async () => {
        const result = await signInWithPassword('not-an-email', 'secret123');
        expect(result.ok).toBe(false);
        expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
    });

    it('says plainly when the pair does not match, and points at the other way in', async () => {
        mockAuth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: 'Invalid login credentials' } });
        const result = await signInWithPassword('erwan@example.com', 'wrong');
        expect(result.ok).toBe(false);
        expect((result as any).error).toMatch(/code instead/i);
    });

    it('ends where every other way in ends, so the phone and the account merge', async () => {
        mockAuth.signInWithPassword.mockResolvedValue({ data: { session: { user: { id: ACCOUNT } } }, error: null });
        const result = await signInWithPassword('erwan@example.com', 'secret123');
        expect(result.ok).toBe(true);
        expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'erwan@example.com', password: 'secret123' });
    });

    it('says so rather than hanging when the server wants the email confirmed', async () => {
        mockAuth.signUp.mockResolvedValue({ data: { session: null, user: { id: ACCOUNT } }, error: null });
        const result = await signUpWithPassword('new@example.com', 'secret123');
        expect(mockAuth.signUp).toHaveBeenCalledWith({ email: 'new@example.com', password: 'secret123',
            options: { emailRedirectTo: 'habyss://auth-callback' } });
        // Signed up, but no session: the caller tells them to confirm.
        expect(result).toEqual({ ok: true, value: null });
    });

    it('will not make a second account for an address that already has one', async () => {
        mockAuth.signUp.mockResolvedValue({ data: { session: null }, error: { message: 'User already registered' } });
        const result = await signUpWithPassword('taken@example.com', 'secret123');
        expect(result.ok).toBe(false);
        expect((result as any).error).toMatch(/already an account/i);
    });
});
