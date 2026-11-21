import React, { useMemo } from 'react';
import { ScrollView } from 'react-native';
import { EmptyState, SettingsGroup, SettingsRow } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useCalendars } from '@/hooks/useCalendarEvents';
import { styles } from '@/styles/screens/calendars.styles';

/**
 * Calendars, or reminder lists, by account: a switch for the whole account
 * first (off, and nothing of it reaches the timeline), and while it is on,
 * each of its calendars with its own switch. So an account you don't want is
 * one switch, and an account with many calendars can keep just the one.
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
                message={kind === 'event' ? 'Turn on Use my calendar, and allow Habyss to read it.' : 'Allow Habyss to read your reminders, in Settings → Apps → Habyss.'} />
        );
    }
    return (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {accounts.map(([account, list]) => {
                const on = accountShown(kind, account);
                return (
                    <SettingsGroup key={account} title={account}>
                        <SettingsRow icon={kind === 'event' ? 'calendar' : 'list'} color={t.color.accent} label={`Show ${account}`}
                            value={on ? `${list.filter(item => shown(item.id)).length} of ${list.length}` : undefined}
                            toggle={on} onToggle={value => { lightFeedback(); setAccountShown(kind, account, value); redraw(); }} />
                        {on ? list.map(item => (
                            <SettingsRow key={item.id} icon="ellipse" color={item.color || t.color.danger} label={item.title}
                                toggle={shown(item.id)} onToggle={value => { lightFeedback(); setShown(item.id, value); }} />
                        )) : null}
                    </SettingsGroup>
                );
            })}
        </ScrollView>
    );
}
