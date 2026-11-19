import React from 'react';
import { router } from 'expo-router';
import { SettingsRow } from '@/components/ui/SettingsList';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useCalendarOn, useCalendars } from '@/hooks/useCalendarEvents';
import { explainCalendarRefused, setCalendarOn } from '@/lib/calendarEvents';

/**
 * Your calendars on the timeline: a switch, and while it is on, a tap opens
 * the Calendars page to choose which ones (app/(root)/calendars.tsx). The same
 * row on Day & calendar and on Connected apps.
 */
export function CalendarRow({ label = 'Use my calendar' }: { label?: string }) {
    const t = useTokens();
    const { lightFeedback } = useHaptics();
    const on = useCalendarOn();
    const { calendars, shown } = useCalendars();
    const count = calendars.filter(item => shown(item.id)).length;
    const toggle = async (next: boolean) => {
        lightFeedback();
        const done = await setCalendarOn(next);
        if (!done && next) explainCalendarRefused();
    };
    return (
        <SettingsRow icon="calendar" color={t.color.danger} label={label} keywords="calendar events google apple"
            value={on && calendars.length ? `${count} of ${calendars.length}` : undefined}
            toggle={on} onToggle={value => void toggle(value)}
            onPress={() => router.push('/(root)/calendars' as never)} />
    );
}
