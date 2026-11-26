import { useEffect, useSyncExternalStore } from 'react';
import { currentWeekStart, getWeekStart, subscribeWeekStart, type WeekStart } from '@/lib/weekStart';

/** The day the week starts on, kept in step with Settings. */
export function useWeekStart(): WeekStart {
    useEffect(() => { void getWeekStart(); }, []);
    return useSyncExternalStore(subscribeWeekStart, currentWeekStart, currentWeekStart);
}
