import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateId, getDatabase } from './database';

/**
 * Deleting something shared ends the share, for both of you.
 *
 * A shared habit or task is one row on the server, the owner's, and each of
 * you keeps a copy with the owner's id (lib/sharedAdopt.ts). So:
 *
 *   - Whoever deletes it closes every share row they are on (owner: all of
 *     them; guest: their own), so the other person's copy is no longer shared
 *     with them, and their faces leave it.
 *   - A guest's delete stays on their phone. Uploading it would delete the
 *     owner's row, and so the owner's habit, on their next sync.
 *   - The person left with it keeps it as their own: once the share has gone,
 *     their copy is given an id of its own (with its ticks and progress), so
 *     it backs up under their account instead of writing to a row they can no
 *     longer reach.
 *
 * Offline, the closing is queued and sent before the next shared refresh, so
 * a deleted item is never pulled back in from a share that still looked open.
 */
export type ShareKind = 'habit' | 'task';

/** Ids of habits and tasks shared with you that are on this phone, by kind. */
const ADOPTED_KEY = 'habyss_adopted_shares';
/** Shares to close that could not be closed yet (offline). */
const PENDING_KEY = 'habyss_share_endings';

type Adopted = Record<ShareKind, string[]>;
const empty = (): Adopted => ({ habit: [], task: [] });

async function readJson<T>(key: string, fallback: T): Promise<T> {
    try { const raw = await AsyncStorage.getItem(key); return raw ? { ...fallback, ...JSON.parse(raw) } : fallback; }
    catch { return fallback; }
}
const readAdopted = () => readJson<Adopted>(ADOPTED_KEY, empty());
const writeAdopted = (value: Adopted) => AsyncStorage.setItem(ADOPTED_KEY, JSON.stringify(value)).catch(() => undefined);

/** Remembers that this phone holds a copy of something shared with you. */
export async function rememberAdopted(kind: ShareKind, id: string): Promise<void> {
    const adopted = await readAdopted();
    if (adopted[kind].includes(id)) return;
    await writeAdopted({ ...adopted, [kind]: [...adopted[kind], id] });
}

/** Whether this copy is somebody else's row on the server (shared with you). */
export async function isAdopted(kind: ShareKind, id: string): Promise<boolean> {
    return (await readAdopted())[kind].includes(id);
}

/** Closes the shares on this item you are part of; queued when it cannot be sent now. */
export async function endShares(kind: ShareKind, id: string): Promise<void> {
    const { FriendsService } = require('./friendsService') as typeof import('./friendsService');
    const ok = await FriendsService.closeShares(kind, id).catch(() => false);
    if (ok) return;
    const pending = await readJson<{ list: { kind: ShareKind; id: string }[] }>(PENDING_KEY, { list: [] });
    if (!pending.list.some(item => item.kind === kind && item.id === id)) {
        await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ list: [...pending.list, { kind, id }] })).catch(() => undefined);
    }
}

/** Sends the closings that were queued offline. True when none are left. */
export async function flushShareEndings(): Promise<boolean> {
    const pending = await readJson<{ list: { kind: ShareKind; id: string }[] }>(PENDING_KEY, { list: [] });
    if (!pending.list.length) return true;
    const { FriendsService } = require('./friendsService') as typeof import('./friendsService');
    const left: { kind: ShareKind; id: string }[] = [];
    for (const item of pending.list) if (!(await FriendsService.closeShares(item.kind, item.id).catch(() => false))) left.push(item);
    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ list: left })).catch(() => undefined);
    return left.length === 0;
}

/**
 * After a shared refresh: the copies whose share has gone become your own.
 * `active` is every habit and task id still shared with you. Returns the ids
 * that were given new ones (old → new).
 */
export async function keepEndedCopies(active: Record<ShareKind, string[]>, userId: string): Promise<Record<string, string>> {
    const adopted = await readAdopted();
    const db = await getDatabase();
    const moved: Record<string, string> = {};
    if (!db) return moved;
    const now = new Date().toISOString();
    const next: Adopted = { habit: [...new Set([...active.habit])], task: [...new Set([...active.task])] };
    for (const kind of ['habit', 'task'] as const) {
        const table = kind === 'habit' ? 'habits' : 'tasks';
        for (const id of adopted[kind]) {
            if (active[kind].includes(id)) continue;
            const row = await db.getFirstAsync(`SELECT id FROM ${table} WHERE id = ? AND deleted = 0`, id).catch(() => null);
            if (!row) continue;
            const fresh = generateId();
            await db.withTransactionAsync(async () => {
                await db.runAsync(`UPDATE ${table} SET id = ?, user_id = ?, synced = 0, updated_at = ? WHERE id = ?`, fresh, userId, now, id);
                if (kind === 'habit') {
                    // Its ticks and progress come with it, under its new id.
                    await db.runAsync(
                        `UPDATE completions SET habit_id = ?, id = ? || '_' || date, synced = 0, updated_at = ? WHERE habit_id = ? AND user_id = ?`,
                        fresh, fresh, now, id, userId,
                    );
                    await db.runAsync('UPDATE habit_measurements SET habit_id = ? WHERE habit_id = ? AND user_id = ?', fresh, id, userId).catch(() => undefined);
                }
            });
            moved[id] = fresh;
        }
    }
    await writeAdopted(next);
    return moved;
}
