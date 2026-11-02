import { getSupabase } from './supabase';
import { emit } from './appEvents';

/**
 * Duels (supabase/migrations/20261102000100_duels.sql): you against one
 * friend for 3, 7 or 14 days, on who keeps their own plan better (the share
 * of what each had to do, from the day cards; ties go to more days shown up,
 * then it's a draw). An optional stake of up to 100 Shards each: the winner
 * takes both. The server holds the stakes, scores and settles; this file only
 * asks it, and says the score the way the cards show it.
 */

export type DuelStatus = 'proposed' | 'active' | 'declined' | 'cancelled' | 'settled';

export interface Duel {
    id: string;
    /** You challenged them. */
    mine: boolean;
    friendId: string;
    name: string;
    avatarUrl?: string;
    stake: number;
    days: number;
    starts: string | null;
    ends: string | null;
    status: DuelStatus;
    winnerId: string | null;
    me: Score;
    them: Score;
}
export interface Score { done: number; total: number; days: number }

export const DUEL_LENGTHS = [3, 7, 14] as const;
export const DUEL_STAKES = [0, 25, 50, 100] as const;

/** A score as a share of their own plan, 0 to 1 (nothing planned is 0). */
export const shareOf = (score: Score): number => (score.total > 0 ? score.done / score.total : 0);

/** Who is ahead right now, as the server will decide it: share, then days shown up. */
export function leader(duel: Pick<Duel, 'me' | 'them'>): 'me' | 'them' | 'even' {
    const mine = shareOf(duel.me), theirs = shareOf(duel.them);
    if (mine !== theirs) return mine > theirs ? 'me' : 'them';
    if (duel.me.days !== duel.them.days) return duel.me.days > duel.them.days ? 'me' : 'them';
    return 'even';
}

/** The days left in a running duel, counting today, from its last day. */
export function daysLeft(ends: string | null, today = new Date()): number {
    if (!ends) return 0;
    const end = new Date(`${ends}T00:00:00`);
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

async function client() {
    const sb = getSupabase();
    if (!sb) throw new Error('Connect to Habyss to duel friends.');
    const { data } = await sb.auth.getSession();
    if (!data.session) throw new Error('Sign in to duel friends.');
    return { sb, me: data.session.user.id };
}

const toScore = (done: unknown, total: unknown, days: unknown): Score => ({ done: Number(done) || 0, total: Number(total) || 0, days: Number(days) || 0 });

export async function myDuels(): Promise<Duel[]> {
    const { sb } = await client();
    const { data, error } = await sb.rpc('my_duels');
    if (error) throw new Error('Duels could not load. Please try again.');
    return ((data as any[]) ?? []).map(row => ({
        id: row.id, mine: !!row.mine, friendId: row.friend_id,
        name: row.display_name || row.username || 'Friend', avatarUrl: row.avatar_url ?? undefined,
        stake: Number(row.stake) || 0, days: Number(row.days) || 7, starts: row.starts, ends: row.ends,
        status: row.status, winnerId: row.winner_id,
        me: toScore(row.my_done, row.my_total, row.my_days), them: toScore(row.their_done, row.their_total, row.their_days),
    }));
}

/** Why the server said no, in its own words (it says them plainly), or a fallback. */
const reason = (error: { message?: string } | null, fallback: string) => new Error(error?.message && !/function|schema|relation/i.test(error.message) ? error.message : fallback);

export async function createDuel(friendId: string, stake: number, days: number): Promise<void> {
    const { sb } = await client();
    const { error } = await sb.rpc('create_duel', { p_friend: friendId, p_stake: stake, p_days: days });
    if (error) throw reason(error, 'The duel could not be sent. Please try again.');
    emit('market_changed');
}

export async function respondDuel(id: string, accept: boolean): Promise<void> {
    const { sb } = await client();
    const { error } = await sb.rpc('respond_duel', { p_duel: id, p_accept: accept });
    if (error) throw reason(error, 'That didn’t go through. Please try again.');
    emit('market_changed');
}

export async function cancelDuel(id: string): Promise<void> {
    const { sb } = await client();
    const { error } = await sb.rpc('cancel_duel', { p_duel: id });
    if (error) throw reason(error, 'That didn’t go through. Please try again.');
    emit('market_changed');
}
