import type { Session } from '@supabase/supabase-js';
import { getDatabase } from './database';
import { getSupabase } from './supabase';
import { adoptUserId, getLocalUserId } from './localUser';
import { resetSyncCursor, syncNow, type SyncReport } from './cloudSync';
import { deleteAllLocalData } from './accountDeletion';
import { emit } from './appEvents';
import { AUTH_REDIRECT } from './authRedirect';

/**
 * Accounts: signing in, out, and deleting.
 *
 * An account is optional. Habyss works fully on one phone without one; signing
 * in adds backup, restoring onto a new phone, and friends. Sign-in is with
 * Apple or Google (lib/socialSignIn.ts), or a one-time code sent by email;
 * none of them needs a password.
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
    let active = true;
    // Auth callbacks run under Supabase's session lock. Defer listeners that
    // read the session so Community cannot deadlock the sign-in that woke it.
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const { data } = sb.auth.onAuthStateChange((_event, session) => {
        const timer = setTimeout(() => {
            timers.delete(timer);
            if (active) callback(toAccount(session));
        }, 0);
        timers.add(timer);
    });
    return () => { active = false; timers.forEach(clearTimeout); data.subscription.unsubscribe(); };
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
        options: { shouldCreateUser: true, emailRedirectTo: AUTH_REDIRECT },
    });
    if (error) return { ok: false, error: friendly(error.message) };
    return { ok: true, value: undefined };
}

/**
 * Signs in with an email and a password.
 *
 * Kept alongside the emailed code because a code depends on an email actually
 * arriving, and an email that does not arrive leaves someone locked out of
 * their own backup with nothing they can do about it. A password needs no
 * delivery at all.
 *
 * It ends in the same place as every other way in, so the phone and the
 * account are merged identically however someone got here.
 */
export async function signInWithPassword(email: string, password: string): Promise<Result<SyncReport>> {
    const sb = getSupabase();
    if (!sb) return { ok: false, error: 'Accounts are not set up in this build.' };
    if (!isEmail(email)) return { ok: false, error: 'That does not look like an email address.' };
    if (!password) return { ok: false, error: 'Enter your password.' };

    const { data, error } = await sb.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
    });
    if (error || !data.session?.user) {
        const message = String(error?.message ?? '');
        if (/invalid login credentials/i.test(message)) {
            return { ok: false, error: 'That email and password do not match an account. Use a code instead if you have never set one.' };
        }
        if (/email not confirmed/i.test(message)) {
            return { ok: false, error: 'That account still needs its email confirmed before a password will work.' };
        }
        return { ok: false, error: friendly(message || 'That did not work.') };
    }

    return finishSignIn(data.session.user.id);
}

/**
 * Creates an account with a password.
 *
 * Whether it signs in straight away depends on the server: with email
 * confirmation on, there is no session until the link is followed, and saying
 * so plainly is better than a spinner that never resolves.
 */
export async function signUpWithPassword(email: string, password: string): Promise<Result<SyncReport | null>> {
    const sb = getSupabase();
    if (!sb) return { ok: false, error: 'Accounts are not set up in this build.' };
    if (!isEmail(email)) return { ok: false, error: 'That does not look like an email address.' };
    if (password.length < 6) return { ok: false, error: 'Use at least 6 characters.' };

    const { data, error } = await sb.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options: { emailRedirectTo: AUTH_REDIRECT },
    });
    if (error) {
        const message = String(error.message);
        if (/already registered/i.test(message)) {
            return { ok: false, error: 'There is already an account with that email. Sign in instead.' };
        }
        return { ok: false, error: friendly(message) };
    }
    // No session means the server wants the email confirmed first.
    if (!data.session?.user) return { ok: true, value: null };

    const result = await finishSignIn(data.session.user.id);
    return result.ok ? { ok: true, value: result.value } : result;
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

    return finishSignIn(data.session.user.id);
}

/** Every way of signing in ends here, so they all restore and back up alike. */
export async function finishSignIn(accountId: string): Promise<Result<SyncReport>> {
    try {
        await linkThisPhone(accountId);
        await ensureProfile(accountId);
        const report = await syncNow();
        emit('social_state_updated');
        return { ok: true, value: report };
    } catch (error: any) {
        return { ok: false, error: friendly(error?.message || 'Could not finish setting up your account. Please try again.') };
    }
}

/**
 * Makes sure the account has a profile row, which is what friends search and
 * what a username is stored on.
 *
 * The database creates one by trigger when an account is made. This is the
 * belt and braces for accounts made before that trigger existed, and it is
 * verified before reporting that Community is ready.
 */
export async function ensureProfile(accountId: string): Promise<void> {
    const sb = getSupabase();
    if (!sb) return;
    const { data, error } = await sb.from('profiles').select('id').eq('id', accountId).maybeSingle();
    if (error) throw new Error('Your account is signed in, but its community profile could not be loaded. Please try again.');
    if (data) return;
    const { error: insertError } = await sb.from('profiles').insert({ id: accountId });
    if (insertError && insertError.code !== '23505') throw new Error('Your community profile could not be created. Please try again.');
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
        if (!db) throw new Error('Your local data could not be linked. Please try signing in again.');
        if (db) {
            await db.withTransactionAsync(async () => {
                for (const table of ['habits', 'completions', 'tasks']) {
                    await db.runAsync(`UPDATE ${table} SET user_id = ?, synced = 0 WHERE user_id = ?`, accountId, previous);
                }
                await db.runAsync('UPDATE habit_measurements SET user_id = ? WHERE user_id = ?', accountId, previous);
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

    // This phone stops receiving the account's notifications once it leaves.
    const { releasePushToken } = require('./profileSync') as typeof import('./profileSync');
    await releasePushToken().catch(() => undefined);
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

    // Photos live in file storage, which the database delete does not reach:
    // remove this person's folder first (best effort; the account goes regardless).
    try {
        const { data: session } = await sb.auth.getSession();
        const me = session.session?.user?.id;
        if (me) {
            const { data: files } = await sb.storage.from('avatars').list(me);
            if (files?.length) await sb.storage.from('avatars').remove(files.map(file => `${me}/${file.name}`));
        }
    } catch { /* nothing more to do */ }

    const { error } = await sb.rpc('delete_my_account');
    if (error) return { ok: false, error: friendly(error.message) };

    await sb.auth.signOut({ scope: 'local' }).catch(() => undefined);
    await deleteAllLocalData();
    return { ok: true, value: undefined };
}

export function friendly(message: string): string {
    if (/rate limit|too many/i.test(message)) return 'Too many attempts. Wait a minute and try again.';
    if (/expired|invalid.*(otp|token)|token has expired/i.test(message)) return 'That code has expired or is wrong. Send a new one.';
    if (/network|fetch|timed out/i.test(message)) return 'No connection. Try again when you are online.';
    if (/signups not allowed/i.test(message)) return 'New accounts are not being accepted right now.';
    return message || 'Something went wrong. Try again.';
}
