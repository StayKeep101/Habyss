import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { ChipPicker } from '@/components/ui/ChipPicker';
import { AppButton } from '@/components/ui/AppButton';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';
import { useAccentGradient } from '@/context/AccentContext';
import { setTravel, travelFor } from '@/lib/eventTravel';
import { useEventTravel } from '@/hooks/useEventTravel';

const OPTIONS = ['0', '15', '30', '45', '60', '90', '120'] as const;
type Minutes = typeof OPTIONS[number];
const label = (minutes: Minutes) => minutes === '0' ? 'None' : Number(minutes) < 60 ? `${minutes} min` : `${Number(minutes) / 60} h`;
const clock = (minutes: number) => new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * A calendar event on the timeline: how long it takes to get there and back.
 * School 11:30–12:50 with an hour each way keeps 10:30–1:50 free, and the
 * timeline plans everything else around it. Set once per event name, so
 * every School gets it. The event itself still opens in Calendar.
 */
export function EventSheet({ event, onClose, onOpenCalendar }: {
    event: { title: string; start: number; end: number } | null;
    onClose: () => void;
    onOpenCalendar: () => void;
}) {
    const t = useTokens();
    const { primary } = useAccentGradient();
    const all = useEventTravel();
    const [before, setBefore] = useState<Minutes>('0');
    const [after, setAfter] = useState<Minutes>('0');

    useEffect(() => {
        if (!event) return;
        const travel = travelFor(event.title, all);
        const nearest = (minutes: number) => OPTIONS.reduce((best, option) => Math.abs(Number(option) - minutes) < Math.abs(Number(best) - minutes) ? option : best, '0' as Minutes);
        setBefore(nearest(travel.before));
        setAfter(nearest(travel.after));
    }, [event, all]);

    const choose = (which: 'before' | 'after', value: Minutes) => {
        if (!event) return;
        if (which === 'before') setBefore(value); else setAfter(value);
        void setTravel(event.title, { before: Number(which === 'before' ? value : before), after: Number(which === 'after' ? value : after) });
    };

    if (!event) return null;
    const free = { from: event.start - Number(before), to: event.end + Number(after) };
    return (
        <VoidSheet visible onClose={onClose} title={event.title} caption={`${clock(event.start)} – ${clock(event.end)}`}
            footer={
                <View style={styles.footer}>
                    <AppButton label="Done" onPress={onClose} />
                    <AppButton label="Open in Calendar" variant="ghost" icon="calendar-outline" onPress={onOpenCalendar} />
                </View>
            }>
            <View style={styles.body}>
                <View style={styles.group}>
                    <Text style={[styles.label, { color: t.color.textPrimary }]}>Getting there</Text>
                    <ChipPicker accent={primary} value={before} onChange={value => choose('before', value)}
                        options={OPTIONS.map(id => ({ id, label: label(id) }))} />
                </View>
                <View style={styles.group}>
                    <Text style={[styles.label, { color: t.color.textPrimary }]}>Getting back</Text>
                    <ChipPicker accent={primary} value={after} onChange={value => choose('after', value)}
                        options={OPTIONS.map(id => ({ id, label: label(id) }))} />
                </View>
                <Text style={[styles.note, { color: t.color.textMuted }]} accessibilityLiveRegion="polite">
                    {before === '0' && after === '0'
                        ? `Nothing planned during ${event.title}. Add travel and the time around it is kept free too.`
                        : `Nothing planned from ${clock(free.from)} to ${clock(free.to)}, for every “${event.title}”.`}
                </Text>
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    body: { gap: Spacing.lg, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
    group: { gap: Spacing.xs },
    label: { fontSize: 15, fontFamily: FontFamily.semibold },
    note: { fontSize: 13, fontFamily: FontFamily.regular },
    footer: { gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});
