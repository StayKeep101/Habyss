import { getSupabase } from './supabase';

/**
 * Focus together: a friend is locked in, you tap Join, and a session of your
 * own starts that ends when theirs does. You each work on your own thing;
 * what you share is the time, and the faces on each other's focus page.
 *
 * A joined session is an ordinary focus session whose id names the host
 * (`together:<their id>`). Your profile says whose session you are in
 * (focus_with), so everyone in it can see who else is there.
 */

const PREFIX = 'together:';

export const togetherId = (hostId: string): string => `${PREFIX}${hostId}`;

/** Whose session a focus id joined, or null for your own. */
export const hostOf = (focusId: string | null | undefined): string | null =>
    focusId?.startsWith(PREFIX) ? focusId.slice(PREFIX.length) || null : null;

/** Whole seconds until a session ends; 0 when it already has. */
export const secondsLeft = (focusUntil: string | null, now = Date.now()): number =>
    focusUntil ? Math.max(0, Math.floor((new Date(focusUntil).getTime() - now) / 1000)) : 0;

/** Too little left to be worth joining. */
export const MIN_JOIN_SECONDS = 60;

export interface FocusFacts {
    userId: string;
    focusUntil: string | null;
    focusWith?: string | null;
}

/**
 * Who is in the same session as you: the host and everyone else who joined
 * them, still running. `host` is whose session it is — yours when you
 * started it, your friend's when you joined.
 */
export function crewOf<T extends FocusFacts>(friends: T[], me: string, host: string, now = Date.now()): T[] {
    return friends.filter(friend =>
        friend.userId !== me
        && secondsLeft(friend.focusUntil, now) > 0
        && (friend.userId === host || friend.focusWith === host));
}

/** "Alex", "Alex and Sam", "Alex, Sam and 2 more". */
export function namesLine(names: string[]): string {
    const first = names.map(name => name.split(' ')[0] || name);
    if (first.length <= 1) return first[0] ?? '';
    if (first.length === 2) return `${first[0]} and ${first[1]}`;
    if (first.length === 3) return `${first[0]}, ${first[1]} and ${first[2]}`;
    return `${first[0]}, ${first[1]} and ${first.length - 2} more`;
}

/**
 * Writes whose session you are in. Kept apart from the rest of your status
 * so a server without the column yet never stops "Locked in" being written.
 */
export async function setFocusWith(hostId: string | null): Promise<void> {
    const sb = getSupabase();
    if (!sb) return;
    const { data } = await sb.auth.getSession();
    const me = data.session?.user?.id;
    if (!me) return;
    await sb.from('profiles').update({ focus_with: hostId }).eq('id', me);
}

export type InviteResult = { sent: number } | { error: 'too_soon' | 'nobody' | 'not_focusing' | 'failed' };

/** "Join me?" to every friend who is awake. At most once every 20 minutes. */
export async function inviteFriendsToFocus(): Promise<InviteResult> {
    const sb = getSupabase();
    if (!sb) return { error: 'failed' };
    const { data, error } = await sb.rpc('invite_friends_to_focus');
    if (error) return { error: 'failed' };
    const answer = String(data);
    if (answer === 'too_soon' || answer === 'nobody' || answer === 'not_focusing') return { error: answer };
    const sent = Number(answer);
    return Number.isFinite(sent) ? { sent } : { error: 'failed' };
}

/**
 * The sessions running among your friends, one per host: whoever started it,
 * and the friends who joined them. A friend who joined someone you are not
 * friends with is shown as their own session. Soonest to end last, so the
 * ones with the most time left to join come first.
 */
export function focusRooms<T extends FocusFacts>(friends: T[], now = Date.now()): { host: T; with: T[] }[] {
    const running = friends.filter(friend => secondsLeft(friend.focusUntil, now) >= MIN_JOIN_SECONDS);
    const ids = new Set(running.map(friend => friend.userId));
    const hosts = running.filter(friend => !friend.focusWith || !ids.has(friend.focusWith));
    return hosts
        .map(host => ({ host, with: running.filter(friend => friend.focusWith === host.userId) }))
        .sort((a, b) => secondsLeft(b.host.focusUntil, now) - secondsLeft(a.host.focusUntil, now));
}

/** "18 min left", "1 hr 5 min left". */
export function leftLabel(seconds: number): string {
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    if (minutes < 60) return `${minutes} min left`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} hr ${rest} min left` : `${hours} hr left`;
}
