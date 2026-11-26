import { useCallback, useEffect, useState } from 'react';
import { AppState, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FriendsService } from '@/lib/friendsService';
import { sharedState, type SharedState } from '@/lib/shared';
import { on } from '@/lib/appEvents';
import { useMyProfile } from '@/hooks/useMyProfile';

/** A row as `getSharedItemParticipants` hands it over. */
interface SharedRow {
    userId: string;
    username: string;
    avatarUrl?: string;
    completedToday?: boolean;
    isYou?: boolean;
    /** Invited and not yet answered. */
    pending?: boolean;
}

/**
 * The last answer for every shared item, kept between screens and launches,
 * so the faces are drawn at once and only refreshed behind them. Each screen
 * used to start empty and wait for the server, then for every photo, so the
 * faces arrived late on every card, every time.
 */
const CACHE_KEY = 'habyss_shared_people';
let cache: Record<string, SharedRow[]> = {};
let cacheLoaded: Promise<void> | null = null;
const loadCache = () => cacheLoaded ??= AsyncStorage.getItem(CACHE_KEY)
    .then(raw => { const parsed = raw ? JSON.parse(raw) : null; if (parsed && typeof parsed === 'object') cache = { ...parsed, ...cache }; })
    .catch(() => undefined);
let saving: ReturnType<typeof setTimeout> | null = null;
const saveCache = () => {
    if (saving) clearTimeout(saving);
    saving = setTimeout(() => { saving = null; void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache)).catch(() => undefined); }, 500);
};
const cacheKey = (kind: string, id: string) => `${kind}:${id}`;
const fromCache = (kind: string, ids: string[]) =>
    Object.fromEntries(ids.map(id => [id, cache[cacheKey(kind, id)]]).filter(([, rows]) => rows && rows.length > 1)) as Record<string, SharedRow[]>;
/** Photos fetched ahead, so a face appears with its picture rather than after it. */
const fetched = new Set<string>();
const prefetch = (rows: SharedRow[]) => {
    for (const row of rows) {
        if (!row.avatarUrl || fetched.has(row.avatarUrl) || !/^https?:/.test(row.avatarUrl)) continue;
        fetched.add(row.avatarUrl);
        void Image.prefetch(row.avatarUrl).catch(() => fetched.delete(row.avatarUrl!));
    }
};

/**
 * Who else is on each of the habits and tasks on screen.
 *
 * One query for the whole list rather than one per card: a roadmap with thirty
 * rows would otherwise open thirty requests, and thirty answers arriving one at
 * a time is how a list ends up re-rendering thirty times while somebody is
 * trying to scroll it.
 *
 * Empty until it has an answer, and empty is the right thing to draw — a row
 * that briefly claims to be yours alone and then sprouts faces is worse than
 * one that simply gains them.
 */
export function useSharedItems(
    ids: string[],
    doneByMe: Record<string, boolean>,
    /**
     * Which table these ids live in.
     *
     * A habit id and a task id look identical and are stored apart, so asking
     * `shared_habits` about a task quietly returns nobody — which reads as "not
     * shared" rather than as "asked the wrong question". Call the hook once per
     * kind instead of guessing.
     */
    kind: 'habit' | 'task' = 'habit',
) {
    const key = ids.slice().sort().join(',');
    // What was known last time, straight away.
    const [people, setPeople] = useState<Record<string, SharedRow[]>>(() => fromCache(kind, ids));
    const myProfile = useMyProfile();

    /** Everything the rows need, in one pass, off the render path. */
    const fetch = useCallback(async (): Promise<Record<string, SharedRow[]>> => {
        if (!key) return {};
        const shared = await FriendsService.sharedIds().catch(() => new Set<string>());
        const wanted = key.split(',').filter(id => shared.has(id));
        if (wanted.length === 0) return {};

        const found = await Promise.all(wanted.map(async id => {
            const rows = (await FriendsService.getSharedItemParticipants(id, kind).catch(() => [])) as SharedRow[];
            return [id, rows] as const;
        }));
        // One person on it is not a shared item; it is an ordinary one. An
        // invitation out counts as more than one — the card should say so from
        // the moment it is sent, not only once somebody accepts.
        for (const id of key.split(',')) delete cache[cacheKey(kind, id)];
        for (const [id, rows] of found) { cache[cacheKey(kind, id)] = rows; prefetch(rows); }
        saveCache();
        return Object.fromEntries(found.filter(([, rows]) => rows.length > 1));
    }, [key, kind]);

    const load = useCallback(() => { void fetch().then(setPeople); }, [fetch]);

    useEffect(() => {
        let alive = true;
        // The stored answer first (after a launch), then the fresh one.
        void loadCache().then(() => {
            if (!alive || !key) return;
            const known = fromCache(kind, key.split(','));
            Object.values(known).forEach(prefetch);
            setPeople(current => Object.keys(current).length ? current : known);
        });
        fetch().then(found => { if (alive) setPeople(found); }).catch(() => undefined);
        return () => { alive = false; };
    }, [fetch, key, kind]);
    useEffect(() => {
        // Somebody else finishing their half changes what these rows say.
        const stop = on('social_state_updated', () => { void load(); });
        // So does a friend changing their photo or name, or ticking their part:
        // their phone pings yours (lib/livePulse.ts), and the faces re-read.
        let stopFriends: (() => void) | undefined;
        let pending: ReturnType<typeof setTimeout> | null = null;
        const { listenToFriends } = require('@/lib/livePulse') as typeof import('@/lib/livePulse');
        void listenToFriends(() => {
            if (pending) clearTimeout(pending);
            pending = setTimeout(() => { pending = null; load(); }, 800);
        }).then(unsubscribe => { stopFriends = unsubscribe; });
        // And coming back to the app catches up on anything missed meanwhile.
        const app = AppState.addEventListener('change', state => { if (state === 'active') load(); });
        return () => { stop.remove(); stopFriends?.(); app.remove(); if (pending) clearTimeout(pending); };
    }, [load]);

    /**
     * What a row should say, with your own half known exactly.
     *
     * Your own state comes from the app rather than the server: you have just
     * tapped it, and waiting for a round trip to believe your own check-in is
     * how an interface feels slow.
     */
    const stateFor = useCallback((id: string): SharedState | null => {
        const rows = people[id];
        if (!rows || rows.length < 2) return null;
        return sharedState(rows.map(row => ({
            userId: row.userId,
            username: row.isYou ? (myProfile.name || row.username) : row.username,
            // Your own face from the one profile store, so a new photo shows at once.
            avatarUrl: row.isYou ? myProfile.avatar ?? undefined : row.avatarUrl,
            done: row.isYou ? !!doneByMe[id] : !!row.completedToday,
            isYou: !!row.isYou,
            pending: !!row.pending,
        })));
    }, [people, doneByMe, myProfile.name, myProfile.avatar]);

    return { stateFor, reload: load };
}
