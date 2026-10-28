import { useEffect, useState } from 'react';
import { FeedService, type FriendStatusRow } from '@/lib/feedService';
import { crewOf } from '@/lib/focusTogether';
import { listenToFriends } from '@/lib/livePulse';

const REFRESH_MS = 60 * 1000;

/**
 * Who is focusing with you right now (lib/focusTogether.ts): the friend whose
 * session you joined and everyone else in it, or the friends who joined
 * yours. Reloads the moment a friend's status changes (their phone pings
 * this one) and once a minute, only while `active`.
 */
export function useFocusCrew(host: string | null, active: boolean): FriendStatusRow[] {
    const [crew, setCrew] = useState<FriendStatusRow[]>([]);
    useEffect(() => {
        if (!active) { setCrew([]); return; }
        let alive = true;
        let stop: (() => void) | null = null;
        const load = async () => {
            const me = await FeedService.me();
            if (!me || !alive) return;
            const friends = await FeedService.friendStatuses().catch(() => []);
            if (alive) setCrew(crewOf(friends, me, host ?? me));
        };
        void load();
        const timer = setInterval(() => { void load(); }, REFRESH_MS);
        void listenToFriends(() => { void load(); }).then(off => { if (alive) stop = off; else off(); });
        return () => { alive = false; clearInterval(timer); stop?.(); };
    }, [host, active]);
    return crew;
}
