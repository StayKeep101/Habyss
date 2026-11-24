import { useEffect, useState } from 'react';
import { getDayWindow } from '@/lib/echo';
import { isNight } from '@/lib/bedtimeLock';

const toMinute = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

/**
 * Your night: bedtime and wake-up as minutes of the day (Settings → Day &
 * calendar), read once; null until read. `asleep(minute)`: whether that
 * minute is in the night, when free time is sleep time.
 */
export function useBedtime(): { wake: number; sleep: number; asleep: (minute: number) => boolean } | null {
    const [day, setDay] = useState<{ wake: number; sleep: number } | null>(null);
    useEffect(() => {
        let live = true;
        void getDayWindow().then(window => { if (live) setDay({ wake: toMinute(window.wake), sleep: toMinute(window.sleep) }); }).catch(() => undefined);
        return () => { live = false; };
    }, []);
    if (!day) return null;
    return { ...day, asleep: minute => isNight(Math.floor(minute) % 1440, day.wake, day.sleep) };
}
