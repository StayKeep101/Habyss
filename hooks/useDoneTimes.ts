import { useEffect, useState } from 'react';
import { getCompletionTimes } from '@/lib/habitsSQLite';

/**
 * When a habit was first seen ticked on this phone, by `day|id`, until its
 * saved time arrives. Outside React so a render can read it and keep it.
 */
const firstSeen = new Map<string, string>();

/**
 * When each habit was ticked on `day` (ISO times), read again whenever the
 * ticks change, so the timeline shows a done habit where it was really done.
 * `ready` is false until the first read for that day has come back: until
 * then the timeline must not be saved as the day's layout.
 *
 * A tick shows on the line the moment it is made: a habit just ticked whose
 * time is not saved yet is given the minute it was first seen done, so the
 * row closes up at once instead of after the database answers.
 */
export function useDoneTimes(day: string, completions: Record<string, boolean>): { times: Record<string, string>; ready: boolean } {
    const [state, setState] = useState<{ day: string; times: Record<string, string> } | null>(null);
    useEffect(() => {
        let alive = true;
        void getCompletionTimes(day).then(next => { if (alive) setState({ day, times: next }); }).catch(() => { if (alive) setState({ day, times: {} }); });
        return () => { alive = false; };
    }, [day, completions]);
    if (!state || state.day !== day) return { times: {}, ready: false };
    const early: [string, string][] = [];
    for (const [id, done] of Object.entries(completions)) {
        const key = `${day}|${id}`;
        if (!done || state.times[id]) { firstSeen.delete(key); continue; }
        if (!firstSeen.has(key)) firstSeen.set(key, new Date().toISOString());
        early.push([id, firstSeen.get(key)!]);
    }
    return { times: early.length ? { ...state.times, ...Object.fromEntries(early) } : state.times, ready: true };
}
