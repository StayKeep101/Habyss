import { useEffect, useState } from 'react';
import { on } from '@/lib/appEvents';
import { SHARE_CHANGED, cachedDayShare, getDayShare, type DayShare } from '@/lib/dayShare';

/** How much of the day the timeline plans, kept current as it is changed. */
export function useDayShare(): DayShare {
    const [share, setShare] = useState<DayShare>(cachedDayShare());
    useEffect(() => {
        let alive = true;
        void getDayShare().then(value => { if (alive) setShare(value); });
        const sub = on(SHARE_CHANGED, value => setShare(value as DayShare));
        return () => { alive = false; sub.remove(); };
    }, []);
    return share;
}
