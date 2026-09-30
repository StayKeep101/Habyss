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

        const bytes = await readLocalFile(uri);
        if (!bytes || bytes.byteLength === 0) return null;

        const extension = /\.png($|\?)/i.test(uri) ? 'png' : /\.webp($|\?)/i.test(uri) ? 'webp' : 'jpg';
        const type = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
        const path = `${ctx.me}/${Date.now()}.${extension}`;

        const { error } = await ctx.sb.storage.from('avatars').upload(path, bytes, { contentType: type, upsert: true });
        if (error) return null;
        return ctx.sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
    } catch {
        return null;
    }
}

/**
 * The bytes of a local file, read rather than fetched.
 *
 * `fetch('file://…').arrayBuffer()` is the obvious way and it is not dependable
 * on React Native: depending on the platform it resolves to an empty buffer
 * instead of failing, so the upload succeeds, the row gets a URL, and the
 * picture is a zero-byte file nobody can see. A broken image is much worse than
 * a missing one, because nothing reports it.
 *
 * Base64 through expo-file-system is the reliable path; the `fetch` is kept
 * only as a fallback for a uri scheme the file system will not open.
 */
async function readLocalFile(uri: string): Promise<Uint8Array | null> {
    try {
        const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        return decodeBase64(base64);
    } catch {
        try {
            const bytes = await (await fetch(uri)).arrayBuffer();
            return bytes.byteLength > 0 ? new Uint8Array(bytes) : null;
        } catch {
            return null;
        }
    }
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Base64 to bytes, without `atob`.
 *
 * Hermes has no `atob`, and `Buffer` is a Node shim this project does not ship.
 */
function decodeBase64(input: string): Uint8Array {
    const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
    const out = new Uint8Array(Math.floor(clean.length * 3 / 4));
    let byte = 0;
    for (let index = 0; index < clean.length; index += 4) {
        const a = B64.indexOf(clean[index]);
        const b = B64.indexOf(clean[index + 1]);
        const c = B64.indexOf(clean[index + 2]);
        const d = B64.indexOf(clean[index + 3]);
        out[byte++] = (a << 2) | (b >> 4);
        if (c >= 0) out[byte++] = ((b & 15) << 4) | (c >> 2);
        if (d >= 0) out[byte++] = ((c & 3) << 6) | d;
    }
    // `-` padding made the array a byte or two long; hand back only what was read.
    return out.subarray(0, byte);
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
 * handle and a grey circle.
 *
 * Only fills what is missing. Pushing unconditionally would make whichever
 * device launched last the winner, and the profile is per-device storage.
 */
export async function backfillProfile(): Promise<void> {
    const ctx = await signedIn();
    if (!ctx) return;
    const { data } = await ctx.sb.from('profiles').select('display_name, bio, avatar_url').eq('id', ctx.me).maybeSingle();
    if (!data) return;

    const me = await getProfile();
    // Against what this phone actually has, not against all three columns. The
    // old test was `display_name && bio && avatar_url`, so somebody who had
    // written no bio — which is most people — was backfilled on every launch,
    // while somebody with all three was never corrected. Neither is the
    // question. The question is whether anything here has yet to arrive.
    const missing =
        (!!me.name.trim() && !data.display_name)
        || (!!me.bio.trim() && !data.bio)
        || (!!me.avatar && !data.avatar_url);
    if (!missing) return;

    await pushProfile(me);
}

/**
 * Puts this phone's push token where the server can reach it.
 *
 * It was fetched and then written to AsyncStorage, which is the one place
 * nothing else can read it — so no device could ever notify another, and
 * "@sam shared a habit with you" waited until that person happened to open the
 * app and look. Nothing even called the registration.
 *
 * The column is readable only by its owner and by the trigger that sends the
 * push, which runs as the definer: a token somebody else can read is a token
 * somebody else can send to.
 */
export async function publishPushToken(): Promise<void> {
    const ctx = await signedIn();
    if (!ctx) return;
    const { NotificationService } = require('./notificationService') as typeof import('./notificationService');
    const token = await NotificationService.registerForPushNotificationsAsync().catch(() => null);
    if (!token) return;
    await ctx.sb.from('profiles').update({ push_token: token }).eq('id', ctx.me);
}

/**
 * Backfills now, and again whenever somebody signs in.
 *
 * On a cold launch this used to run once from a mount effect, which is before
 * Supabase has restored the stored session — so `signedIn()` returned null and
 * it quietly did nothing, every launch, forever. Signing in later never
 * triggered it either. That is why the columns stayed empty on accounts that
 * plainly had a name and a picture on the phone.
 *
 * Returns an unsubscribe.
 */
export function startProfileSync(): () => void {
    const run = () => {
        void backfillProfile().catch(() => undefined);
        // Alongside, not inside: a phone that has declined notifications still
        // needs its name and picture to travel.
        void publishPushToken().catch(() => undefined);
    };
    run();

    const sb = getSupabase();
    if (!sb) return () => undefined;
    const { data } = sb.auth.onAuthStateChange((event) => {
        // INITIAL_SESSION is the one that matters on a cold launch: it fires
        // once the stored session has been read, which is the moment the first
        // attempt was too early for.
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            run();
        }
    });
    return () => data.subscription.unsubscribe();
}
