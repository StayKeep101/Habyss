import { useEffect, useState } from 'react';
import { on } from '@/lib/appEvents';
import { challengeOf, loadLinks, type Proof } from '@/lib/challenges';

/** The challenge a habit or task is part of (lib/challenges.ts), kept current; null when none. */
export function useChallengeOf(kind: 'habit' | 'task', id: string): { title: string; proof: Proof } | null {
    const [found, setFound] = useState(() => challengeOf(kind, id));
    useEffect(() => {
        let alive = true;
        const read = () => { void loadLinks().then(() => { if (alive) setFound(challengeOf(kind, id)); }); };
        read();
        const sub = on('challenges_changed', read);
        return () => { alive = false; sub.remove(); };
    }, [kind, id]);
    return found ? { title: found.title, proof: found.proof } : null;
}
