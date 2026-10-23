import { useEffect, useState } from 'react';
import { getCompletionTimes } from '@/lib/habitsSQLite';

/**
 * When each habit was ticked on `day` (ISO times), read again whenever the
 * ticks change, so the timeline shows a done habit where it was really done.
 */
export function useDoneTimes(day: string, completions: Record<string, boolean>): Record<string, string> {
    const [times, setTimes] = useState<Record<string, string>>({});
    useEffect(() => {
        let alive = true;
        void getCompletionTimes(day).then(next => { if (alive) setTimes(next); });
        return () => { alive = false; };
    }, [day, completions]);
    return times;
}
