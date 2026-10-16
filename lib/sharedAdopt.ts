import { getSupabase } from './supabase';
import { getDatabase } from './database';
import { habitToLocal, taskToLocal } from './cloudMapping';
import { emit } from './appEvents';

/**
 * Taking on something a friend offered.
 *
 * Accepting used to change a row's status and nothing else, so the habit you
 * had just said yes to appeared nowhere — no list, no roadmap, no reminder. It
 * is the only step that makes a share mean anything.
 *
 * **The rule, and it is deliberate: one arrangement, two records.**
 *
 * The item is copied onto your device **with the owner's id**, not a fresh one.
 * That id is what both sides publish completions against — `shared_completions`
 * is keyed by it — so keeping it is what makes the two ticks the same tick. A
 * new id would give you a private habit that merely looked like theirs.
 *
 * You own your copy the way you own everything else on your phone: it syncs to
 * your account, it can be skipped, it can be archived. And it is one row on
 * the server, not two: an edit either of you makes — a cover photo, a reminder,
 * a new task in a shared goal — is uploaded to that row and read back by the
 * other on their next sync (see `pullShared` in cloudSync). One row is what
 * keeps the two from drifting; last edit wins, as on any shared document.
 */

type Kind = 'habit' | 'task' | 'goal';

/** Whether the local row already exists, whatever state it is in. */
async function alreadyHere(table: 'habits' | 'tasks', id: string): Promise<boolean> {
    const db = await getDatabase();
    if (!db) return true;
    const found = await db.getFirstAsync(`SELECT id FROM ${table} WHERE id = ?`, id) as { id?: string } | null;
    return !!found?.id;
}

/**
 * Copies an accepted item onto this device.
 *
 * Quiet about failure: the share is already accepted on the server, and the
 * next sync will bring the row down anyway. Returns whether anything landed, so
 * the caller can tell somebody their list has changed.
 */
export async function adoptShared(kind: Kind, itemId: string): Promise<boolean> {
    const sb = getSupabase();
    if (!sb) return false;
    const { data: session } = await sb.auth.getSession();
    const me = session.session?.user?.id;
    if (!me) return false;

    const table = kind === 'task' ? 'tasks' : 'habits';
    if (await alreadyHere(table, itemId)) return false;

    // Readable because the share was accepted: `can_view_habit` opens the
    // owner's row to whoever is on it. Before accepting, this returns nothing,
    // which is the right order for it to happen in.
    const { data: row } = await sb.from(table).select('*').eq('id', itemId).maybeSingle();
    if (!row) return false;

    const db = await getDatabase();
    if (!db) return false;

    // Stored under your own user id. It is your copy of the arrangement, and a
    // row carrying somebody else's user id would never sync and never be yours.
    const local = kind === 'task'
        // Your copy starts open: finishing it is your part, not the owner's.
        ? { ...taskToLocal(row as never), user_id: me, status: 'open', completed_at: null, amount: null }
        : { ...habitToLocal(row as never), user_id: me };

    const columns = Object.keys(local);
    await db.runAsync(
        `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}, synced, deleted) VALUES (${columns.map(() => '?').join(', ')}, 0, 0)`,
        ...columns.map(name => (local as Record<string, unknown>)[name] ?? null),
    );

    emit(kind === 'task' ? 'tasks_changed' : 'habit_updated', {});
    // A goal is its plan: its habits and tasks come with it, now rather than
    // on the next backup, so the goal is not empty the moment it is accepted.
    if (kind === 'goal') {
        const { refreshShared } = require('./cloudSync') as typeof import('./cloudSync');
        await refreshShared().catch(() => 0);
    }
    return true;
}

/**
 * Giving back something you accepted.
 *
 * Removes your copy only. The owner keeps theirs, because it was always theirs
 * — leaving an arrangement is not deleting somebody else's habit.
 */
export async function dropShared(kind: Kind, itemId: string): Promise<void> {
    const db = await getDatabase();
    if (!db) return;
    const table = kind === 'task' ? 'tasks' : 'habits';
    // Marked synced: leaving is said on the share row. Uploading the deletion
    // would delete the owner's row now that participants may edit it.
    await db.runAsync(
        `UPDATE ${table} SET deleted = 1, updated_at = ?, synced = 1 WHERE id = ?`,
        new Date().toISOString(), itemId,
    );
    emit(kind === 'task' ? 'tasks_changed' : 'habit_updated', {});
}

/**
 * Who may change what a shared thing *is*: everybody on it.
 *
 * A shared goal is a plan two people are carrying out together, so either of
 * them can add to it, retime it or give it a picture, and the other sees it.
 * Ownership of the row never moves (the server keeps `user_id`), so deleting a
 * goal stays with whoever made it; everyone else leaves instead.
 */
export function canEditShared(_ownerId: string | undefined, _me: string | undefined): boolean {
    return true;
}
