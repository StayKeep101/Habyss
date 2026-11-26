import { getSupabase } from './supabase';

/**
 * Your Shards on the server: the ledger of stakes, payouts, refunds and
 * unlocks (races, duels, challenges, unlocking apps), what you can spend, and
 * what is left of today's stake. The server keeps the balance and checks it;
 * this file only asks it.
 */

async function client() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.user?.id ? { sb, me: data.session.user.id } : null;
}

/** The server's reasons, as the wallet lists them: a challenge's reward and Habyss's match on a race are payouts. */
const asReason = (reason: unknown): LedgerEntry['reason'] =>
    reason === 'stake' || reason === 'refund' || reason === 'unlock' ? reason : 'payout';

export interface LedgerEntry { amount: number; reason: 'stake' | 'payout' | 'refund' | 'unlock'; at: string; title: string }

/**
 * 500 Shards a day to put at stake, across races, bets on races and duels
 * (supabase/migrations/20261125000100_daily_stake.sql): use them or not,
 * there are 500 again tomorrow. Never everything you have on one race.
 */
export const DAILY_STAKE = 500;

/**
 * What the server's ledger holds for you: the total, what is in play, what the
 * server lets you spend, what is left of today's 500 to stake, and the latest entries.
 */
export async function myWallet(): Promise<{ ledger: number; inPlay: number; spendable: number | null; stakeLeft: number | null; entries: LedgerEntry[] }> {
    const ctx = await client();
    if (!ctx) return { ledger: 0, inPlay: 0, spendable: null, stakeLeft: null, entries: [] };
    const [totals, rows, today] = await Promise.all([
        ctx.sb.rpc('my_wallet'), ctx.sb.rpc('my_ledger', { p_limit: 100 }),
        // Unknown (null) on a server without the daily budget yet.
        Promise.resolve(ctx.sb.rpc('my_stake_today')).catch(() => ({ data: null, error: true })),
    ]);
    const total = Array.isArray(totals.data) ? totals.data[0] : totals.data;
    const left = today.error || today.data === null || today.data === undefined ? null : Number(today.data);
    return {
        ledger: Number(total?.ledger) || 0,
        inPlay: Number(total?.in_play) || 0,
        spendable: total?.spendable === undefined || total?.spendable === null ? null : Number(total.spendable),
        stakeLeft: left !== null && Number.isFinite(left) ? Math.max(0, left) : null,
        entries: Array.isArray(rows.data) ? rows.data.map((row: Record<string, unknown>) => ({
            amount: Number(row.amount) || 0, reason: asReason(row.reason), at: String(row.created_at), title: String(row.title ?? 'A bet'),
        })) : [],
    };
}
