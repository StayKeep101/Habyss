import { useEffect, useState } from 'react';
import { getCompletionTimes } from '@/lib/habitsSQLite';

/**
 * When each habit was ticked on `day` (ISO times), read again whenever the
 * ticks change, so the timeline shows a done habit where it was really done.
 * `ready` is false until the first read for that day has come back: until
 * then the timeline must not be saved as the day's layout.
 */
export function useDoneTimes(day: string, completions: Record<string, boolean>): { times: Record<string, string>; ready: boolean } {
    const [state, setState] = useState<{ day: string; times: Record<string, string> } | null>(null);
    useEffect(() => {
        let alive = true;
        void getCompletionTimes(day).then(next => { if (alive) setState({ day, times: next }); }).catch(() => { if (alive) setState({ day, times: {} }); });
        return () => { alive = false; };
    }, [day, completions]);
    return state && state.day === day ? { times: state.times, ready: true } : { times: {}, ready: false };
}
