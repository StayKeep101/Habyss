import { getSupabase } from './supabase';
import { getProfile, type Profile } from './profile';
import { maskObjectionable } from './contentFilter';

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
    /**
     * The few things on today's list, by name.
     *
     * Its own switch rather than riding on `progress`, because somebody may
     * well be happy to show that their day is going well without publishing
     * their to-do list — and collapsing those into one setting is how an app
     * ends up sharing more than anybody agreed to.
     */
    tasks: boolean;
}

export const ALL_SHARED: Sharing = { name: true, bio: true, photo: true, progress: true, habits: true, tasks: true };

export const SHARING_LABELS: { id: keyof Sharing; label: string; detail: string }[] = [
    { id: 'name', label: 'Your name', detail: 'Otherwise friends see your username' },
    { id: 'photo', label: 'Your picture', detail: 'Shown beside your day in the feed' },
    { id: 'bio', label: 'Your bio', detail: 'The line about what you are working on' },
    { id: 'progress', label: 'Your progress', detail: 'Streak and how much of today is done' },
    { id: 'habits', label: 'Shared habit names', detail: 'Only ones you have shared with that person' },
    { id: 'tasks', label: "Today's tasks", detail: 'Up to five, by name, on your card in the feed' },
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
    return uploadToOwnFolder(ctx, uri, String(Date.now()));
}

/**
 * Uploads any picture of yours (a goal's cover, say) and returns its public URL.
 *
 * Same bucket and the same folder rule as the avatar, so it needs no policy of
 * its own: you can only ever write under your own id.
 */
export async function uploadPicture(uri: string, name: string): Promise<string | null> {
    const ctx = await signedIn();
    if (!ctx) return null;
    return uploadToOwnFolder(ctx, uri, name);
}

async function uploadToOwnFolder(ctx: Context, uri: string, name: string): Promise<string | null> {
    try {
        if (/^https?:/.test(uri)) return uri;

        const bytes = await readLocalFile(uri);
        if (!bytes || bytes.byteLength === 0) return null;

        const extension = /\.png($|\?)/i.test(uri) ? 'png' : /\.webp($|\?)/i.test(uri) ? 'webp' : 'jpg';
        const type = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
        const path = `${ctx.me}/${name}.${extension}`;

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
        // Others never read a slur in a name or bio (lib/contentFilter).
        display_name: allowed.name ? (maskObjectionable(me.name.trim()) || null) : null,
        bio: allowed.bio ? (maskObjectionable(me.bio.trim().slice(0, 300)) || null) : null,
    };

    // The cover travels with the picture, under the same switch.
    if (!allowed.photo || !me.cover) {
        patch.cover_url = null;
    } else {
        const coverUrl = await uploadToOwnFolder(ctx, me.cover, `cover-${Date.now()}`);
        if (coverUrl) patch.cover_url = coverUrl;
        if (coverUrl && coverUrl !== me.cover) {
            const { saveProfile } = require('./profile') as typeof import('./profile');
            void saveProfile({ cover: coverUrl }).catch(() => undefined);
        }
    }

    if (!allowed.photo) {
        patch.avatar_url = null;
    } else if (me.avatar) {
        const url = await uploadAvatar(ctx, me.avatar);
        // Only overwrite when the upload worked: clearing a good URL because a
        // network call failed would lose the picture for everybody else.
        if (url) patch.avatar_url = url;
        // Point this phone at the uploaded copy too, so the same picture is
        // not uploaded again on every launch.
        if (url && url !== me.avatar) {
            const { saveProfile } = require('./profile') as typeof import('./profile');
            void saveProfile({ avatar: url }).catch(() => undefined);
        }
    } else {
        patch.avatar_url = null;
    }

    const { error } = await ctx.sb.from('profiles').update(patch).eq('id', ctx.me);
    // Friends' cards and pages re-read faces when pinged; ping once the new
    // picture is actually saved, not before it has finished uploading.
    if (!error) {
        const { announceChange } = require('./livePulse') as typeof import('./livePulse');
        announceChange();
    }
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
    const { data } = await ctx.sb.from('profiles').select('display_name, bio, avatar_url, cover_url, sharing').eq('id', ctx.me).maybeSingle();
    if (!data) return;

    const me = await getProfile();
    const allowed: Sharing = { ...ALL_SHARED, ...(data.sharing ?? {}) };

    // Two ways, field by field. Signing out clears the phone, so an account
    // signed back into arrives with no name or picture here: take the
    // server's. A name changed on this phone after the server already had
    // one used to never travel, because this only filled empty columns:
    // send it.
    const restore: Partial<Profile> = {};
    if (!me.name.trim() && data.display_name) restore.name = data.display_name;
    if (!me.bio.trim() && data.bio) restore.bio = data.bio;
    if (!me.avatar && data.avatar_url) restore.avatar = data.avatar_url;
    if (!me.cover && data.cover_url) restore.cover = data.cover_url;
    if (Object.keys(restore).length) {
        const { saveProfile } = require('./profile') as typeof import('./profile');
        // saveProfile sends the result back up, which settles anything else.
        await saveProfile(restore);
        return;
    }

    const differs =
        (allowed.name && !!me.name.trim() && me.name.trim() !== (data.display_name ?? ''))
        || (allowed.bio && !!me.bio.trim() && me.bio.trim().slice(0, 300) !== (data.bio ?? ''))
        // A picture still on the phone (file://) has not been uploaded yet.
        || (allowed.photo && !!me.avatar && (!data.avatar_url || !/^https?:/.test(me.avatar)))
        || (allowed.photo && !!me.cover && (!data.cover_url || !/^https?:/.test(me.cover)));
    if (!differs) return;

    await pushProfile(me, allowed);
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
    // Claimed rather than written: the token is this phone's, so it is taken off
    // any other account that signed in here before. Without that, a second
    // account on the same phone kept receiving the first one's notifications.
    const { error } = await ctx.sb.rpc('claim_push_token', { p_token: token });
    if (error) await ctx.sb.from('profiles').update({ push_token: token }).eq('id', ctx.me);
}

/** Takes this phone's token off the account, so a signed-out account stops ringing it. */
export async function releasePushToken(): Promise<void> {
    const ctx = await signedIn();
    if (!ctx) return;
    await ctx.sb.from('profiles').update({ push_token: null }).eq('id', ctx.me);
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
