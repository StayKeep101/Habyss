import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabase } from './supabase';
import { localDateKey } from './habitSchedule';

/** Which habits and tasks are shared, cached so a tick costs no network call. */
const SHARED_IDS_KEY = 'habyss_shared_item_ids';

/**
 * Friends, backed by real accounts.
 *
 * This used to be a local simulation with three invented people (aurora, milo
 * and nova) and made-up activity. That was harmless while there was no real
 * social feature, but with accounts it would let someone try to befriend a
 * person who does not exist. Friends are now other Habyss accounts, found by
 * username, and nothing is shown to someone who is not signed in.
 *
 * What friends can see of each other is decided on the server:
 * - numbers only, through friend_stats(): logged today, the week, the streak;
 * - a habit or goal in full only once its owner shares it with them.
 *
 * The public API is unchanged, so the screens built on it keep working.
 */

export type ReactionType = 'fire' | 'clap' | 'heart' | 'star' | 'muscle';

export interface Friend {
    id: string;
    userId: string;
    username: string;
    email?: string;
    avatarUrl?: string;
    streak?: number;
    currentStreak?: number;
    bestStreak?: number;
    todayCompleted?: number;
    todayCompletion?: number;
    todayTotal?: number;
    weeklyActivity?: number[];
    /** How today's check-ins were evidenced: 'verified' | 'context' | 'self'. */
    todayEvidence?: string[];
    isCurrentUser?: boolean;
}

export interface FriendRequest {
    id: string;
    fromUserId: string;
    fromUsername: string;
    fromAvatarUrl?: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
}

/** One thing waiting in your inbox. */
export interface InboxItem {
    id: string;
    kind: 'friend_request' | 'friend_accepted' | 'nudge';
    title: string;
    body: string;
    read: boolean;
    createdAt: string;
    fromUserId?: string;
    fromUsername?: string;
    fromAvatarUrl?: string;
    /** Present only while the request is still open, and answerable. */
    requestId?: string;
}

/** A note on somebody's day, as the server holds it. */
export interface DayComment {
    id: string;
    author: string;
    toUser: string;
    day: string;
    body: string;
    createdAt: string;
    /** Written by you: only your own can be taken back. */
    mine: boolean;
    authorName?: string;
}

export interface FriendActivity {
    id: string;
    userId: string;
    username: string;
    type: string;
    message: string;
    createdAt: string;
    reactions?: Record<string, number>;
}

/* -------------------------------------------------------------------------- */
/*  Plumbing                                                                   */
/* -------------------------------------------------------------------------- */

interface Context { sb: NonNullable<ReturnType<typeof getSupabase>>; me: string }

/** The signed-in context, or null when there is no account to act as. */
async function signedIn(): Promise<Context | null> {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    const me = data.session?.user?.id;
    return me ? { sb, me } : null;
}

interface StatsRow {
    user_id: string;
    username: string | null;
    avatar_url: string | null;
    today_done: number;
    active_habits: number;
    week_done: number[];
    current_streak: number;
    /** How each of today's check-ins was evidenced; absent on older servers. */
    today_evidence?: string[] | null;
}

async function stats(ctx: Context): Promise<StatsRow[]> {
    const { data, error } = await ctx.sb.rpc('friend_stats', { p_today: localDateKey(new Date()) });
    if (error) {
        console.warn('[Friends] stats unavailable:', error.message);
        return [];
    }
    return (data ?? []) as StatsRow[];
}

/** Share of active habits logged, as a percentage the charts expect. */
const percent = (done: number, active: number) =>
    active > 0 ? Math.min(100, Math.round((done / active) * 100)) : 0;

function toFriend(row: StatsRow, me: string): Friend {
    return {
        id: row.user_id,
        userId: row.user_id,
        username: row.username ?? 'New member',
        avatarUrl: row.avatar_url ?? undefined,
        streak: row.current_streak,
        currentStreak: row.current_streak,
        bestStreak: row.current_streak,
        todayCompleted: row.today_done,
        todayTotal: row.active_habits,
        todayCompletion: percent(row.today_done, row.active_habits),
        // The charts read these as percentages of the day, not raw counts.
        weeklyActivity: (row.week_done ?? []).map(done => percent(done, row.active_habits)),
        // Narrowed here rather than trusted: this is the only place the server's
        // strings become the app's three, and anything else reads as self.
        todayEvidence: (row.today_evidence ?? []).map(value =>
            value === 'verified' || value === 'context' ? value : 'self'),
        isCurrentUser: row.user_id === me,
    };
}

/** Your own handle, for a notification written in the second person. */
async function myName(ctx: Context): Promise<string> {
    const { data } = await ctx.sb.from('profiles').select('username').eq('id', ctx.me).maybeSingle();
    return data?.username ?? 'Someone';
}

async function profiles(ctx: Context, ids: string[]) {
    const unique = [...new Set(ids.filter(Boolean))];
    if (unique.length === 0) return new Map<string, { username: string | null; avatar_url: string | null }>();
    const { data } = await ctx.sb.from('profiles').select('id, username, avatar_url').in('id', unique);
    return new Map((data ?? []).map((row: any) => [row.id, row]));
}

/** Habit rows the server returns, in the shape the app's views read. */
function toHabit(row: any) {
    return {
        id: row.id,
        name: row.name,
        description: row.description ?? undefined,
        icon: row.icon ?? undefined,
        color: row.color ?? '#6B46C1',
        category: row.category ?? 'personal',
        isGoal: !!row.is_goal,
        goalId: row.goal_id ?? undefined,
        goalValue: Number(row.goal_value ?? 1),
        unit: row.unit ?? 'count',
        trackingMethod: row.tracking_method === 'boolean' ? 'boolean' : 'numeric',
        targetDate: row.target_date ?? undefined,
        startDate: row.start_date ?? undefined,
        taskDays: Array.isArray(row.task_days) ? row.task_days : [],
        createdAt: row.created_at,
        isArchived: !!row.is_archived,
    };
}

async function friendIds(ctx: Context): Promise<string[]> {
    const { data } = await ctx.sb.from('friendships')
        .select('user_id, friend_id')
        .is('deleted_at', null)
        .or(`user_id.eq.${ctx.me},friend_id.eq.${ctx.me}`);
    return (data ?? []).map((row: any) => (row.user_id === ctx.me ? row.friend_id : row.user_id));
}

/** Makes sure a habit exists on the server before it is shared. */
async function ensureBackedUp(): Promise<void> {
    const { syncNow } = require('./cloudSync');
    await syncNow();
}

/* -------------------------------------------------------------------------- */
/*  Usernames                                                                  */
/* -------------------------------------------------------------------------- */

export const USERNAME_RULE = /^[a-z0-9_.]{3,20}$/;

/**
 * A handle, written the one way it is stored.
 *
 * Lowercase, because @Pen and @pen are plainly meant to be the same person, and
 * without the @ people habitually type in front of one. Everything that reads a
 * username goes through here, and `profiles.username` is now constrained to the
 * same shape — the two disagreeing is exactly what made a scanned QR code for
 * @Pen report that nobody was called @pen.
 */
export const normaliseUsername = (raw: string): string => raw.trim().replace(/^@+/, '').toLowerCase();

export type UsernameResult = { ok: true } | { ok: false; error: string };

export async function getMyUsername(): Promise<string | null> {
    const ctx = await signedIn();
    if (!ctx) return null;
    const { data } = await ctx.sb.from('profiles').select('username').eq('id', ctx.me).maybeSingle();
    return data?.username ?? null;
}

/** Friends find each other by username, so a new account needs one. */
export async function setMyUsername(raw: string): Promise<UsernameResult> {
    const ctx = await signedIn();
    if (!ctx) return { ok: false, error: 'Sign in first.' };
    const username = normaliseUsername(raw);
    if (!USERNAME_RULE.test(username)) {
        return { ok: false, error: '3 to 20 characters: letters, numbers, dots and underscores.' };
    }
    const { data, error } = await ctx.sb.from('profiles').update({ username }).eq('id', ctx.me).select('username').single();
    if (error) {
        return { ok: false, error: error.code === '23505' ? 'That username is taken.' : 'Could not save your username.' };
    }
    if (!data?.username) return { ok: false, error: 'Your profile is not ready yet. Please sign in again.' };
    return { ok: true };
}

/** The link a friend opens to add you; also what the QR code holds. */
export function inviteLink(username: string): string {
    return `habyss://add-friend?u=${encodeURIComponent(username)}`;
}

export function inviteMessage(username: string): string {
    return `Join me on Habyss. Add me as @${username}: ${inviteLink(username)}`;
}

/** Reads a username out of whatever was typed, pasted or scanned. */
export function usernameFrom(input: string): string | null {
    let text = input.trim();
    try {
        const parsed = JSON.parse(text);
        if (parsed && typeof parsed.code === 'string') text = parsed.code;
    } catch { /* not JSON */ }
    const fromLink = text.match(/[?&]u=([^&\s]+)/);
    if (fromLink) {
        // A hand-mangled link can carry a stray percent, which throws here
        // rather than returning anything: a broken invite is not a crash.
        try { text = decodeURIComponent(fromLink[1]); } catch { text = fromLink[1]; }
    }
    const username = normaliseUsername(text);
    return USERNAME_RULE.test(username) ? username : null;
}

export type AddFriendResult =
    | { ok: true; username: string; nowFriends: boolean }
    | { ok: false; error: string };

/**
 * Adds a friend by exact username. Never falls back to a near match: sending a
 * request to the wrong person is worse than saying "not found".
 */
export async function addFriendByUsername(input: string): Promise<AddFriendResult> {
    const ctx = await signedIn();
    if (!ctx) return { ok: false, error: 'Sign in first.' };
    const username = usernameFrom(input);
    if (!username) return { ok: false, error: 'That is not a Habyss username.' };

    const { data: target } = await ctx.sb.from('profiles')
        .select('id, username').eq('username', username).maybeSingle();
    if (!target) return { ok: false, error: `Nobody is called @${username}.` };
    if (target.id === ctx.me) return { ok: false, error: 'That is you.' };

    const sent = await FriendsService.sendFriendRequest(target.id);
    if (!sent) return { ok: false, error: 'Could not send the request. Try again.' };
    const nowFriends = (await friendIds(ctx)).includes(target.id);
    return { ok: true, username, nowFriends };
}

/* -------------------------------------------------------------------------- */
/*  The service                                                                */
/* -------------------------------------------------------------------------- */

export class FriendsService {
    static async isAvailable(): Promise<boolean> {
        return !!(await signedIn());
    }

    static async getCurrentUser(): Promise<Friend | null> {
        const ctx = await signedIn();
        if (!ctx) return null;
        const row = (await stats(ctx)).find(item => item.user_id === ctx.me);
        return row ? toFriend(row, ctx.me) : null;
    }

    static async getFriends(): Promise<Friend[]> {
        const ctx = await signedIn();
        if (!ctx) return [];
        return (await stats(ctx)).filter(row => row.user_id !== ctx.me).map(row => toFriend(row, ctx.me));
    }

    static async getFriendsWithProgress(): Promise<Friend[]> {
        return this.getFriends();
    }

    static async getFriendProfile(friendId: string): Promise<Friend | null> {
        const ctx = await signedIn();
        if (!ctx) return null;
        const row = (await stats(ctx)).find(item => item.user_id === friendId);
        return row ? toFriend(row, ctx.me) : null;
    }

    static async getFriendDetailedStats(friendId: string): Promise<any | null> {
        const ctx = await signedIn();
        if (!ctx) return null;
        const row = (await stats(ctx)).find(item => item.user_id === friendId);
        if (!row) return null;

        // Only what friend_stats exposes; a friend's goals are theirs unless shared.
        const { count } = await ctx.sb.from('shared_goals')
            .select('id', { count: 'exact', head: true })
            .eq('owner_id', friendId).eq('shared_with_id', ctx.me).eq('status', 'accepted');

        return {
            totalHabits: row.active_habits,
            completedToday: row.today_done,
            totalGoals: count ?? 0,
            weeklyActivity: (row.week_done ?? []).map(done => done > 0),
            longestStreak: row.current_streak,
        };
    }

    static async getLeaderboard(_period = 'week'): Promise<{ rank: number; friend: Friend }[]> {
        const ctx = await signedIn();
        if (!ctx) return [];
        const everyone = (await stats(ctx)).map(row => ({
            friend: toFriend(row, ctx.me),
            week: (row.week_done ?? []).reduce((sum, done) => sum + done, 0),
        }));
        return everyone
            .sort((a, b) => b.week - a.week || (b.friend.currentStreak ?? 0) - (a.friend.currentStreak ?? 0))
            .map((entry, index) => ({ rank: index + 1, friend: entry.friend }));
    }

    /* ---------------------------------------------------------------- finding */

    static async searchUsers(query: string): Promise<Friend[]> {
        const ctx = await signedIn();
        const term = normaliseUsername(query);
        if (!ctx || term.length < 2) return [];

        // Escape the pattern characters so a search for "a_b" matches literally.
        const pattern = `${term.replace(/[\\%_]/g, char => `\\${char}`)}%`;
        const { data } = await ctx.sb.from('profiles')
            .select('id, username, avatar_url')
            .ilike('username', pattern)
            .neq('id', ctx.me)
            .limit(20);

        return (data ?? []).map((row: any) => ({
            id: row.id,
            userId: row.id,
            username: row.username,
            avatarUrl: row.avatar_url ?? undefined,
        }));
    }

    /* --------------------------------------------------------------- requests */

    static async sendFriendRequest(userId: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx || userId === ctx.me) return false;

        if ((await friendIds(ctx)).includes(userId)) return true;

        const { data: existing } = await ctx.sb.from('friend_requests')
            .select('id, from_user_id, status')
            .is('deleted_at', null)
            .eq('status', 'pending')
            .or(`and(from_user_id.eq.${ctx.me},to_user_id.eq.${userId}),and(from_user_id.eq.${userId},to_user_id.eq.${ctx.me})`);

        // They already asked us: asking back is the same as saying yes.
        const theirs = (existing ?? []).find((row: any) => row.from_user_id === userId);
        if (theirs) return this.acceptFriendRequest(theirs.id);
        if ((existing ?? []).length > 0) return true;

        const { error } = await ctx.sb.from('friend_requests')
            .insert({ from_user_id: ctx.me, to_user_id: userId, status: 'pending' });
        if (error) return false;

        // The request existing is not the same as the other person being told.
        // Until this, one sat in a table nobody reads unless they happen to
        // open the Community tab.
        await this.notify(ctx, userId, 'friend_request', {
            title: `@${await myName(ctx)} wants to be friends`,
            body: 'Accept or decline from here.',
        });
        return true;
    }

    /**
     * Puts something in somebody's inbox.
     *
     * Deliberately forgiving: a notification that does not save is worse than
     * useless to complain about, because the thing it describes — the request,
     * the acceptance — has already happened and is not being undone for it.
     */
    private static async notify(
        ctx: Context, userId: string, type: 'friend_request' | 'friend_accepted' | 'nudge',
        content: { title: string; body: string },
    ): Promise<boolean> {
        const { error } = await ctx.sb.from('notifications').insert({
            user_id: userId, from_user_id: ctx.me, type, title: content.title, body: content.body,
        });
        if (error) console.warn('[Friends] Could not write the notification:', error.message);
        return !error;
    }

    static async getFriendRequests(): Promise<FriendRequest[]> {
        const ctx = await signedIn();
        if (!ctx) return [];
        const { data } = await ctx.sb.from('friend_requests')
            .select('id, from_user_id, status, created_at')
            .eq('to_user_id', ctx.me)
            .eq('status', 'pending')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        const people = await profiles(ctx, (data ?? []).map((row: any) => row.from_user_id));
        return (data ?? []).map((row: any) => ({
            id: row.id,
            fromUserId: row.from_user_id,
            fromUsername: people.get(row.from_user_id)?.username ?? 'Someone',
            fromAvatarUrl: people.get(row.from_user_id)?.avatar_url ?? undefined,
            status: 'pending' as const,
            createdAt: row.created_at,
        }));
    }

    static async acceptFriendRequest(requestId: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;

        const { data: request } = await ctx.sb.from('friend_requests')
            .select('id, from_user_id, to_user_id')
            .eq('id', requestId).eq('to_user_id', ctx.me).maybeSingle();
        if (!request) return false;

        const { error } = await ctx.sb.from('friend_requests')
            .update({ status: 'accepted' }).eq('id', requestId);
        if (error) return false;

        if (!(await friendIds(ctx)).includes(request.from_user_id)) {
            const { error: linkError } = await ctx.sb.from('friendships')
                .insert({ user_id: ctx.me, friend_id: request.from_user_id });
            if (linkError) return false;
        }

        // The person who asked is the one waiting to hear.
        await this.notify(ctx, request.from_user_id, 'friend_accepted', {
            title: `@${await myName(ctx)} accepted`,
            body: 'You can see each other\u2019s days now.',
        });
        return true;
    }

    static async declineFriendRequest(requestId: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const { error } = await ctx.sb.from('friend_requests')
            .update({ status: 'declined' }).eq('id', requestId).eq('to_user_id', ctx.me);
        return !error;
    }

    static async rejectFriendRequest(requestId: string): Promise<boolean> {
        return this.declineFriendRequest(requestId);
    }

    /** Accepted requests that never became a friendship, from an interrupted accept. */
    static async repairFriendshipsFromAcceptedRequests(): Promise<void> {
        const ctx = await signedIn();
        if (!ctx) return;
        const { data } = await ctx.sb.from('friend_requests')
            .select('from_user_id').eq('to_user_id', ctx.me).eq('status', 'accepted').is('deleted_at', null);
        const linked = new Set(await friendIds(ctx));
        for (const row of data ?? []) {
            if (!linked.has(row.from_user_id)) {
                await ctx.sb.from('friendships').insert({ user_id: ctx.me, friend_id: row.from_user_id });
            }
        }
    }

    static async removeFriend(friendId: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const { error } = await ctx.sb.from('friendships').delete()
            .or(`and(user_id.eq.${ctx.me},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${ctx.me})`);
        return !error;
    }

    /* ----------------------------------------------------------- nudges, feed */

    static async nudgeFriend(friendId: string, username?: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const me = await myName(ctx);
        return this.notify(ctx, friendId, 'nudge', {
            title: `${me} nudged you`,
            body: `${username ? `${username}, ` : ''}keep your streak going today.`,
        });
    }

    /**
     * There is no shared activity feed yet. An empty list is the truth; the old
     * version filled it with invented events.
     */
    static async getFriendsFeed(): Promise<FriendActivity[]> {
        return [];
    }

    static async getFriendActivity(): Promise<FriendActivity[]> {
        return [];
    }

    /* ------------------------------------------------- reacting to a day */

    /**
     * What has been said with a tap, both ways.
     *
     * `mine` is keyed by the person it was aimed at, which is how the feed draws
     * it — one card, one reaction. `received` is keyed by whoever sent it. RLS
     * returns only rows you are one half of, so this asks for both in one go
     * rather than trusting a filter written here.
     */
    static async getDayReactions(day = localDateKey(new Date())): Promise<{
        mine: Record<string, ReactionType>;
        received: Record<string, ReactionType>;
    }> {
        const ctx = await signedIn();
        if (!ctx) return { mine: {}, received: {} };
        const { data, error } = await ctx.sb.from('feed_reactions')
            .select('from_user, to_user, reaction').eq('day', day);
        if (error) return { mine: {}, received: {} };

        const mine: Record<string, ReactionType> = {};
        const received: Record<string, ReactionType> = {};
        for (const row of data ?? []) {
            if (row.from_user === ctx.me) mine[row.to_user] = row.reaction;
            else received[row.from_user] = row.reaction;
        }
        return { mine, received };
    }

    /**
     * One reaction per person per day, so a second one replaces the first.
     *
     * That is the primary key on the table rather than a rule written here: the
     * identity of the act is who, to whom, on what day.
     */
    static async reactToDay(toUserId: string, reaction: ReactionType, day = localDateKey(new Date())): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const { error } = await ctx.sb.from('feed_reactions')
            .upsert({ from_user: ctx.me, to_user: toUserId, day, reaction }, { onConflict: 'from_user,to_user,day' });
        return !error;
    }

    /** Taking it back. A reaction you cannot withdraw is one people hesitate to give. */
    static async clearDayReaction(toUserId: string, day = localDateKey(new Date())): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const { error } = await ctx.sb.from('feed_reactions').delete()
            .eq('from_user', ctx.me).eq('to_user', toUserId).eq('day', day);
        return !error;
    }

    /* ------------------------------------------------ saying something */

    /** Every note on this day that you are allowed to see, by whose day it is. */
    static async getDayComments(day = localDateKey(new Date())): Promise<Record<string, DayComment[]>> {
        const ctx = await signedIn();
        if (!ctx) return {};
        const { data, error } = await ctx.sb.from('feed_comments')
            .select('id, author, to_user, day, body, created_at').eq('day', day)
            .order('created_at', { ascending: true });
        if (error) return {};

        const names = await profiles(ctx, (data ?? []).map((row: any) => row.author));
        const byCard: Record<string, DayComment[]> = {};
        for (const row of data ?? []) {
            const comment: DayComment = {
                id: row.id, author: row.author, toUser: row.to_user, day: row.day,
                body: row.body, createdAt: row.created_at,
                mine: row.author === ctx.me,
                authorName: names.get(row.author)?.username ?? undefined,
            };
            (byCard[row.to_user] ??= []).push(comment);
        }
        return byCard;
    }

    /** Returns the row the server made, so the id it is deleted by is the real one. */
    static async addDayComment(toUserId: string, body: string, day = localDateKey(new Date())): Promise<DayComment | null> {
        const ctx = await signedIn();
        if (!ctx) return null;
        const text = body.trim();
        // The same bounds the table checks, so a hopeless insert is not attempted.
        if (!text || text.length > 500) return null;
        const { data, error } = await ctx.sb.from('feed_comments')
            .insert({ author: ctx.me, to_user: toUserId, day, body: text })
            .select('id, author, to_user, day, body, created_at').single();
        if (error || !data) return null;
        return {
            id: data.id, author: data.author, toUser: data.to_user, day: data.day,
            body: data.body, createdAt: data.created_at, mine: true,
        };
    }

    /** Only your own; the policy enforces it, this only saves a pointless call. */
    static async deleteDayComment(id: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const { error } = await ctx.sb.from('feed_comments').delete().eq('id', id).eq('author', ctx.me);
        return !error;
    }

    /* ---------------------------------------------------------------- inbox */

    /**
     * What is waiting for you.
     *
     * A friend request is carried as the notification it caused *plus* the
     * request it is about, because the two can come apart: the request can be
     * answered on another device, and a notification whose buttons no longer do
     * anything is worse than one that says so.
     */
    static async getInbox(limit = 50): Promise<InboxItem[]> {
        const ctx = await signedIn();
        if (!ctx) return [];

        const [notifications, requests] = await Promise.all([
            ctx.sb.from('notifications')
                .select('id, from_user_id, type, title, body, read, created_at')
                .eq('user_id', ctx.me).is('deleted_at', null)
                .order('created_at', { ascending: false }).limit(limit),
            this.getFriendRequests(),
        ]);

        const pendingFrom = new Map(requests.map(request => [request.fromUserId, request.id]));
        const rows = notifications.data ?? [];
        const people = await profiles(ctx, rows.map((row: any) => row.from_user_id).filter(Boolean));
        const kindOf = (type: string): InboxItem['kind'] =>
            type === 'friend_request' || type === 'friend_accepted' ? type : 'nudge';

        const items: InboxItem[] = rows.map((row: any) => ({
            id: row.id,
            kind: kindOf(row.type),
            title: row.title ?? '',
            body: row.body ?? '',
            read: !!row.read,
            createdAt: row.created_at,
            fromUserId: row.from_user_id ?? undefined,
            fromUsername: row.from_user_id ? people.get(row.from_user_id)?.username ?? undefined : undefined,
            fromAvatarUrl: row.from_user_id ? people.get(row.from_user_id)?.avatar_url ?? undefined : undefined,
            // Only a request that is still open can be answered.
            requestId: row.type === 'friend_request' && row.from_user_id ? pendingFrom.get(row.from_user_id) : undefined,
        }));

        // A request that arrived before any of this existed — or whose
        // notification failed to save — still has to be answerable rather than
        // invisible, so it is shown from the request itself.
        const announced = new Set(items.map(item => item.requestId).filter(Boolean));
        for (const request of requests) {
            if (announced.has(request.id)) continue;
            items.push({
                id: `request:${request.id}`,
                kind: 'friend_request',
                title: `@${request.fromUsername} wants to be friends`,
                body: 'Accept or decline from here.',
                read: false,
                createdAt: request.createdAt,
                fromUserId: request.fromUserId,
                fromUsername: request.fromUsername,
                fromAvatarUrl: request.fromAvatarUrl,
                requestId: request.id,
            });
        }

        return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }

    /** For the badge: what is genuinely waiting, whether or not it was announced. */
    static async unreadCount(): Promise<number> {
        const ctx = await signedIn();
        if (!ctx) return 0;
        const { count } = await ctx.sb.from('notifications').select('id', { count: 'exact', head: true })
            .eq('user_id', ctx.me).eq('read', false).is('deleted_at', null);
        return count ?? 0;
    }

    static async markInboxRead(): Promise<void> {
        const ctx = await signedIn();
        if (!ctx) return;
        await ctx.sb.from('notifications').update({ read: true })
            .eq('user_id', ctx.me).eq('read', false);
    }

    /** Clearing one is a real delete: an inbox nobody can empty is a to-do list. */
    static async dismissNotification(id: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx || id.startsWith('request:')) return false;
        const { error } = await ctx.sb.from('notifications').delete()
            .eq('id', id).eq('user_id', ctx.me);
        return !error;
    }

    /* ------------------------------------------------ blocking, reporting */

    /**
     * Stops somebody, for good and on the server.
     *
     * A block that only stops the interface drawing something is not a block:
     * the row still arrives, and an older build, the next build, or anything
     * reading the API sees it. The policies on `feed_comments`,
     * `feed_reactions`, `friend_requests` and `friendships` all refuse a write
     * between two people where either has blocked the other, and `friend_stats`
     * leaves them out of the feed.
     *
     * The friendship goes too. Leaving it in place while nothing can pass
     * through it is a worse state than not being friends.
     */
    static async blockUser(userId: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx || userId === ctx.me) return false;

        const { error } = await ctx.sb.from('user_blocks')
            .upsert({ blocker: ctx.me, blocked: userId }, { onConflict: 'blocker,blocked' });
        if (error) return false;

        // Best effort, and in this order: the block is what matters, and it is
        // already in place if any of the tidying up fails.
        await Promise.all([
            ctx.sb.from('friendships').delete().eq('user_id', ctx.me).eq('friend_id', userId),
            ctx.sb.from('friendships').delete().eq('user_id', userId).eq('friend_id', ctx.me),
            ctx.sb.from('friend_requests').delete().eq('from_user_id', ctx.me).eq('to_user_id', userId),
            ctx.sb.from('feed_reactions').delete().eq('from_user', ctx.me).eq('to_user', userId),
        ]);
        void this.refreshSharedIds();
        return true;
    }

    static async unblockUser(userId: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const { error } = await ctx.sb.from('user_blocks').delete()
            .eq('blocker', ctx.me).eq('blocked', userId);
        return !error;
    }

    /** Who you have blocked, so there is a screen to undo it from. */
    static async blockedUsers(): Promise<Friend[]> {
        const ctx = await signedIn();
        if (!ctx) return [];
        const { data } = await ctx.sb.from('user_blocks').select('blocked').eq('blocker', ctx.me);
        const ids = (data ?? []).map((row: any) => row.blocked);
        const people = await profiles(ctx, ids);
        return ids.map((id: string) => ({
            id, userId: id,
            username: people.get(id)?.username ?? 'Account',
            avatarUrl: people.get(id)?.avatar_url ?? undefined,
        }));
    }

    /**
     * Reports something to be read by a person.
     *
     * Nothing here decides anything about an account: it is a record that
     * somebody objected, which is what a report should be.
     */
    static async reportContent(input: {
        userId: string;
        kind: 'comment' | 'reaction' | 'profile' | 'other';
        reason: string;
        reference?: string;
    }): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx || input.userId === ctx.me) return false;
        const reason = input.reason.trim().slice(0, 1000);
        if (!reason) return false;
        const { error } = await ctx.sb.from('content_reports').insert({
            reporter: ctx.me, reported_user: input.userId,
            kind: input.kind, reference: input.reference ?? null, reason,
        });
        return !error;
    }

    /* ---------------------------------------------------------------- sharing */

    /**
     * Shares a habit with a friend. They are already mutual friends, so the
     * share is accepted straight away rather than waiting on a second yes.
     */
    static async shareHabitWithFriend(habitId: string, friendId: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        await ensureBackedUp();

        const { data: existing } = await ctx.sb.from('shared_habits').select('id')
            .eq('habit_id', habitId).eq('owner_id', ctx.me).eq('shared_with_id', friendId).is('deleted_at', null);
        if ((existing ?? []).length > 0) return true;

        const { error } = await ctx.sb.from('shared_habits').insert({
            habit_id: habitId, owner_id: ctx.me, shared_with_id: friendId, status: 'accepted',
        });
        if (!error) void this.refreshSharedIds();
        return !error;
    }

    static async unshareHabit(habitId: string, friendId: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const { error } = await ctx.sb.from('shared_habits').delete()
            .eq('habit_id', habitId).eq('owner_id', ctx.me).eq('shared_with_id', friendId);
        if (!error) void this.refreshSharedIds();
        return !error;
    }

    /**
     * Shares a task. Habits and goals could already be shared and tasks could
     * not, which made "we are doing this together" impossible for the one kind
     * of thing that is usually a one-off favour between two people.
     */
    static async shareTaskWithFriend(taskId: string, friendId: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        await ensureBackedUp();

        const { data: existing } = await ctx.sb.from('shared_tasks').select('id')
            .eq('task_id', taskId).eq('owner_id', ctx.me).eq('shared_with_id', friendId).is('deleted_at', null);
        if ((existing ?? []).length > 0) return true;

        const { error } = await ctx.sb.from('shared_tasks').insert({
            task_id: taskId, owner_id: ctx.me, shared_with_id: friendId, status: 'accepted',
        });
        if (!error) void this.refreshSharedIds();
        return !error;
    }

    static async unshareTask(taskId: string, friendId: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const { error } = await ctx.sb.from('shared_tasks').delete()
            .eq('task_id', taskId).eq('owner_id', ctx.me).eq('shared_with_id', friendId);
        if (!error) void this.refreshSharedIds();
        return !error;
    }

    static async getTaskSharedWith(taskId: string): Promise<Friend[]> {
        return this.sharedWith('shared_tasks', 'task_id', taskId);
    }

    static async getHabitSharedWith(habitId: string): Promise<Friend[]> {
        return this.sharedWith('shared_habits', 'habit_id', habitId);
    }

    static async getGoalSharedWith(goalId: string): Promise<Friend[]> {
        return this.sharedWith('shared_goals', 'goal_id', goalId);
    }

    private static async sharedWith(table: string, column: string, itemId: string): Promise<Friend[]> {
        const ctx = await signedIn();
        if (!ctx) return [];
        const { data } = await ctx.sb.from(table).select('shared_with_id')
            .eq(column, itemId).eq('owner_id', ctx.me).is('deleted_at', null);
        const people = await profiles(ctx, (data ?? []).map((row: any) => row.shared_with_id));
        return (data ?? []).map((row: any) => ({
            id: row.shared_with_id,
            userId: row.shared_with_id,
            username: people.get(row.shared_with_id)?.username ?? 'Friend',
            avatarUrl: people.get(row.shared_with_id)?.avatar_url ?? undefined,
        }));
    }

    static async batchShareGoal(goalId: string, friendIds: string[]): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        await ensureBackedUp();

        const current = new Set((await this.getGoalSharedWith(goalId)).map(friend => friend.id));
        const rows = friendIds.filter(id => !current.has(id))
            .map(id => ({ goal_id: goalId, owner_id: ctx.me, shared_with_id: id, status: 'accepted' }));
        if (rows.length === 0) return true;
        const { error } = await ctx.sb.from('shared_goals').insert(rows);
        return !error;
    }

    static async batchUnshareGoal(goalId: string, friendIds: string[]): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx || friendIds.length === 0) return !!ctx;
        const { error } = await ctx.sb.from('shared_goals').delete()
            .eq('goal_id', goalId).eq('owner_id', ctx.me).in('shared_with_id', friendIds);
        return !error;
    }

    static async getHabitsSharedWithMe(): Promise<any[]> {
        return this.sharedWithMe('shared_habits', 'habit_id', 'habit');
    }

    static async getGoalsSharedWithMe(): Promise<any[]> {
        return this.sharedWithMe('shared_goals', 'goal_id', 'goal');
    }

    private static async sharedWithMe(table: string, column: string, key: 'habit' | 'goal'): Promise<any[]> {
        const ctx = await signedIn();
        if (!ctx) return [];
        const { data: shares } = await ctx.sb.from(table).select(`${column}, owner_id`)
            .eq('shared_with_id', ctx.me).eq('status', 'accepted').is('deleted_at', null);
        if (!shares?.length) return [];

        const ids = shares.map((row: any) => row[column]);
        const [{ data: items }, people] = await Promise.all([
            ctx.sb.from('habits').select('*').in('id', ids).is('deleted_at', null),
            profiles(ctx, shares.map((row: any) => row.owner_id)),
        ]);
        const byId = new Map((items ?? []).map((row: any) => [row.id, row]));

        return shares
            .filter((share: any) => byId.has(share[column]))
            .map((share: any) => {
                const owner = people.get(share.owner_id);
                return {
                    [key]: toHabit(byId.get(share[column])),
                    owner: {
                        id: share.owner_id,
                        userId: share.owner_id,
                        username: owner?.username ?? 'Friend',
                        avatarUrl: owner?.avatar_url ?? undefined,
                    } as Friend,
                };
            });
    }

    static async getSharedItemParticipants(itemId: string, itemType: string = 'habit'): Promise<any[]> {
        const ctx = await signedIn();
        if (!ctx) return [];
        const table = itemType === 'goal' ? 'shared_goals' : itemType === 'task' ? 'shared_tasks' : 'shared_habits';
        const column = itemType === 'goal' ? 'goal_id' : itemType === 'task' ? 'task_id' : 'habit_id';

        const { data } = await ctx.sb.from(table).select('owner_id, shared_with_id')
            .eq(column, itemId).eq('status', 'accepted').is('deleted_at', null);
        const ids = new Set<string>([ctx.me]);
        let ownerId = ctx.me;
        for (const row of data ?? []) {
            ids.add(row.owner_id);
            ids.add(row.shared_with_id);
            ownerId = row.owner_id;
        }

        const day = localDateKey(new Date());
        // Who finished *this* item today. Until `shared_completions` existed the
        // only available answer was "did they do anything today", which called a
        // friend done because they had ticked something else.
        const { data: finished, error } = await ctx.sb.from('shared_completions')
            .select('user_id').eq('item_id', itemId).eq('day', day);
        const exact = !error;
        const doneIds = new Set((finished ?? []).map((row: any) => row.user_id));

        // Only as a fallback, and only when the exact answer was unavailable.
        const rows = exact ? [] : await stats(ctx);
        const people = await profiles(ctx, [...ids]);
        return [...ids].map(id => {
            const row = rows.find(item => item.user_id === id);
            return {
                userId: id,
                username: people.get(id)?.username ?? 'Friend',
                avatarUrl: people.get(id)?.avatar_url ?? undefined,
                completedToday: exact ? doneIds.has(id) : (row?.today_done ?? 0) > 0,
                /** Whether this person has published a completion for this item. */
                exactCompletion: exact,
                /** Who shared it. Not the same as you, and not interchangeable. */
                isOwner: id === ownerId,
                isYou: id === ctx.me,
            };
        });
    }

    /* --------------------------------------------- shared, item by item */

    /**
     * The ids of every habit and task you are on with somebody, kept locally.
     *
     * Completions are published only for these, so ticking an ordinary habit
     * costs no network call at all. The list is refreshed whenever a share is
     * made or withdrawn and whenever the community tab loads, which is every
     * moment it can change for you.
     */
    static async refreshSharedIds(): Promise<string[]> {
        const ctx = await signedIn();
        if (!ctx) return [];
        const mine = `owner_id.eq.${ctx.me},shared_with_id.eq.${ctx.me}`;
        const [habits, tasks] = await Promise.all([
            ctx.sb.from('shared_habits').select('habit_id').eq('status', 'accepted').is('deleted_at', null).or(mine),
            ctx.sb.from('shared_tasks').select('task_id').eq('status', 'accepted').is('deleted_at', null).or(mine),
        ]);
        const ids = [
            ...(habits.data ?? []).map((row: any) => row.habit_id),
            ...(tasks.data ?? []).map((row: any) => row.task_id),
        ].filter(Boolean);
        try { await AsyncStorage.setItem(SHARED_IDS_KEY, JSON.stringify(ids)); } catch { /* cache only */ }
        return ids;
    }

    /** The cached list. Empty is a safe answer: nothing gets published. */
    static async sharedIds(): Promise<Set<string>> {
        try {
            const raw = await AsyncStorage.getItem(SHARED_IDS_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return new Set(Array.isArray(parsed) ? parsed.filter((id: unknown) => typeof id === 'string') : []);
        } catch {
            return new Set();
        }
    }

    /**
     * Tells the people sharing an item that you have done it.
     *
     * The row carries its evidence, so "waiting on Sam" and "Sam's run was
     * recorded" come from the same place. Only what you did: the insert policy
     * is `auth.uid() = user_id`, so this cannot speak for anyone else.
     */
    static async publishCompletion(
        itemId: string, itemType: 'habit' | 'task' | 'goal', day: string, evidence?: string | null,
    ): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const { error } = await ctx.sb.from('shared_completions').upsert(
            { user_id: ctx.me, item_id: itemId, item_type: itemType, day, evidence: evidence ?? null },
            { onConflict: 'user_id,item_id,day' },
        );
        return !error;
    }

    /** Taking it back, when a completion is undone. */
    static async withdrawCompletion(itemId: string, day: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const { error } = await ctx.sb.from('shared_completions').delete()
            .eq('user_id', ctx.me).eq('item_id', itemId).eq('day', day);
        return !error;
    }

    static async acceptShareRequest(type: string, itemId: string, ownerId: string): Promise<boolean> {
        return this.answerShare(type, itemId, ownerId, 'accepted');
    }

    static async declineShareRequest(type: string, itemId: string, ownerId: string): Promise<boolean> {
        return this.answerShare(type, itemId, ownerId, 'declined');
    }

    private static async answerShare(type: string, itemId: string, ownerId: string, status: 'accepted' | 'declined') {
        const ctx = await signedIn();
        if (!ctx) return false;
        const table = type === 'goal' ? 'shared_goals' : 'shared_habits';
        const column = type === 'goal' ? 'goal_id' : 'habit_id';
        const { error } = await ctx.sb.from(table).update({ status })
            .eq(column, itemId).eq('owner_id', ownerId).eq('shared_with_id', ctx.me);
        return !error;
    }
}
