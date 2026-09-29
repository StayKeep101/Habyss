import { getSupabase } from './supabase';
import { localDateKey } from './habitSchedule';
import { earnedForDay } from './ember';
import { type Pact } from './pact';
import type { Evidence } from './proof';

/**
 * The embers and the pacts, as the server holds them.
 *
 * Every number here comes back from the server and none of it is worked out
 * twice. The phone decides what a day was *worth* — it is the only thing that
 * knows which habits were due and how they were evidenced — and the server
 * decides what anybody actually *has*, which is the only division that makes a
 * balance worth trusting.
 */

interface Context { sb: NonNullable<ReturnType<typeof getSupabase>>; me: string }

async function signedIn(): Promise<Context | null> {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    const me = data.session?.user?.id;
    return me ? { sb, me } : null;
}

export interface LedgerLine {
    id: string;
    amount: number;
    reason: 'kept' | 'staked' | 'returned' | 'won' | 'opening';
    createdAt: string;
}

export const Embers = {
    /** What you have, summed from the ledger rather than read off a column. */
    async balance(): Promise<number> {
        const ctx = await signedIn();
        if (!ctx) return 0;
        const { data, error } = await ctx.sb.rpc('ember_balance');
        return error ? 0 : Number(data ?? 0);
    },

    /** Where it came from and where it went. */
    async ledger(limit = 40): Promise<LedgerLine[]> {
        const ctx = await signedIn();
        if (!ctx) return [];
        const { data } = await ctx.sb.from('ember_ledger')
            .select('id, amount, reason, created_at')
            .order('created_at', { ascending: false }).limit(limit);
        return (data ?? []).map((row: any) => ({
            id: row.id, amount: row.amount, reason: row.reason, createdAt: row.created_at,
        }));
    },

    /** The first balance, handed out once, by the server. */
    async claimOpening(): Promise<number> {
        const ctx = await signedIn();
        if (!ctx) return 0;
        const { data, error } = await ctx.sb.rpc('claim_opening');
        return error ? 0 : Number(data ?? 0);
    },

    /**
     * Pays for a day that has been kept.
     *
     * Safe to call as often as you like: the ledger has one line per person per
     * day, so the second call is arithmetic rather than a second payment. That
     * is what lets this run on every app open without any bookkeeping here.
     */
    async claimDay(day: string, kept: { evidence: Evidence; streak?: number }[]): Promise<number> {
        const ctx = await signedIn();
        if (!ctx) return 0;
        const amount = earnedForDay(kept);
        if (amount <= 0) return this.balance();
        const { data, error } = await ctx.sb.rpc('claim_day', { p_day: day, p_amount: amount });
        return error ? 0 : Number(data ?? 0);
    },

    /* ----------------------------------------------------------------- pacts */

    /** Offering one. Nothing is staked until they accept. */
    async offer(input: {
        toUserId: string;
        itemId: string;
        itemType: 'habit' | 'task' | 'goal';
        itemName: string;
        stake: number;
        deadline: string;
    }): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const { error } = await ctx.sb.from('pacts').insert({
            item_id: input.itemId, item_type: input.itemType, item_name: input.itemName,
            from_user: ctx.me, to_user: input.toUserId,
            // Both sides put up the same. An uneven pact is a loan with extra
            // steps, and it is the equality that makes it a promise.
            from_stake: input.stake, to_stake: input.stake,
            deadline: input.deadline, status: 'offered',
        });
        return !error;
    },

    /** Saying yes. This is where both stakes leave both balances. */
    async accept(pactId: string): Promise<'live' | 'short' | 'they_are_short' | 'gone'> {
        const ctx = await signedIn();
        if (!ctx) return 'gone';
        const { data, error } = await ctx.sb.rpc('accept_pact', { p_pact: pactId });
        return error ? 'gone' : (data as 'live' | 'short' | 'they_are_short' | 'gone');
    },

    async cancel(pactId: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const { error } = await ctx.sb.rpc('cancel_pact', { p_pact: pactId });
        return !error;
    },

    /**
     * Settles anything of yours whose day has gone, and returns how many.
     *
     * Called on opening the tab. Safe from both phones at once — the row is
     * locked and the ledger could not pay twice even if it were not.
     */
    async settleDue(): Promise<number> {
        const ctx = await signedIn();
        if (!ctx) return 0;
        const { data, error } = await ctx.sb.rpc('settle_due_pacts');
        return error ? 0 : Number(data ?? 0);
    },

    /**
     * Your pacts, written from where you are standing.
     *
     * `mine` is always you, whichever end you are — the settlement rules are
     * symmetric and the interface should not make the reader work out which
     * half of the row they are.
     */
    async list(): Promise<Pact[]> {
        const ctx = await signedIn();
        if (!ctx) return [];

        const { data } = await ctx.sb.from('pacts')
            .select('id, item_id, item_type, item_name, from_user, to_user, from_stake, to_stake, deadline, status, outcome, created_at')
            .in('status', ['offered', 'live', 'settled'])
            .order('created_at', { ascending: false }).limit(40);
        const rows = data ?? [];
        if (rows.length === 0) return [];

        const ids = [...new Set(rows.flatMap((row: any) => [row.from_user, row.to_user]))];
        const { data: people } = await ctx.sb.from('profiles').select('id, username, avatar_url').in('id', ids);
        const named = new Map((people ?? []).map((row: any) => [row.id, row]));

        // Who has actually done the thing, for every item any pact is about.
        const items = [...new Set(rows.map((row: any) => row.item_id))];
        const { data: done } = await ctx.sb.from('shared_completions')
            .select('user_id, item_id, day').in('item_id', items);
        const keptBy = new Set((done ?? []).map((row: any) => `${row.user_id}:${row.item_id}:${row.day}`));
        const keptOnOrBefore = (userId: string, itemId: string, deadline: string) =>
            (done ?? []).some((row: any) => row.user_id === userId && row.item_id === itemId && row.day <= deadline);

        const today = localDateKey(new Date());
        return rows.map((row: any) => {
            const iAmFrom = row.from_user === ctx.me;
            const meId = iAmFrom ? row.from_user : row.to_user;
            const themId = iAmFrom ? row.to_user : row.from_user;
            const side = (userId: string, stake: number, isYou: boolean) => ({
                userId,
                username: isYou ? 'you' : named.get(userId)?.username ?? 'friend',
                avatarUrl: named.get(userId)?.avatar_url ?? undefined,
                stake,
                // A settled pact says what the record said; a live one says
                // whether it has been done for today.
                kept: row.status === 'settled'
                    ? (row.outcome === 'both' || row.outcome === (userId === row.from_user ? 'from' : 'to'))
                    : keptBy.has(`${userId}:${row.item_id}:${today}`) || keptOnOrBefore(userId, row.item_id, row.deadline),
            });

            return {
                id: row.id,
                itemId: row.item_id,
                itemType: row.item_type,
                itemName: row.item_name,
                status: row.status,
                deadline: row.deadline,
                mine: side(meId, iAmFrom ? row.from_stake : row.to_stake, true),
                theirs: side(themId, iAmFrom ? row.to_stake : row.from_stake, false),
                offeredByMe: iAmFrom,
                createdAt: row.created_at,
            } satisfies Pact;
        });
    },
};
