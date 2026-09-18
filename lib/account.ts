import type { Session } from '@supabase/supabase-js';
import { getDatabase } from './database';
import { getSupabase } from './supabase';
import { adoptUserId, getLocalUserId } from './localUser';
import { resetSyncCursor, syncNow, type SyncReport } from './cloudSync';
import { deleteAllLocalData } from './accountDeletion';

/**
 * Accounts: signing in, out, and deleting.
 *
 * An account is optional. Habyss works fully on one phone without one; signing
 * in adds backup, restoring onto a new phone, and friends. Sign-in is by a
 * one-time code sent to the user's email, which needs no password and no
 * third-party login.
 */

export interface Account {
    id: string;
    email: string | null;
}

const toAccount = (session: Session | null): Account | null =>
    session?.user ? { id: session.user.id, email: session.user.email ?? null } : null;

export async function currentAccount(): Promise<Account | null> {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return toAccount(data.session);
}

/** Calls back whenever someone signs in or out. Returns the unsubscribe. */
export function onAccountChange(callback: (account: Account | null) => void): () => void {
    const sb = getSupabase();
    if (!sb) return () => undefined;
    const { data } = sb.auth.onAuthStateChange((_event, session) => callback(toAccount(session)));
    return () => data.subscription.unsubscribe();
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (value: string): boolean => EMAIL.test(value.trim());

/* -------------------------------------------------------------------------- */
/*  Signing in                                                                 */
/* -------------------------------------------------------------------------- */

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

/** Emails a one-time code. Creates the account the first time. */
export async function requestCode(email: string): Promise<Result> {
    const sb = getSupabase();
    if (!sb) return { ok: false, error: 'Accounts are not set up in this build.' };
    if (!isEmail(email)) return { ok: false, error: 'That does not look like an email address.' };

    const { error } = await sb.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
    });
    if (error) return { ok: false, error: friendly(error.message) };
    return { ok: true, value: undefined };
}

/**
 * Checks the code, then brings this phone and the account together.
 *
 * Whatever is on this phone is kept and uploaded, and whatever is already in
 * the account comes down, so signing in on a new phone restores everything and
 * signing in on the old one backs it up. Neither side overwrites the other.
 */
export async function verifyCode(email: string, code: string): Promise<Result<SyncReport>> {
    const sb = getSupabase();
    if (!sb) return { ok: false, error: 'Accounts are not set up in this build.' };

    const token = code.replace(/\s/g, '');
    if (!/^\d{6,10}$/.test(token)) return { ok: false, error: 'Enter the code from the email.' };

    const { data, error } = await sb.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: 'email',
    });
    if (error || !data.session?.user) return { ok: false, error: friendly(error?.message ?? 'That code did not work.') };

    await linkThisPhone(data.session.user.id);
    return { ok: true, value: await syncNow() };
}

/**
 * Moves every row on this phone from the anonymous local id to the account's.
 *
 * Local queries are scoped by user id, so without this, rows created before
 * signing in would upload under the wrong owner and restored rows would not
 * show up at all.
 */
export async function linkThisPhone(accountId: string): Promise<void> {
    const previous = await getLocalUserId();
    if (previous !== accountId) {
        const db = await getDatabase();
        if (db) {
            await db.withTransactionAsync(async () => {
                for (const table of ['habits', 'completions', 'tasks']) {
                    await db.runAsync(`UPDATE ${table} SET user_id = ?, synced = 0 WHERE user_id = ?`, accountId, previous);
                }
            });
        }
    }
    await adoptUserId(accountId);
    // A first sign-in on this phone downloads the whole account, not a slice.
    await resetSyncCursor(accountId);
}

/* -------------------------------------------------------------------------- */
/*  Signing out                                                                */
/* -------------------------------------------------------------------------- */

export type SignOutResult =
    | { ok: true }
    /** The last backup failed; signing out now would lose what is not uploaded. */
    | { ok: false; unsaved: true; error: string }
    | { ok: false; unsaved: false; error: string };

/**
 * Backs up, then signs out and clears this phone.
 *
 * The data belongs to the account, so it leaves with it: the next person to use
 * this phone should not see it, and signing back in restores it. If the final
 * backup fails, nothing is cleared and the caller must ask before going ahead.
 */
export async function signOut(options: { discardUnsaved?: boolean } = {}): Promise<SignOutResult> {
    const sb = getSupabase();
    if (!sb) return { ok: false, unsaved: false, error: 'Accounts are not set up in this build.' };

    if (!options.discardUnsaved) {
        const report = await syncNow();
        if (!report.ok) {
            return {
                ok: false,
                unsaved: true,
                error: report.error ?? `${report.failed} change${report.failed === 1 ? '' : 's'} could not be backed up.`,
            };
        }
    }

    // Local sign-out: this phone only, so other devices stay signed in.
    await sb.auth.signOut({ scope: 'local' });
    await deleteAllLocalData();
    return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Deleting the account                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Deletes the account on the server, then everything on this phone.
 *
 * The server function removes the user and, through the database's cascades,
 * every habit, completion, task, friendship and share they own. It runs with
 * its own rights, so the app never holds an admin key.
 */
export async function deleteAccount(): Promise<Result> {
    const sb = getSupabase();
    if (!sb) return { ok: false, error: 'Accounts are not set up in this build.' };

    const { error } = await sb.rpc('delete_my_account');
    if (error) return { ok: false, error: friendly(error.message) };

    await sb.auth.signOut({ scope: 'local' }).catch(() => undefined);
    await deleteAllLocalData();
    return { ok: true, value: undefined };
}

function friendly(message: string): string {
    if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
    if (/expired|invalid.*(otp|token)|token has expired/i.test(message)) return 'That code has expired or is wrong. Send a new one.';
    if (/network|fetch|timed out/i.test(message)) return 'No connection. Try again when you are online.';
    if (/signups not allowed/i.test(message)) return 'New accounts are not being accepted right now.';
    return message || 'Something went wrong. Try again.';
}
