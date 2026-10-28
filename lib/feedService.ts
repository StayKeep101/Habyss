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
     * a new card taking the place of the one before (20261028000300). Pass the
     * last post's time for the next page, or a user for all their days.
     */
    static async feed(before?: string, limit = 20, userId?: string): Promise<FeedPost[]> {
        const ctx = await signedIn();
        if (!ctx) return [];
        const { data, error } = await ctx.sb.rpc('community_feed', { p_before: before ?? null, p_limit: limit, p_user: userId ?? null });
        if (error) { console.warn('[Feed] could not load:', error.message); return []; }
        return ((data as any[]) ?? []).map(row => ({
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
    }

    /** Reacts to a friend's day, or changes your reaction to it. */
    static async acknowledge(post: Pick<FeedPost, 'userId' | 'day'>, reaction: Reaction = 'proud'): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const row = { post_user: post.userId, post_day: post.day, from_user: ctx.me };
        const { error } = await ctx.sb.from('post_acknowledgements')
            .upsert({ ...row, reaction }, { onConflict: 'post_user,post_day,from_user' });
        if (!error) return true;
        // A server without reactions yet: the plain acknowledgement.
        const plain = await ctx.sb.from('post_acknowledgements').insert(row);
        return !plain.error || plain.error.code === '23505';
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
        if (Object.keys(row).length === 0) return;
        await ctx.sb.from('profiles').update(row).eq('id', ctx.me);
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
