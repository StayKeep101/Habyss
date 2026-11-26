import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { accountShown, setAccountShown, calendarOn, calendarVersion, checkCalendarAccess, eventsFor, hiddenCalendars, listCalendars, loadCalendarSetting, setCalendarShown, subscribeCalendar, type CalendarInfo, type CalendarSlot } from '@/lib/calendarEvents';

/** Whether the calendar is connected (Settings → Timeline). */
export function useCalendarOn(): boolean {
    useEffect(() => { void loadCalendarSetting(); }, []);
    return useSyncExternalStore(subscribeCalendar, calendarOn, calendarOn);
}

/** That day's calendar events, read again whenever the app comes back to the front. */
export function useCalendarEvents(day: string): CalendarSlot[] {
    const on = useCalendarOn();
    // Read again when a calendar is shown or hidden.
    const version = useSyncExternalStore(subscribeCalendar, calendarVersion, calendarVersion);
    const [events, setEvents] = useState<CalendarSlot[]>([]);
    useEffect(() => {
        let live = true;
        const read = (fresh: boolean) => void eventsFor(day, fresh).then(slots => { if (live) setEvents(slots); });
        read(false);
        const sub = AppState.addEventListener('change', next => { if (next === 'active') void checkCalendarAccess().then(() => read(true)); });
        return () => { live = false; sub.remove(); };
    }, [day, on, version]);
    return on ? events : [];
}

/** The phone's calendars and which are shown, for choosing what reaches the timeline. */
export function useCalendars(): {
    calendars: CalendarInfo[]; shown: (id: string) => boolean; setShown: (id: string, shown: boolean) => void;
    accountShown: (kind: 'event' | 'reminder', source: string) => boolean; setAccountShown: (kind: 'event' | 'reminder', source: string, shown: boolean) => void;
} {
    const on = useCalendarOn();
    const version = useSyncExternalStore(subscribeCalendar, calendarVersion, calendarVersion);
    const [calendars, setCalendars] = useState<CalendarInfo[]>([]);
    useEffect(() => {
        let live = true;
        if (!on) { setCalendars([]); return; }
        void listCalendars().then(list => { if (live) setCalendars(list); });
        return () => { live = false; };
    }, [on, version]);
    return {
        calendars,
        shown: id => !hiddenCalendars().has(id),
        setShown: (id, shown) => void setCalendarShown(id, shown),
        accountShown,
        setAccountShown: (kind, source, shown) => void setAccountShown(kind, source, shown),
    };
}
