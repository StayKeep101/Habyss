import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Community notifications: each kind on (a push that buzzes the phone) or off
 * (it still arrives, quietly, in the inbox). Settings → Notifications.
 *
 * Kept on the server, on your profile (`profiles.push_muted`), because that is
 * where pushes are sent from (public.push_notification, a database trigger):
 * a kind switched off is never pushed at all, rather than pushed and hidden.
 * supabase/migrations/20261108000300_push_kinds.sql.
 */
export interface PushKind { id: string; label: string; icon: string; types: string[] }

export const PUSH_KINDS: PushKind[] = [
    { id: 'friends', label: 'Friend requests', icon: 'person-add', types: ['friend_request', 'friend_accepted'] },
    { id: 'nudges', label: 'Nudges', icon: 'hand-left', types: ['nudge', 'nudge_back'] },
    { id: 'reactions', label: 'Reactions and comments', icon: 'heart', types: ['reaction', 'comment'] },
    { id: 'shares', label: 'Shared habits and tasks', icon: 'people', types: ['share_offer', 'share_accepted', 'share_declined', 'shared_done'] },
    { id: 'games', label: 'Challenges and bets', icon: 'flash', types: ['duel', 'challenge', 'market'] },
    { id: 'focus', label: 'Focus together', icon: 'timer', types: ['focus_invite', 'focus_joined'] },
    { id: 'days', label: 'Friends’ days', icon: 'sunny', types: ['day_drop'] },
    { id: 'gifts', label: 'Gifts', icon: 'gift', types: ['freeze_gift'] },
    { id: 'messages', label: 'Messages', icon: 'chatbubble', types: ['message'] },
];

const KEY = 'habyss_push_off';

/** The kinds switched off (inbox only). Everything starts on. */
export async function pushOff(): Promise<Set<string>> {
    try {
        const raw = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
        return new Set(Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []);
    } catch {
        return new Set();
    }
}

/** The notification types the server should not push, for the kinds switched off. */
export const mutedTypes = (off: Set<string>): string[] =>
    PUSH_KINDS.filter(kind => off.has(kind.id)).flatMap(kind => kind.types);

/** Switches one kind, here and on the server. Throws when the server could not be told. */
export async function setPushKind(id: string, on: boolean): Promise<void> {
    const off = await pushOff();
    if (on) off.delete(id); else off.add(id);
    await AsyncStorage.setItem(KEY, JSON.stringify([...off])).catch(() => undefined);
    await sendPushPrefs(off);
}

/** Tells the server which types to keep to the inbox. Also called after signing in, so a new phone agrees. */
export async function sendPushPrefs(off?: Set<string>): Promise<void> {
    const { getSupabase } = require('./supabase') as typeof import('./supabase');
    const sb = getSupabase();
    const { data } = sb ? await sb.auth.getSession() : { data: null };
    const me = data?.session?.user?.id;
    if (!sb || !me) return;
    const { error } = await sb.from('profiles').update({ push_muted: mutedTypes(off ?? await pushOff()) }).eq('id', me);
    if (error) throw new Error(error.message);
}
