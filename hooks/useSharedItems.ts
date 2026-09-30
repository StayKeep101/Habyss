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
    /** Invited and not yet answered. */
    pending?: boolean;
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
    const [people, setPeople] = useState<Record<string, SharedRow[]>>({});
    const key = ids.slice().sort().join(',');

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
        return Object.fromEntries(found.filter(([, rows]) => rows.length > 1));
    }, [key, kind]);

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
            pending: !!row.pending,
        })));
    }, [people, doneByMe]);

    return { stateFor, reload: load };
}
