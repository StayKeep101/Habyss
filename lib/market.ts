import { getSupabase } from './supabase';
import { emit } from './appEvents';

/**
 * The market (supabase/migrations/20261028000600_shards_market.sql): Shards put
 * on whether a friend makes their goal by its deadline. The server keeps the
 * stakes, checks every balance and pays out; this file only asks it, and
 * works out what a stake would pay so the sheet can say so before you bet.
 *
 * A shared pool: the winning side gets its stakes back plus the losing side's
 * Shards in proportion to what each put in (rounded down, as the server does).
 * If nobody took the other side, everyone is refunded.
 */

export type Side = 'make' | 'miss';
export type MarketStatus = 'open' | 'won' | 'missed' | 'void';

export interface Market {
    id: string;
    ownerId: string;
    name: string;
    avatarUrl?: string;
    goalKey: string;
    title: string;
    icon?: string;
    color?: string;
    deadline: string;
    status: MarketStatus;
    pool: Record<Side, number>;
    people: Record<Side, number>;
    mine: boolean;
    myStake: { side: Side; amount: number; payout: number | null } | null;
}

/** The amounts offered in the bet sheet; 100 in all is the most one person can put on one goal. */
export const STAKES = [10, 25, 50, 100] as const;
export const MAX_STAKE = 100;

/** What a stake on this side would return if that side wins, with the pool as it stands plus this stake. */
export function payoutFor(stake: number, side: Side, pool: Record<Side, number>, already = 0): number {
    const mine = already + stake;
    const winners = pool[side] + stake;
    const losers = pool[side === 'make' ? 'miss' : 'make'];
    if (mine <= 0) return 0;
    if (losers === 0) return mine;
    return mine + Math.floor((losers * mine) / winners);
}

/** How a settled market went for you, in Shards: positive won, negative lost, zero refunded. */
export const resultFor = (market: Market): number | null =>
    market.myStake && market.myStake.payout !== null ? market.myStake.payout - market.myStake.amount : null;

async function client() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.user?.id ? { sb, me: data.session.user.id } : null;
}

/** Your goals and your friends' that are open to bets, or settled this week. */
export async function marketFeed(): Promise<Market[]> {
    const ctx = await client();
    if (!ctx) return [];
    const { data, error } = await ctx.sb.rpc('market_feed');
    if (error || !Array.isArray(data)) return [];
    return data.map((row: Record<string, unknown>) => ({
        id: String(row.id),
        ownerId: String(row.owner_id),
        name: String(row.display_name || row.username || 'Friend'),
        avatarUrl: (row.avatar_url as string) || undefined,
        goalKey: String(row.goal_key),
        title: String(row.title),
        icon: (row.icon as string) || undefined,
        color: (row.color as string) || undefined,
        deadline: String(row.deadline),
        status: row.status as MarketStatus,
        pool: { make: Number(row.make_total) || 0, miss: Number(row.miss_total) || 0 },
        people: { make: Number(row.backers) || 0, miss: Number(row.doubters) || 0 },
        mine: row.owner_id === ctx.me,
        myStake: row.my_side ? { side: row.my_side as Side, amount: Number(row.my_amount) || 0, payout: row.my_payout === null || row.my_payout === undefined ? null : Number(row.my_payout) } : null,
    }));
}

/** Opens one of your goals to bets. Throws with a sentence fit to show. */
export async function openMarket(goal: { id: string; name: string; icon?: string; color?: string; targetDate: string }): Promise<void> {
    const ctx = await client();
    if (!ctx) throw new Error('Sign in to open a goal to bets.');
    const { error } = await ctx.sb.rpc('open_market', {
        p_goal_key: goal.id, p_title: goal.name, p_icon: goal.icon ?? null,
        p_color: /^#[0-9A-Fa-f]{6}$/.test(goal.color ?? '') ? goal.color : null, p_deadline: goal.targetDate,
    });
    if (error) throw new Error(error.message);
    emit('market_changed');
}

/** Puts Shards on a side. Throws with the server's sentence (not enough Shards, closed…). */
export async function placeStake(marketId: string, side: Side, amount: number): Promise<void> {
    const ctx = await client();
    if (!ctx) throw new Error('Sign in to bet.');
    const { error } = await ctx.sb.rpc('place_stake', { p_market: marketId, p_side: side, p_amount: amount });
    if (error) throw new Error(error.message);
    emit('market_changed');
}

/** Called when one of your goals is reached (won) or given up (not won). Never throws. */
export async function settleMarketFor(goalId: string, won: boolean): Promise<void> {
    try {
        const ctx = await client();
        if (!ctx) return;
        await ctx.sb.rpc('settle_market', { p_goal_key: goalId, p_won: won });
        emit('market_changed');
    } catch { /* a goal is reached regardless */ }
}

export interface LedgerEntry { amount: number; reason: 'stake' | 'payout' | 'refund' | 'unlock'; at: string; title: string }

/** What bets have moved in your wallet: the total, what is in play, what the server lets you spend, and the latest entries. */
export async function myWallet(): Promise<{ ledger: number; inPlay: number; spendable: number | null; entries: LedgerEntry[] }> {
    const ctx = await client();
    if (!ctx) return { ledger: 0, inPlay: 0, spendable: null, entries: [] };
    const [totals, rows] = await Promise.all([ctx.sb.rpc('my_wallet'), ctx.sb.rpc('my_ledger', { p_limit: 100 })]);
    const total = Array.isArray(totals.data) ? totals.data[0] : totals.data;
    return {
        ledger: Number(total?.ledger) || 0,
        inPlay: Number(total?.in_play) || 0,
        spendable: total?.spendable === undefined || total?.spendable === null ? null : Number(total.spendable),
        entries: Array.isArray(rows.data) ? rows.data.map((row: Record<string, unknown>) => ({
            amount: Number(row.amount) || 0, reason: row.reason as LedgerEntry['reason'], at: String(row.created_at), title: String(row.title ?? 'A bet'),
        })) : [],
    };
}
