import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Who you are in this app.
 *
 * The pieces were already on the device, but as six loose AsyncStorage keys
 * read and written by hand wherever they were needed. That is how a name ends
 * up saved under one spelling and read under another, so they get one owner
 * here and everything else asks this.
 *
 * All of it is local. None of these fields are secrets, but they are also not
 * needed by anything on a server until the community tab shows them to a
 * friend, so they stay on the phone until there is a reason.
 */
export interface Profile {
    name: string;
    /** A line about what you are working on. */
    bio: string;
    /** A local file uri, not a remote one. */
    avatar: string | null;
    /** The wide image behind the avatar; a local uri, or the accent when unset. */
    cover: string | null;
    birthday: string | null;
    gender: string | null;
}

export const EMPTY_PROFILE: Profile = { name: '', bio: '', avatar: null, cover: null, birthday: null, gender: null };

const KEYS = {
    name: 'profile_nickname',
    bio: 'profile_bio',
    avatar: 'profile_avatar',
    cover: 'profile_cover',
    birthday: 'profile_birthday',
    gender: 'profile_gender',
    age: 'profile_age',
} as const;

/*
 * Your profile, held once in memory: the one source every screen reads.
 *
 * It used to be read straight from storage by each screen, and kept in step by
 * an event only some of them listened to — so a new photo showed on one page
 * and not the next. Now there is one copy: saving updates it at once, every
 * reader re-renders from it (hooks/useMyProfile.ts), and storage is only where
 * it is kept between launches.
 */
let current: Profile = EMPTY_PROFILE;
let loading: Promise<Profile> | null = null;
let loaded = false;
const listeners = new Set<() => void>();
const publish = (next: Profile) => { current = next; listeners.forEach(listener => listener()); };

export const currentProfile = (): Profile => current;
export const profileLoaded = (): boolean => loaded;
export function subscribeProfile(listener: () => void): () => void {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

async function readStored(): Promise<Profile> {
    try {
        const pairs = await AsyncStorage.multiGet([KEYS.name, KEYS.bio, KEYS.avatar, KEYS.cover, KEYS.birthday, KEYS.gender]);
        const found = Object.fromEntries(pairs) as Record<string, string | null>;
        return {
            name: found[KEYS.name] ?? '',
            bio: found[KEYS.bio] ?? '',
            avatar: found[KEYS.avatar] || null,
            cover: found[KEYS.cover] || null,
            birthday: found[KEYS.birthday] || null,
            gender: found[KEYS.gender] || null,
        };
    } catch {
        return EMPTY_PROFILE;
    }
}

/** The profile, loaded from storage the first time and from memory after. */
export async function getProfile(): Promise<Profile> {
    if (loaded) return current;
    loading ??= readStored().then(found => { loaded = true; publish(found); return found; });
    return loading;
}

/** Forgets the in-memory copy (signing out clears storage underneath it). */
export function resetProfileStore(): void {
    loaded = false;
    loading = null;
    publish(EMPTY_PROFILE);
}

export async function saveProfile(changes: Partial<Profile>): Promise<void> {
    const writes: [string, string][] = [];
    const removes: string[] = [];

    const put = (key: string, value: string | null | undefined) => {
        if (value === undefined) return;
        if (value === null || value === '') removes.push(key);
        else writes.push([key, value]);
    };

    put(KEYS.name, changes.name);
    put(KEYS.bio, changes.bio);
    put(KEYS.avatar, changes.avatar);
    put(KEYS.cover, changes.cover);
    put(KEYS.gender, changes.gender);
    if (changes.birthday !== undefined) {
        put(KEYS.birthday, changes.birthday);
        // The stored age is derived, and kept for profiles saved before
        // birthdays existed; a birthday is the truth once there is one.
        put(KEYS.age, changes.birthday ? String(ageFrom(changes.birthday) ?? '') : null);
    }

    // Every screen shows the change at once; storage catches up behind it.
    const base = loaded ? current : await getProfile();
    const clean = (value: string | null | undefined, keepEmpty: boolean) =>
        value === undefined ? undefined : value === '' && !keepEmpty ? null : value;
    const next: Profile = {
        name: clean(changes.name, true) ?? base.name,
        bio: clean(changes.bio, true) ?? base.bio,
        avatar: changes.avatar !== undefined ? clean(changes.avatar, false) ?? null : base.avatar,
        cover: changes.cover !== undefined ? clean(changes.cover, false) ?? null : base.cover,
        birthday: changes.birthday !== undefined ? changes.birthday || null : base.birthday,
        gender: changes.gender !== undefined ? changes.gender || null : base.gender,
    };
    publish(next);

    try {
        if (writes.length) await AsyncStorage.multiSet(writes);
        if (removes.length) await AsyncStorage.multiRemove(removes);
        // The parts other people are shown have to leave the phone. Which of
        // them actually travel is decided by the sharing switches.
        if (changes.name !== undefined || changes.bio !== undefined || changes.avatar !== undefined || changes.cover !== undefined) {
            const { pushProfile } = require('./profileSync') as typeof import('./profileSync');
            void pushProfile().catch(() => undefined);
        }
    } catch {
        // A profile that did not save is worth a retry, not a crash.
    }
}

/** Whole years since that birthday, or null if it is not a real date. */
export function ageFrom(birthday: string, today = new Date()): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthday);
    if (!match) return null;
    const born = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(born.getTime())) return null;
    let years = today.getFullYear() - born.getFullYear();
    const months = today.getMonth() - born.getMonth();
    if (months < 0 || (months === 0 && today.getDate() < born.getDate())) years -= 1;
    return years >= 0 && years < 130 ? years : null;
}

/** What to show when there is no name yet, rather than an empty heading. */
export const displayName = (profile: Profile): string => profile.name.trim() || 'You';

/** The letters on the avatar when there is no photograph. */
export function initials(profile: Profile): string {
    const words = profile.name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
