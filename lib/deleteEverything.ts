/**
 * Deleting the account, wherever it is asked for (Settings → Account, Privacy &
 * security): signed in, the account and its backup on the server go first (or
 * they would outlive what was promised); then everything on this phone. Then
 * the app starts over from the beginning.
 */
export async function deleteEverything(): Promise<{ ok: true; failed: string[] } | { ok: false; error: string }> {
    const { currentAccount, deleteAccount } = require('./account') as typeof import('./account');
    const { deleteAllLocalData } = require('./accountDeletion') as typeof import('./accountDeletion');
    const signedIn = await currentAccount().catch(() => null);
    if (signedIn) {
        const result = await deleteAccount();
        if (!result.ok) return { ok: false, error: `${result.error} Nothing was deleted.` };
        return { ok: true, failed: [] };
    }
    const report = await deleteAllLocalData();
    return { ok: true, failed: report.ok ? [] : report.failed.map(step => step.label) };
}

/** After deleting: back to the very first screen (a reload, else navigation). */
export async function startOver(): Promise<void> {
    const { restartAfterDeletion } = require('./accountDeletion') as typeof import('./accountDeletion');
    if (!(await restartAfterDeletion())) (require('expo-router') as typeof import('expo-router')).router.replace('/(auth)/onboarding');
}

/** Whether what was typed confirms it: the @username, any case, with or without the @. */
export const confirmsDeletion = (typed: string, username: string): boolean =>
    !!username && typed.trim().replace(/^@/, '').toLowerCase() === username.trim().replace(/^@/, '').toLowerCase();
