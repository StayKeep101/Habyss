import { getSupabase } from './supabase';

/**
 * Emoji on each card of a day (supabase/migrations/20261122000300_card_reactions.sql):
 * friends put one emoji each on any card; everyone who can see the day sees
 * the counts. Read when a day is opened, nothing kept on the phone.
 */
export const CARD_EMOJI = ['🔥', '💪', '👏', '😮', '😂', '❤️'] as const;

/** By card: each emoji's count, and which one is yours. */
export type CardReactions = Record<string, { counts: Record<string, number>; mine: string | null }>;

async function client() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    return data.session?.user?.id ? { sb, me: data.session.user.id } : null;
}

export async function cardReactions(userId: string, day: string): Promise<CardReactions> {
    const ctx = await client();
    if (!ctx) return {};
    const { data, error } = await ctx.sb.rpc('card_reactions_for', { p_user: userId, p_day: day });
    if (error || !Array.isArray(data)) return {};
    const out: CardReactions = {};
    for (const row of data as { card_key: string; emoji: string; total: number; mine: boolean }[]) {
        const card = (out[row.card_key] ??= { counts: {}, mine: null });
        card.counts[row.emoji] = Number(row.total) || 0;
        if (row.mine) card.mine = row.emoji;
    }
    return out;
}

/** Puts your emoji on a card, or takes it back (null). */
export async function reactToCard(userId: string, day: string, card: string, emoji: string | null): Promise<boolean> {
    const ctx = await client();
    if (!ctx) return false;
    const { error } = await ctx.sb.rpc('react_card', { p_user: userId, p_day: day, p_card: card, p_emoji: emoji });
    return !error;
}

/** The reactions after you change yours, before the server says so (shown at once). */
export function withMine(state: CardReactions, card: string, emoji: string | null): CardReactions {
    const before = state[card] ?? { counts: {}, mine: null };
    const counts = { ...before.counts };
    if (before.mine) counts[before.mine] = Math.max(0, (counts[before.mine] ?? 1) - 1);
    if (emoji) counts[emoji] = (counts[emoji] ?? 0) + 1;
    for (const key of Object.keys(counts)) if (!counts[key]) delete counts[key];
    return { ...state, [card]: { counts, mine: emoji } };
}
