import React, { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { EmptyState, SettingsGroup, SettingsRow } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useCalendars } from '@/hooks/useCalendarEvents';
import { allowReminders } from '@/lib/calendarEvents';
import { styles } from '@/styles/screens/calendars.styles';

/**
 * Calendars, or reminder lists, by account: a switch beside the account's
 * name turns every one of its calendars on or off at once, and each calendar
 * has its own switch under it. So an account you don't want is one switch,
 * and an account with many calendars can keep just the one.
 */
export function CalendarSources({ kind }: { kind: 'event' | 'reminder' }) {
    const t = useTokens();
    const { lightFeedback } = useHaptics();
    const { calendars, shown, setShown, accountShown, setAccountShown } = useCalendars();
    const accounts = useMemo(() => {
        const groups = new Map<string, typeof calendars>();
        for (const item of calendars.filter(entry => entry.kind === kind)) groups.set(item.source, [...(groups.get(item.source) ?? []), item]);
        return [...groups.entries()];
    }, [calendars, kind]);
    const [, redraw] = React.useReducer((n: number) => n + 1, 0);

    if (!accounts.length) {
        return (
            <EmptyState icon={kind === 'event' ? 'calendar-outline' : 'list-outline'}
                title={kind === 'event' ? 'No calendars yet' : 'No reminder lists yet'}
                message={kind === 'event' ? 'Turn on Use my calendar, and allow Habyss to read it.' : 'Let Habyss read your reminders, and the ones with a time show on your timeline.'}
                {...(kind === 'reminder' ? { actionLabel: 'Allow Reminders', onAction: () => void allowReminders().then(ok => {
                    if (!ok) (require('react-native') as typeof import('react-native')).Alert.alert('Reminders are off for Habyss', 'Turn them on in Settings → Apps → Habyss → Reminders.');
                }) } : null)} />
        );
    }
    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {accounts.map(([account, list]) => {
                const anyOn = accountShown(kind, account) && list.some(item => shown(item.id));
                // The switch beside the account's name turns all of its calendars on or off, each one.
                const setAll = (value: boolean) => {
                    lightFeedback();
                    if (!accountShown(kind, account)) setAccountShown(kind, account, true);
                    for (const item of list) setShown(item.id, value);
                    redraw();
                };
                return (
                    <SettingsGroup key={account} title={account} toggle={{ label: `All ${account} ${kind === 'event' ? 'calendars' : 'lists'}`, value: anyOn, onChange: setAll }}>
                        {list.map(item => (
                            <SettingsRow key={item.id} icon="ellipse" color={item.color || t.color.danger} label={item.title}
                                toggle={accountShown(kind, account) && shown(item.id)}
                                onToggle={value => { lightFeedback(); if (!accountShown(kind, account)) setAccountShown(kind, account, true); setShown(item.id, value); redraw(); }} />
                        ))}
                    </SettingsGroup>
                );
            })}
        </ScrollView>
    );
}
