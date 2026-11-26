import React from 'react';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { CalendarSources } from '@/components/Calendar/CalendarSources';

/**
 * Which calendars reach the timeline: every calendar on this iPhone, by
 * account, each account with one switch and its calendars under it
 * (components/Calendar/CalendarSources.tsx). Reminder lists have their own
 * page (app/(root)/reminders.tsx). Opened from Use my calendar.
 */
export default function CalendarsScreen() {
    return (
        <SheetScreen title="Calendars" onBack={() => router.back()}>
            <CalendarSources kind="event" />
        </SheetScreen>
    );
}
