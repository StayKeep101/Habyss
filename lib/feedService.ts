import { getSupabase } from './supabase';
import type { DayCardData } from './dayCard';
import type { PresenceFacts } from './presence';
import { asReaction, type Reaction } from './reactions';

/**
 * The Community feed, friends' status and the leaderboard, on the server.
 *
 * What a friend may see is decided by the database (supabase/migrations/
 * 20261016000200_community_feed.sql): posts follow each person's sharing
 * switches, and everything here is only ever about you and your friends —
 * except the world leaderboard, which shows only people who share progress.
 */

/** How long a day card stays in the feed after it is posted. */
const FEED_LIFETIME_MS = 24 * 60 * 60 * 1000;

interface Context { sb: NonNullable<ReturnType<typeof getSupabase>>; me: string }

async function signedIn(): Promise<Context | null> {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    const me = data.session?.user?.id;
    return me ? { sb, me } : null;
}

export interface FeedPost {
    userId: string;
    day: string;
    postedAt: string;
    card: DayCardData;
    name: string;
    username: string;
    avatarUrl?: string;
    ackCount: number;
    ackedByMe: boolean;
    ackUsers: string[];
    /** Your reaction to it (lib/reactions.ts), or null. */
    myReaction: Reaction | null;
    /** How many of each reaction it got. */
    reactions: Partial<Record<Reaction, number>>;
    /** Who gave which, by their id: read apart from the feed (FeedService.reactionsBy). */
    byUser?: Record<string, Reaction>;
    mine: boolean;
}

export interface LeaderRow {
    rank: number;
    userId: string;
    name: string;
    username: string;
    avatarUrl?: string;
    marks: number;
    isMe: boolean;
}

export interface FriendStatusRow extends PresenceFacts {
    userId: string;
    name: string;
    username: string;
    avatarUrl?: string;
    /** Whose focus session they joined (lib/focusTogether.ts), while it runs. */
    focusWith: string | null;
    /** Their session has no end (a stopwatch); focusUntil is only a placeholder then. */
    focusOpen: boolean;
}

const nameOf = (row: { display_name?: string | null; username?: string | null }) =>
    row.display_name?.trim() || row.username || 'Friend';

export class FeedService {
    static async me(): Promise<string | null> {
        return (await signedIn())?.me ?? null;
    }

    /**
     * A page of the feed, newest first: each person's latest posted day only,
     * a new card taking the place of the one before, and only for the 24 hours
     * after it was posted (20261028000400). Pass the
     * last post's time for the next page, or a user for all their days.
     */
    static async feed(before?: string, limit = 20, userId?: string): Promise<FeedPost[]> {
        const ctx = await signedIn();
        if (!ctx) return [];
        const { data, error } = await ctx.sb.rpc('community_feed', { p_before: before ?? null, p_limit: limit, p_user: userId ?? null });
        if (error) { console.warn('[Feed] could not load:', error.message); return []; }
        const posts: FeedPost[] = ((data as any[]) ?? []).map(row => ({
            userId: row.user_id,
            day: row.day,
            postedAt: row.posted_at,
            card: row.card as DayCardData,
            name: nameOf(row),
            username: row.username ?? '',
            avatarUrl: row.avatar_url ?? undefined,
            ackCount: row.ack_count ?? 0,
            ackedByMe: !!row.acked_by_me,
            ackUsers: row.ack_users ?? [],
            // A server without reactions yet: an acknowledgement is the plain one.
            myReaction: row.my_reaction ? asReaction(row.my_reaction) : row.acked_by_me ? 'proud' : null,
            reactions: row.reactions && typeof row.reactions === 'object' ? row.reactions : (row.ack_count ? { proud: row.ack_count } : {}),
            mine: row.user_id === ctx.me,
        }));
        // A card is in the feed for the 24 hours after it is posted, then it leaves; a profile keeps every day.
        return userId ? posts : posts.filter(post => Date.now() - new Date(post.postedAt).getTime() < FEED_LIFETIME_MS);
    }

    /**
     * Who gave which reaction to each of these days, by post: `day:<user>:<day>`
     * (the stream's key) → reacting user → reaction. Read from the reactions
     * themselves (friends may read them), so community_feed keeps its shape
     * for the desktop app.
     */
    static async reactionsBy(posts: Pick<FeedPost, 'userId' | 'day'>[]): Promise<Record<string, Record<string, Reaction>>> {
        const ctx = await signedIn();
        if (!ctx || !posts.length) return {};
        const users = [...new Set(posts.map(post => post.userId))];
        const days = [...new Set(posts.map(post => post.day))];
        const { data, error } = await ctx.sb.from('post_acknowledgements').select('post_user, post_day, from_user, reaction')
            .in('post_user', users).in('post_day', days);
        if (error) return {};
        const out: Record<string, Record<string, Reaction>> = {};
        for (const row of (data as { post_user: string; post_day: string; from_user: string; reaction: string | null }[]) ?? []) {
            const key = `day:${row.post_user}:${row.post_day}`;
            (out[key] ??= {})[row.from_user] = asReaction(row.reaction);
        }
        return out;
    }

    /** Reacts to a friend's day, or changes your reaction to it. */
    static async acknowledge(post: Pick<FeedPost, 'userId' | 'day'>, reaction: Reaction = 'proud'): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const row = { post_user: post.userId, post_day: post.day, from_user: ctx.me };
        // Insert, then change it if one is there: only `reaction` may be updated
        // (column grant), so an upsert, which updates every column, was refused
        // and every reaction used to land as the plain one.
        const made = await ctx.sb.from('post_acknowledgements').insert({ ...row, reaction });
        if (!made.error) return true;
        if (made.error.code !== '23505') return false;
        const changed = await ctx.sb.from('post_acknowledgements').update({ reaction })
            .eq('post_user', post.userId).eq('post_day', post.day).eq('from_user', ctx.me);
        return !changed.error;
    }

    static async unacknowledge(post: Pick<FeedPost, 'userId' | 'day'>): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const { error } = await ctx.sb.from('post_acknowledgements').delete()
            .eq('post_user', post.userId).eq('post_day', post.day).eq('from_user', ctx.me);
        return !error;
    }

    /**
     * Writes today's card. It keeps updating after it is posted, so friends'
     * numbers stay current all evening and the post shows how the day ended.
     */
    static async publishDayCard(day: string, card: DayCardData): Promise<'saved' | 'failed'> {
        const ctx = await signedIn();
        if (!ctx) return 'failed';
        const { error } = await ctx.sb.from('day_cards')
            .upsert({ user_id: ctx.me, day, card, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' });
        return error ? 'failed' : 'saved';
    }

    /**
     * The board: your friends, or your league — everyone in the same rank band
     * (pass the band's Marks range, from lib/marks.ts).
     */
    static async leaderboard(scope: 'friends' | 'league', band?: { min: number; max: number | null }): Promise<LeaderRow[]> {
        const ctx = await signedIn();
        if (!ctx) return [];
        const { data, error } = await ctx.sb.rpc('leaderboard', {
            p_scope: scope, p_min: band?.min ?? null, p_max: band?.max ?? null,
        });
        if (error) { console.warn('[Leaderboard] could not load:', error.message); return []; }
        return ((data as any[]) ?? []).map(row => ({
            rank: Number(row.rank),
            userId: row.user_id,
            name: nameOf(row),
            username: row.username ?? '',
            avatarUrl: row.avatar_url ?? undefined,
            marks: row.marks ?? 0,
            isMe: !!row.is_me,
        }));
    }

    static async friendStatuses(): Promise<FriendStatusRow[]> {
        const ctx = await signedIn();
        if (!ctx) return [];
        const { data, error } = await ctx.sb.rpc('friend_presence');
        if (error) { console.warn('[Status] could not load:', error.message); return []; }
        return ((data as any[]) ?? []).map(row => ({
            userId: row.user_id,
            name: nameOf(row),
            username: row.username ?? '',
            avatarUrl: row.avatar_url ?? undefined,
            presence: row.presence === 'live' ? 'live' : 'away',
            presenceAt: row.presence_at ?? null,
            focusUntil: row.focus_until ?? null,
            focusLabel: row.focus_label ?? null,
            timezone: row.timezone ?? null,
            wakeTime: row.wake_time ?? null,
            sleepTime: row.sleep_time ?? null,
            focusWith: row.focus_with ?? null,
            focusOpen: !!row.focus_open,
        }));
    }

    /** Writes this phone's status facts onto your profile. */
    static async setStatus(patch: {
        presence?: 'live' | 'away';
        focusUntil?: string | null;
        /** When the running session's ring began (its end less its length), so a friend who joins starts their ring there too. */
        focusSince?: string | null;
        focusLabel?: string | null;
        timezone?: string;
        wakeTime?: string;
        sleepTime?: string;
    }): Promise<void> {
        const ctx = await signedIn();
        if (!ctx) return;
        const row: Record<string, unknown> = {};
        if (patch.presence) { row.presence = patch.presence; row.presence_at = new Date().toISOString(); }
        if (patch.focusUntil !== undefined) row.focus_until = patch.focusUntil;
        if (patch.focusLabel !== undefined) row.focus_label = patch.focusLabel?.slice(0, 80) ?? null;
        if (patch.timezone) row.timezone = patch.timezone;
        if (patch.wakeTime) row.wake_time = patch.wakeTime;
        if (patch.sleepTime) row.sleep_time = patch.sleepTime;
        if (Object.keys(row).length) await ctx.sb.from('profiles').update(row).eq('id', ctx.me);
        // Apart, so a server without the column yet still gets the rest.
        if (patch.focusSince !== undefined) await ctx.sb.from('profiles').update({ focus_since: patch.focusSince }).eq('id', ctx.me).then(() => undefined, () => undefined);
    }

    /** When a friend's running session began (see setStatus), or null when it is not known. */
    static async focusSince(userId: string): Promise<number | null> {
        const ctx = await signedIn();
        if (!ctx) return null;
        const { data, error } = await ctx.sb.from('profiles').select('focus_since').eq('id', userId).maybeSingle();
        const at = !error && data?.focus_since ? new Date(data.focus_since).getTime() : NaN;
        return Number.isFinite(at) ? at : null;
    }

    static async shareSettings(): Promise<{ time: string; enabled: boolean } | null> {
        const ctx = await signedIn();
        if (!ctx) return null;
        const { data } = await ctx.sb.rpc('my_settings');
        const row = (data as any[])?.[0];
        return row ? { time: String(row.share_time).slice(0, 5), enabled: !!row.share_enabled } : null;
    }

    static async setShareSettings(change: { time?: string; enabled?: boolean }): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const row: Record<string, unknown> = {};
        if (change.time) row.share_time = change.time;
        if (change.enabled !== undefined) row.share_enabled = change.enabled;
        const { error } = await ctx.sb.from('profiles').update(row).eq('id', ctx.me);
        return !error;
    }
}
