import { getSupabase } from './supabase';
import { localDateKey } from './habitSchedule';
import type { DayCardData } from './dayCard';
import type { ChatMessage, StoredDayCard } from './chatThread';

/**
 * Messages between friends, and the day cards that appear in those chats.
 *
 * Everything is checked by the database (supabase/migrations/20261015_chat.sql):
 * you can only write to a friend, never across a block, and a friend sees your
 * day card only as far as your sharing switches allow.
 */

interface Context { sb: NonNullable<ReturnType<typeof getSupabase>>; me: string }

async function signedIn(): Promise<Context | null> {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    const me = data.session?.user?.id;
    return me ? { sb, me } : null;
}

const toMessage = (row: any): ChatMessage => ({
    id: row.id, fromUser: row.from_user, toUser: row.to_user, body: row.body,
    createdAt: row.created_at, readAt: row.read_at,
});

const toCard = (row: any): StoredDayCard => ({
    userId: row.user_id, day: row.day, card: row.card as DayCardData, updatedAt: row.updated_at,
});

/** How far back a chat reaches when it opens. */
const DAYS_BACK = 30;

const sinceDay = () => {
    const date = new Date();
    date.setDate(date.getDate() - DAYS_BACK);
    return localDateKey(date);
};

const messageListeners = new Set<(message: ChatMessage) => void>();
let stopMessages: (() => void) | null = null;
let openingMessages: Promise<void> | null = null;

async function openMessages(): Promise<void> {
    const ctx = await signedIn();
    if (!ctx) return;
    const channel = ctx.sb.channel(`messages:${ctx.me}`)
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_user=eq.${ctx.me}` },
            payload => { const message = toMessage(payload.new); messageListeners.forEach(listener => listener(message)); })
        .subscribe();
    stopMessages = () => { void ctx.sb.removeChannel(channel); };
}

export class ChatService {
    static async me(): Promise<string | null> {
        return (await signedIn())?.me ?? null;
    }

    /** One chat: the messages both ways and both people's day cards. */
    static async thread(friendId: string): Promise<{ me: string; name: string; messages: ChatMessage[]; cards: StoredDayCard[] } | null> {
        const ctx = await signedIn();
        if (!ctx) return null;
        const since = sinceDay();
        const [messages, mine, theirs, person] = await Promise.all([
            ctx.sb.from('messages').select('id, from_user, to_user, body, created_at, read_at')
                .or(`and(from_user.eq.${ctx.me},to_user.eq.${friendId}),and(from_user.eq.${friendId},to_user.eq.${ctx.me})`)
                .order('created_at', { ascending: false }).limit(200),
            ctx.sb.from('day_cards').select('user_id, day, card, updated_at').eq('user_id', ctx.me).gte('day', since),
            ctx.sb.rpc('friend_day_cards', { p_friend: friendId, p_since: since }),
            ctx.sb.from('profiles').select('username, display_name').eq('id', friendId).maybeSingle(),
        ]);
        return {
            me: ctx.me,
            name: person.data?.display_name?.trim() || person.data?.username || '',
            messages: (messages.data ?? []).map(toMessage).reverse(),
            cards: [...(mine.data ?? []), ...((theirs.data as any[]) ?? [])].map(toCard),
        };
    }

    /** The newest message with each friend, and how many from them are unread. */
    static async conversations(): Promise<Record<string, { last: ChatMessage; unread: number }>> {
        const ctx = await signedIn();
        if (!ctx) return {};
        const { data } = await ctx.sb.from('messages').select('id, from_user, to_user, body, created_at, read_at')
            .or(`from_user.eq.${ctx.me},to_user.eq.${ctx.me}`)
            .order('created_at', { ascending: false }).limit(500);
        const out: Record<string, { last: ChatMessage; unread: number }> = {};
        for (const row of data ?? []) {
            const message = toMessage(row);
            const friend = message.fromUser === ctx.me ? message.toUser : message.fromUser;
            const entry = out[friend] ?? (out[friend] = { last: message, unread: 0 });
            if (message.toUser === ctx.me && !message.readAt) entry.unread += 1;
        }
        return out;
    }

    static async send(friendId: string, body: string): Promise<ChatMessage | null> {
        const ctx = await signedIn();
        const text = body.trim().slice(0, 2000);
        if (!ctx || !text) return null;
        const { data, error } = await ctx.sb.from('messages')
            .insert({ from_user: ctx.me, to_user: friendId, body: text })
            .select('id, from_user, to_user, body, created_at, read_at').single();
        if (error) { console.warn('[Chat] Could not send:', error.message); return null; }
        return toMessage(data);
    }

    static async remove(messageId: string): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const { error } = await ctx.sb.from('messages').delete().eq('id', messageId).eq('from_user', ctx.me);
        return !error;
    }

    static async markRead(friendId: string): Promise<void> {
        const ctx = await signedIn();
        if (!ctx) return;
        await ctx.sb.from('messages').update({ read_at: new Date().toISOString() })
            .eq('from_user', friendId).eq('to_user', ctx.me).is('read_at', null);
    }

    /** Writes today's card. One row per day, replaced as the day goes on. */
    static async publishDayCard(day: string, card: DayCardData): Promise<boolean> {
        const ctx = await signedIn();
        if (!ctx) return false;
        const { error } = await ctx.sb.from('day_cards')
            .upsert({ user_id: ctx.me, day, card, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' });
        return !error;
    }

    /**
     * New messages sent to this account, live. Returns the way to stop.
     * One channel is shared by every screen listening; your own messages come
     * back from `send`.
     */
    static async listen(onMessage: (message: ChatMessage) => void): Promise<() => void> {
        messageListeners.add(onMessage);
        if (!stopMessages) {
            openingMessages ??= openMessages().finally(() => { openingMessages = null; });
            await openingMessages;
        }
        return () => {
            messageListeners.delete(onMessage);
            if (messageListeners.size === 0 && stopMessages) { stopMessages(); stopMessages = null; }
        };
    }
}
