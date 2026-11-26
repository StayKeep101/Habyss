import { useEffect, useSyncExternalStore } from 'react';
import { localDateKey } from '@/lib/habitSchedule';
import { loadTimeOff, subscribeTimeOff, timeOffOn, timeOffPeriods, type TimeOff } from '@/lib/timeOff';

/** Every period of time off (sick, vacation), kept up to date: a page that counts days reads it so it recounts when one starts or ends. */
export function useTimeOffPeriods(): TimeOff[] {
    useEffect(() => { void loadTimeOff(); }, []);
    return useSyncExternalStore(subscribeTimeOff, timeOffPeriods, timeOffPeriods);
}

/** The time off running today, if any. */
export function useTimeOff(): TimeOff | null {
    const today = localDateKey(new Date());
    return timeOffOn(useTimeOffPeriods(), today, today);
}
