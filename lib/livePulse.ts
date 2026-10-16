import { getSupabase } from './supabase';

/**
 * Friends see your day change while they are looking at it.
 *
 * Two halves. When something changes here (a habit ticked, a task done), the
 * change is backed up a few seconds later — it used to wait for the app to
 * come back to the foreground, so friends saw this morning's numbers all day —
 * and then each friend's phone is pinged on its own Realtime channel. A phone
 * that is pinged reloads its Community tab from the server.
 *
 * The ping carries nothing but "something changed": what a friend may see is
 * still decided by the database, never by this message.
 */

const SETTLE_MS = 2500;
let timer: ReturnType<typeof setTimeout> | null = null;

const channelFor = (userId: string) => `pulse:${userId}`;

async function context() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    const me = data.session?.user?.id;
    return me ? { sb, me } : null;
}

async function friendIds(sb: NonNullable<ReturnType<typeof getSupabase>>, me: string): Promise<string[]> {
    const { data } = await sb.from('friendships').select('user_id, friend_id')
        .is('deleted_at', null).or(`user_id.eq.${me},friend_id.eq.${me}`);
    return (data ?? []).map((row: any) => (row.user_id === me ? row.friend_id : row.user_id));
}

async function publish(): Promise<void> {
    const ctx = await context();
    if (!ctx) return;
    try {
        const { syncNow } = require('./cloudSync') as typeof import('./cloudSync');
        await syncNow();
    } catch {
        return;
    }
    const friends = await friendIds(ctx.sb, ctx.me).catch(() => []);
    await Promise.all(friends.map(async friend => {
        const channel = ctx.sb.channel(channelFor(friend));
        try {
            // Broadcast over HTTP: no need to join a channel just to say one thing.
            await channel.httpSend('changed', { from: ctx.me });
        } catch {
            // Their phone catches up on its next refresh.
        } finally {
            void ctx.sb.removeChannel(channel);
        }
    }));
}

/** Something on this phone changed that friends can see. Bursts collapse into one. */
export function announceChange(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void publish(); }, SETTLE_MS);
}

/** Calls back when a friend's day changes. Returns the way to stop. */
export async function listenToFriends(onChange: (friendId: string) => void): Promise<() => void> {
    const ctx = await context();
    if (!ctx) return () => undefined;
    const channel = ctx.sb.channel(channelFor(ctx.me))
        .on('broadcast', { event: 'changed' }, message => {
            const from = (message.payload as { from?: string } | undefined)?.from;
            if (from && from !== ctx.me) onChange(from);
        })
        .subscribe();
    return () => { void ctx.sb.removeChannel(channel); };
}
