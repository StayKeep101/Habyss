import { useCallback, useEffect, useState } from 'react';
import { FriendsService } from '@/lib/friendsService';
import { sharedState, type SharedState } from '@/lib/shared';
import { on } from '@/lib/appEvents';

/** A row as `getSharedItemParticipants` hands it over. */
interface SharedRow {
    userId: string;
    username: string;
    avatarUrl?: string;
    completedToday?: boolean;
    isYou?: boolean;
}

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
export function useSharedItems(ids: string[], doneByMe: Record<string, boolean>) {
    const [people, setPeople] = useState<Record<string, SharedRow[]>>({});
    const key = ids.slice().sort().join(',');

    /** Everything the rows need, in one pass, off the render path. */
    const fetch = useCallback(async (): Promise<Record<string, SharedRow[]>> => {
        if (!key) return {};
        const shared = await FriendsService.sharedIds().catch(() => new Set<string>());
        const wanted = key.split(',').filter(id => shared.has(id));
        if (wanted.length === 0) return {};

        const found = await Promise.all(wanted.map(async id => {
            const rows = (await FriendsService.getSharedItemParticipants(id, 'habit').catch(() => [])) as SharedRow[];
            return [id, rows] as const;
        }));
        // One person on it is not a shared item; it is an ordinary one.
        return Object.fromEntries(found.filter(([, rows]) => rows.length > 1));
    }, [key]);

    const load = useCallback(() => { void fetch().then(setPeople); }, [fetch]);

    useEffect(() => {
        let alive = true;
        fetch().then(found => { if (alive) setPeople(found); }).catch(() => undefined);
        return () => { alive = false; };
    }, [fetch]);
    useEffect(() => {
        // Somebody else finishing their half changes what these rows say.
        const stop = on('social_state_updated', () => { void load(); });
        return () => stop.remove();
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
            username: row.username,
            avatarUrl: row.avatarUrl,
            done: row.isYou ? !!doneByMe[id] : !!row.completedToday,
            isYou: !!row.isYou,
        })));
    }, [people, doneByMe]);

    return { stateFor, reload: load };
}
