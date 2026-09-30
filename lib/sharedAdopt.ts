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
 * your account, it can be skipped, it can be archived. What you cannot do is
 * change what it *is* — see `canEditShared` — because the definition belongs to
 * whoever offered it, and two people quietly editing one arrangement is how
 * both end up doing different things while believing they are doing the same.
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
        ? { ...taskToLocal(row as never), user_id: me }
        : { ...habitToLocal(row as never), user_id: me };

    const columns = Object.keys(local);
    await db.runAsync(
        `INSERT OR IGNORE INTO ${table} (${columns.join(', ')}, synced, deleted) VALUES (${columns.map(() => '?').join(', ')}, 0, 0)`,
        ...columns.map(name => (local as Record<string, unknown>)[name] ?? null),
    );

    emit(kind === 'task' ? 'tasks_changed' : 'habit_updated', {});
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
    await db.runAsync(
        `UPDATE ${table} SET deleted = 1, updated_at = ?, synced = 0 WHERE id = ?`,
        new Date().toISOString(), itemId,
    );
    emit(kind === 'task' ? 'tasks_changed' : 'habit_updated', {});
}

/**
 * Who may change what a shared thing *is*.
 *
 * Only the person who offered it. The rule exists because the alternative has
 * no good answer: if both sides can edit, then one of them moves the habit to
 * 7am and the other is late for something they never agreed to, or — worse —
 * the two copies drift and both people believe they are doing the same thing
 * while doing different ones. There is no merge that fixes a disagreement about
 * what the habit is.
 *
 * Everyone can still *do* it, skip it, and leave it. Those are statements about
 * your own day, and nobody else's.
 *
 * An item nobody else is on is yours by definition, so this says yes.
 */
export function canEditShared(ownerId: string | undefined, me: string | undefined): boolean {
    if (!ownerId || !me) return true;
    return ownerId === me;
}
