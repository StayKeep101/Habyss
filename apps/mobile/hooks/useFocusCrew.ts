import { useEffect, useState } from 'react';
import { FeedService, type FriendStatusRow } from '@/lib/feedService';
import { crewOf, focusRooms } from '@/lib/focusTogether';
import { listenToFriends } from '@/lib/livePulse';

const REFRESH_MS = 60 * 1000;

/**
 * Who is focusing with you right now (lib/focusTogether.ts): the friend whose
 * session you joined or linked to and everyone else in it, or the friends who
 * joined yours. `nearby` is the rest: friends focusing at the same time by
 * chance, each the one who started their session, to suggest focusing
 * together. Reloads the moment a friend's status changes (their phone pings
 * this one) and once a minute, only while `active`.
 */
export function useFocusCrew(host: string | null, active: boolean): { crew: FriendStatusRow[]; nearby: FriendStatusRow[] } {
    const [state, setState] = useState<{ crew: FriendStatusRow[]; nearby: FriendStatusRow[] }>({ crew: [], nearby: [] });
    useEffect(() => {
        if (!active) { setState({ crew: [], nearby: [] }); return; }
        let alive = true;
        let stop: (() => void) | null = null;
        const load = async () => {
            const me = await FeedService.me();
            if (!me || !alive) return;
            const friends = await FeedService.friendStatuses().catch(() => []);
            if (!alive) return;
            const crew = crewOf(friends, me, host ?? me);
            const inCrew = new Set(crew.map(friend => friend.userId));
            const nearby = focusRooms(friends).map(room => room.host)
                .filter(friend => !inCrew.has(friend.userId) && friend.focusWith !== me);
            setState({ crew, nearby });
        };
        void load();
        const timer = setInterval(() => { void load(); }, REFRESH_MS);
        void listenToFriends(() => { void load(); }).then(off => { if (alive) stop = off; else off(); });
        return () => { alive = false; clearInterval(timer); stop?.(); };
    }, [host, active]);
    return state;
}
