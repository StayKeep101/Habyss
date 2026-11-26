import React from 'react';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { CalendarSources } from '@/components/Calendar/CalendarSources';

/**
 * Which Apple Reminders lists reach the timeline: by account, each account
 * with one switch and its lists under it (components/Calendar/CalendarSources.tsx).
 * Calendars have their own page (app/(root)/calendars.tsx).
 */
export default function RemindersScreen() {
    return (
        <SheetScreen title="Reminders" onBack={() => router.back()}>
            <CalendarSources kind="reminder" />
        </SheetScreen>
    );
}
