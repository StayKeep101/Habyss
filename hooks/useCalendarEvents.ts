import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { calendarOn, eventsFor, loadCalendarSetting, subscribeCalendar, type CalendarSlot } from '@/lib/calendarEvents';

/** Whether the calendar is connected (Settings → Timeline). */
export function useCalendarOn(): boolean {
    useEffect(() => { void loadCalendarSetting(); }, []);
    return useSyncExternalStore(subscribeCalendar, calendarOn, calendarOn);
}

/** That day's calendar events, read again whenever the app comes back to the front. */
export function useCalendarEvents(day: string): CalendarSlot[] {
    const on = useCalendarOn();
    const [events, setEvents] = useState<CalendarSlot[]>([]);
    useEffect(() => {
        let live = true;
        const read = (fresh: boolean) => void eventsFor(day, fresh).then(slots => { if (live) setEvents(slots); });
        read(false);
        const sub = AppState.addEventListener('change', next => { if (next === 'active') read(true); });
        return () => { live = false; sub.remove(); };
    }, [day, on]);
    return on ? events : [];
}
