import { getSupabase } from './supabase';
import { getProfile, type Profile } from './profile';

/**
 * Putting your profile where your friends can see it.
 *
 * The name, the bio and the picture all lived on the phone, which meant the
 * page a friend saw was a different page from the one you saw — a handle
 * instead of your name, no bio at all, and a grey circle where your picture is.
 *
 * What travels is what you allow: `sharing` on the profile row is a set of
 * switches rather than one. "Everything or nothing" is not a privacy setting,
 * it is an ultimatum.
 */

export interface Sharing {
    name: boolean;
    bio: boolean;
    photo: boolean;
    /** Streak, momentum and the rest of the numbers on your card. */
    progress: boolean;
    /** The names of habits you have shared, rather than only a count. */
    habits: boolean;
}

export const ALL_SHARED: Sharing = { name: true, bio: true, photo: true, progress: true, habits: true };

export const SHARING_LABELS: { id: keyof Sharing; label: string; detail: string }[] = [
    { id: 'name', label: 'Your name', detail: 'Otherwise friends see your username' },
    { id: 'photo', label: 'Your picture', detail: 'Shown beside your day in the feed' },
    { id: 'bio', label: 'Your bio', detail: 'The line about what you are working on' },
    { id: 'progress', label: 'Your progress', detail: 'Streak and how much of today is done' },
    { id: 'habits', label: 'Shared habit names', detail: 'Only ones you have shared with that person' },
];

interface Context { sb: NonNullable<ReturnType<typeof getSupabase>>; me: string }

async function signedIn(): Promise<Context | null> {
    const sb = getSupabase();
    if (!sb) return null;
    const { data } = await sb.auth.getSession();
    const me = data.session?.user?.id;
    return me ? { sb, me } : null;
}

/** What this account is willing to show. Missing keys read as allowed. */
export async function getSharing(): Promise<Sharing> {
    const ctx = await signedIn();
    if (!ctx) return ALL_SHARED;
    const { data } = await ctx.sb.from('profiles').select('sharing').eq('id', ctx.me).maybeSingle();
    return { ...ALL_SHARED, ...(data?.sharing ?? {}) };
}

export async function setSharing(changes: Partial<Sharing>): Promise<Sharing> {
    const ctx = await signedIn();
    if (!ctx) return ALL_SHARED;
    const next = { ...(await getSharing()), ...changes };
    await ctx.sb.from('profiles').update({ sharing: next }).eq('id', ctx.me);
    // Turning a switch off has to take the thing with it, or "off" only means
    // "hidden by an interface that could be older than the switch".
    await pushProfile(undefined, next);
    return next;
}

/**
 * Uploads the picture and returns a URL anybody can load.
 *
 * Stored under a folder named after the owner, which is what the storage policy
 * checks — so nobody can replace anybody else's face. The name changes on every
 * upload so a new picture is never hidden behind a cached old one.
 */
async function uploadAvatar(ctx: Context, uri: string): Promise<string | null> {
    try {
        if (/^https?:/.test(uri)) return uri;
        const response = await fetch(uri);
        const bytes = await response.arrayBuffer();
        const type = response.headers.get('content-type') || 'image/jpeg';
        const extension = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
        const path = `${ctx.me}/${Date.now()}.${extension}`;

        const { error } = await ctx.sb.storage.from('avatars').upload(path, bytes, { contentType: type, upsert: true });
        if (error) return null;
        return ctx.sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    } catch {
        return null;
    }
}

/**
 * Sends the profile up, honouring the switches.
 *
 * Quiet about failure: a profile that did not upload is worth retrying on the
 * next launch, not an error in front of somebody who was editing their name.
 */
export async function pushProfile(profile?: Profile, sharing?: Sharing): Promise<void> {
    const ctx = await signedIn();
    if (!ctx) return;
    const me = profile ?? await getProfile();
    const allowed = sharing ?? await getSharing();

    const patch: Record<string, unknown> = {
        display_name: allowed.name ? (me.name.trim() || null) : null,
        bio: allowed.bio ? (me.bio.trim().slice(0, 300) || null) : null,
    };

    if (!allowed.photo) {
        patch.avatar_url = null;
    } else if (me.avatar) {
        const url = await uploadAvatar(ctx, me.avatar);
        // Only overwrite when the upload worked: clearing a good URL because a
        // network call failed would lose the picture for everybody else.
        if (url) patch.avatar_url = url;
    } else {
        patch.avatar_url = null;
    }

    await ctx.sb.from('profiles').update(patch).eq('id', ctx.me);
}

/**
 * Sends it up if the server has never been told.
 *
 * Every account that existed before any of this has an empty name and no
 * picture on the server while having both on the phone, so friends see a
 * handle and a grey circle. Called on launch; does nothing once it has run.
 */
export async function backfillProfile(): Promise<void> {
    const ctx = await signedIn();
    if (!ctx) return;
    const { data } = await ctx.sb.from('profiles').select('display_name, bio, avatar_url').eq('id', ctx.me).maybeSingle();
    if (!data) return;
    if (data.display_name && data.bio && data.avatar_url) return;

    const me = await getProfile();
    if (!me.name.trim() && !me.bio.trim() && !me.avatar) return;
    await pushProfile(me);
}
