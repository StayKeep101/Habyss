import { getSupabase } from './supabase';

/**
 * The conversation under a friend's day (feed_comments, 20261103000100).
 *
 * Everyone who can see the day reads its thread: the owner and the owner's
 * friends. Replies sit one level under a comment. Your own words can be
 * edited or taken back; the day's owner can remove anything on their day.
 * Each comment takes one emoji reaction per person. The server tells the
 * owner, the person replied to and anyone @mentioned.
 *
 * The pure parts (threading, the best replies, @mentions) are here so they
 * are tested; the rest is a thin layer over the table.
 */

export const COMMENT_EMOJI = ['🔥', '👏', '😂', '💪', '❤️', '👀'] as const;
export type CommentEmoji = (typeof COMMENT_EMOJI)[number];
/** The table's own bound. */
export const MAX_COMMENT = 500;

export interface Comment {
    id: string;
    author: string;
    authorName: string;
    authorUsername?: string;
    authorAvatar?: string;
    toUser: string;
    day: string;
    parentId: string | null;
    body: string;
    createdAt: string;
    editedAt: string | null;
    mine: boolean;
    reactions: Partial<Record<CommentEmoji, number>>;
    myReaction: CommentEmoji | null;
}

export interface Thread { comment: Comment; replies: Comment[] }

/** Whose day a thread is under: the same key a day post has in the feed. */
export const threadKey = (toUser: string, day: string) => `day:${toUser}:${day}`;

/* ------------------------------------------------------------- pure parts */

/** Comments as threads: oldest first, each reply under what it answers. A reply whose comment is gone stands on its own. */
export function threadsOf(comments: Comment[]): Thread[] {
    const byTime = [...comments].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const top = new Map<string, Thread>();
    const order: Thread[] = [];
    for (const comment of byTime) {
        if (!comment.parentId) {
            const thread = { comment, replies: [] };
            top.set(comment.id, thread);
            order.push(thread);
        }
    }
    for (const comment of byTime) {
        if (!comment.parentId) continue;
        const parent = top.get(comment.parentId);
        if (parent) parent.replies.push(comment);
        else order.push({ comment, replies: [] });
    }
    return order;
}

const reactionTotal = (comment: Comment) => Object.values(comment.reactions).reduce((sum, n) => sum + (n ?? 0), 0);

/**
 * The comments worth showing on the card itself: the most reacted to, then
 * the most replied to, then the newest. Top-level only, so each reads alone.
 */
export function bestComments(comments: Comment[], count = 2): Comment[] {
    const threads = threadsOf(comments);
    return threads
        .map(thread => ({ comment: thread.comment, score: reactionTotal(thread.comment) * 3 + thread.replies.length }))
        .sort((a, b) => b.score - a.score || b.comment.createdAt.localeCompare(a.comment.createdAt))
        .slice(0, count)
        .map(item => item.comment);
}

/** The @word being typed at the cursor, if any: what to suggest friends for. */
export function mentionAt(text: string, cursor: number): { query: string; start: number } | null {
    const before = text.slice(0, cursor);
    const match = before.match(/(^|\s)@([A-Za-z0-9_.]{0,30})$/);
    if (!match) return null;
    return { query: match[2], start: cursor - match[2].length - 1 };
}

/** Puts @username in place of the @word being typed, with a space after it. */
export function insertMention(text: string, start: number, cursor: number, username: string): { text: string; cursor: number } {
    const inserted = `@${username} `;
    return { text: text.slice(0, start) + inserted + text.slice(cursor), cursor: start + inserted.length };
}

/** A comment's words in pieces, the @mentions marked, so they can be drawn in cobalt. */
export function splitMentions(body: string): { text: string; mention: boolean }[] {
    const parts: { text: string; mention: boolean }[] = [];
    const pattern = /@[A-Za-z0-9_.]{2,30}/g;
    let last = 0;
    for (const match of body.matchAll(pattern)) {
        const at = match.index ?? 0;
        // Only at the start or after a space: an email address is not a mention.
        if (at > 0 && !/\s/.test(body[at - 1])) continue;
        if (at > last) parts.push({ text: body.slice(last, at), mention: false });
        parts.push({ text: match[0], mention: true });
        last = at + match[0].length;
    }
    if (last < body.length) parts.push({ text: body.slice(last), mention: false });
    return parts;
}

/** The counts after you react (or change it, or take it back). */
export function withMyEmoji(comment: Comment, emoji: CommentEmoji | null): Comment {
    const reactions = { ...comment.reactions };
    if (comment.myReaction) reactions[comment.myReaction] = Math.max(0, (reactions[comment.myReaction] ?? 0) - 1);
    if (emoji) reactions[emoji] = (reactions[emoji] ?? 0) + 1;
    return { ...comment, reactions, myReaction: emoji };
}

/* ------------------------------------------------------------ the server */

async function client() {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    const me = data.session?.user?.id;
    return me ? { sb, me } : null;
}

const COLUMNS = 'id, author, to_user, day, parent_id, body, created_at, edited_at';
const asEmoji = (value: unknown): CommentEmoji | null =>
    (COMMENT_EMOJI as readonly string[]).includes(String(value)) ? value as CommentEmoji : null;

/** Rows to comments, with names, faces and reactions filled in. */
async function dress(ctx: NonNullable<Awaited<ReturnType<typeof client>>>, rows: Record<string, any>[]): Promise<Comment[]> {
    if (!rows.length) return [];
    const authors = [...new Set(rows.map(row => row.author as string))];
    const ids = rows.map(row => row.id as string);
    const [people, reacts] = await Promise.all([
        ctx.sb.from('profiles').select('id, username, display_name, avatar_url').in('id', authors),
        ctx.sb.from('feed_comment_reactions').select('comment_id, user_id, emoji').in('comment_id', ids),
    ]);
    const byId = new Map((people.data ?? []).map((row: any) => [row.id, row]));
    return rows.map(row => {
        const person: any = byId.get(row.author);
        const mine = (reacts.data ?? []).filter((item: any) => item.comment_id === row.id);
        const reactions: Partial<Record<CommentEmoji, number>> = {};
        for (const item of mine) { const emoji = asEmoji(item.emoji); if (emoji) reactions[emoji] = (reactions[emoji] ?? 0) + 1; }
        return {
            id: row.id, author: row.author, toUser: row.to_user, day: String(row.day).slice(0, 10),
            parentId: row.parent_id ?? null, body: row.body, createdAt: row.created_at, editedAt: row.edited_at ?? null,
            mine: row.author === ctx.me,
            authorName: row.author === ctx.me ? 'You' : (person?.display_name?.trim() || person?.username || 'Friend'),
            authorUsername: person?.username ?? undefined,
            authorAvatar: person?.avatar_url ?? undefined,
            reactions,
            myReaction: asEmoji(mine.find((item: any) => item.user_id === ctx.me)?.emoji),
        };
    });
}

/** Every comment under one day. */
export async function loadThread(toUser: string, day: string): Promise<Comment[]> {
    const ctx = await client();
    if (!ctx) return [];
    const { data, error } = await ctx.sb.from('feed_comments').select(COLUMNS)
        .eq('to_user', toUser).eq('day', day).order('created_at', { ascending: true });
    if (error) throw new Error('Couldn’t load the comments.');
    return dress(ctx, data ?? []);
}

/** For the feed: every comment under these days, by thread key, in one call. */
export async function loadThreads(days: { toUser: string; day: string }[]): Promise<Record<string, Comment[]>> {
    const ctx = await client();
    if (!ctx || !days.length) return {};
    const wanted = new Set(days.map(item => threadKey(item.toUser, item.day)));
    const { data, error } = await ctx.sb.from('feed_comments').select(COLUMNS)
        .in('to_user', [...new Set(days.map(item => item.toUser))])
        .in('day', [...new Set(days.map(item => item.day))])
        .order('created_at', { ascending: true });
    if (error) return {};
    const rows = (data ?? []).filter((row: any) => wanted.has(threadKey(row.to_user, String(row.day).slice(0, 10))));
    const comments = await dress(ctx, rows);
    const out: Record<string, Comment[]> = {};
    for (const comment of comments) (out[threadKey(comment.toUser, comment.day)] ??= []).push(comment);
    return out;
}

export async function postComment(toUser: string, day: string, body: string, parentId: string | null = null): Promise<Comment> {
    const ctx = await client();
    if (!ctx) throw new Error('Sign in to comment.');
    const text = body.trim();
    if (!text) throw new Error('Say something first.');
    if (text.length > MAX_COMMENT) throw new Error(`Up to ${MAX_COMMENT} characters.`);
    const { data, error } = await ctx.sb.from('feed_comments')
        .insert({ author: ctx.me, to_user: toUser, day, body: text, parent_id: parentId })
        .select(COLUMNS).single();
    if (error || !data) throw new Error('That didn’t send. Try again.');
    return (await dress(ctx, [data]))[0];
}

/**
 * A reply typed on a comment's notification: it answers that person's latest
 * comment you can see, in its thread (one level deep, so a reply to a reply
 * hangs under the same comment).
 */
export async function replyToLatestFrom(author: string, body: string): Promise<Comment | null> {
    const ctx = await client();
    if (!ctx) return null;
    const { data } = await ctx.sb.from('feed_comments').select(COLUMNS)
        .eq('author', author).order('created_at', { ascending: false }).limit(1);
    const latest: any = data?.[0];
    if (!latest) return null;
    return postComment(latest.to_user, String(latest.day).slice(0, 10), body, latest.parent_id ?? latest.id);
}

export async function editComment(id: string, body: string): Promise<void> {
    const ctx = await client();
    if (!ctx) throw new Error('Sign in to edit.');
    const text = body.trim();
    if (!text || text.length > MAX_COMMENT) throw new Error(`Between 1 and ${MAX_COMMENT} characters.`);
    const { error } = await ctx.sb.from('feed_comments').update({ body: text, edited_at: new Date().toISOString() }).eq('id', id).eq('author', ctx.me);
    if (error) throw new Error('That edit didn’t save.');
}

export async function deleteComment(id: string): Promise<void> {
    const ctx = await client();
    if (!ctx) throw new Error('Sign in first.');
    const { error } = await ctx.sb.from('feed_comments').delete().eq('id', id);
    if (error) throw new Error('Couldn’t remove it.');
}

/** Your one reaction on a comment: set it, change it, or take it back (null). */
export async function reactToComment(id: string, emoji: CommentEmoji | null): Promise<void> {
    const ctx = await client();
    if (!ctx) throw new Error('Sign in first.');
    const { error } = emoji
        ? await (async () => {
            // Insert, then change it: only `emoji` may be updated.
            const made = await ctx.sb.from('feed_comment_reactions').insert({ comment_id: id, user_id: ctx.me, emoji });
            if (made.error?.code !== '23505') return made;
            return ctx.sb.from('feed_comment_reactions').update({ emoji }).eq('comment_id', id).eq('user_id', ctx.me);
        })()
        : await ctx.sb.from('feed_comment_reactions').delete().eq('comment_id', id).eq('user_id', ctx.me);
    if (error) throw new Error('That reaction didn’t save.');
}

/**
 * Calls back whenever anything changes under these people's days: a comment
 * written, edited or removed, or a reaction. The caller reloads (a beat later,
 * so a burst is one load). Realtime applies the read policy, so only threads
 * you may see arrive.
 */
export function listenToComments(onChange: () => void): () => void {
    const sb = getSupabase();
    if (!sb) return () => undefined;
    const channel = sb.channel(`comments:${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_comments' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feed_comment_reactions' }, onChange)
        .subscribe();
    return () => { void sb.removeChannel(channel); };
}
