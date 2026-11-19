import React, { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsList';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useCalendars } from '@/hooks/useCalendarEvents';
import { styles } from '@/styles/screens/calendars.styles';

/**
 * Which calendars reach the timeline: every calendar on this iPhone, grouped
 * by account, each in its own colour with a switch. Opened from Use my
 * calendar (components/Calendar/CalendarRow), on Day & calendar or Connected apps.
 */
export default function CalendarsScreen() {
    const t = useTokens();
    const { lightFeedback } = useHaptics();
    const { calendars, shown, setShown } = useCalendars();
    const accounts = useMemo(() => {
        const groups = new Map<string, typeof calendars>();
        for (const item of calendars) groups.set(item.source, [...(groups.get(item.source) ?? []), item]);
        return [...groups.entries()];
    }, [calendars]);
    return (
        <SheetScreen title="Calendars" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {accounts.map(([account, list]) => (
                    <SettingsGroup key={account} title={account}>
                        {list.map(item => (
                            <SettingsRow key={item.id} icon="ellipse" color={item.color || t.color.danger} label={item.title}
                                toggle={shown(item.id)} onToggle={value => { lightFeedback(); setShown(item.id, value); }} />
                        ))}
                    </SettingsGroup>
                ))}
            </ScrollView>
        </SheetScreen>
    );
}
