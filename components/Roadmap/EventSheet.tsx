import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VoidSheet } from '@/components/ui/VoidSheet';
import { ChipPicker } from '@/components/ui/ChipPicker';
import { StepSlider } from '@/components/ui/StepSlider';
import { AppButton } from '@/components/ui/AppButton';
import { Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';
import { useAccentGradient } from '@/context/AccentContext';
import { scopeOf, setTravel, travelOf, type Travel, type TravelScope } from '@/lib/eventTravel';
import { useEventTravel } from '@/hooks/useEventTravel';
import { useRetained } from '@/hooks/useRetained';

/** Every few minutes up to an hour, then by the quarter, half and whole hour: any trip, in one slide. */
const TRIP = [0, 5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 120, 150, 180, 240] as const;
/** How long before leaving the heads-up comes. */
const HEADS_UP = [0, 5, 10, 15, 20, 30, 45, 60] as const;
type Scope = TravelScope;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const length = (minutes: number) => minutes === 0 ? 'None'
    : minutes < 60 ? `${minutes} min`
    : minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60}` : `${minutes / 60} h`;
const clock = (minutes: number) => new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
/** The step nearest a stored value, so an older value still shows on the slider. */
const nearest = <T extends number>(values: readonly T[], minutes: number): T =>
    values.reduce((best, option) => Math.abs(option - minutes) < Math.abs(best - minutes) ? option : best, values[0]);

/**
 * A calendar event on the timeline: how long it takes to get there and back,
 * and a heads-up before it is time to leave. School 11:30–12:50 with an hour
 * each way keeps 10:30–1:50 free, the timeline plans everything else around
 * it and a notification says when to leave. Set for every event with its name
 * (every School), for that name on this weekday (Tuesday's class is further
 * away than Thursday's) or for this one on this day only (a trip somewhere new).
 * The event itself still opens in Calendar.
 */
export function EventSheet({ event: asked, day, onClose, onOpenCalendar }: {
    event: { id: string; title: string; start: number; end: number } | null;
    /** The day shown, for travel set on this day only. */
    day: string;
    onClose: () => void;
    onOpenCalendar: () => void;
}) {
    const t = useTokens();
    const { primary } = useAccentGradient();
    // Kept while it slides away, so closing is as smooth as opening.
    const event = useRetained(asked);
    const all = useEventTravel();
    const [scope, setScope] = useState<Scope>('every');
    const [travel, setLocal] = useState<Travel>({ before: 0, after: 0, warn: 0 });

    // Read when it opens (and when the store first loads), never while sliding.
    useEffect(() => {
        if (!asked) return;
        const set = travelOf(all, asked, day) ?? { before: 0, after: 0 };
        setScope(scopeOf(all, asked, day));
        setLocal({ before: nearest(TRIP, set.before), after: nearest(TRIP, set.after), warn: nearest(HEADS_UP, set.warn ?? 0) });
    }, [asked, day]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = (next: Travel, nextScope: Scope = scope) => {
        if (!event) return;
        setLocal(next);
        void setTravel(event, next, { day, reach: nextScope });
    };
    const choose = (key: keyof Travel) => (value: number) => save({ ...travel, [key]: value });
    const chooseScope = (value: Scope) => { setScope(value); save(travel, value); };

    if (!event) return null;
    const leave = event.start - travel.before;
    const free = { from: leave, to: event.end + travel.after };
    const weekday = WEEKDAYS[new Date(`${day}T12:00:00`).getDay()];
    return (
        <VoidSheet visible={!!asked} onClose={onClose} title={event.title} caption={`${clock(event.start)} – ${clock(event.end)}`}
            footer={
                <View style={styles.footer}>
                    <AppButton label="Done" onPress={onClose} />
                    <AppButton label="Open in Calendar" variant="ghost" icon="calendar-outline" onPress={onOpenCalendar} />
                </View>
            }>
            <View style={styles.body}>
                <ChipPicker accent={primary} value={scope} onChange={chooseScope}
                    options={[{ id: 'every', label: 'Every time' }, { id: 'weekday', label: `${weekday}s` }, { id: 'once', label: 'This day' }]} />
                <StepSlider label="Getting there" values={TRIP} value={nearest(TRIP, travel.before)} onChange={choose('before')} say={length} />
                <StepSlider label="Getting back" values={TRIP} value={nearest(TRIP, travel.after)} onChange={choose('after')} say={length} />
                {travel.before > 0 && (
                    <StepSlider label="Heads-up before leaving" values={HEADS_UP} value={nearest(HEADS_UP, travel.warn ?? 0)} onChange={choose('warn')}
                        say={value => value ? `${length(value)} before` : 'None'} />
                )}
                <Text style={[t.type.bodySmall, { color: t.color.textMuted }]} accessibilityLiveRegion="polite">
                    {travel.before === 0 && travel.after === 0
                        ? 'Add travel to keep the time around it free.'
                        : `${travel.before ? `Leave at ${clock(Math.max(0, leave))} · ` : ''}Blocked ${clock(Math.max(0, free.from))}–${clock(Math.min(24 * 60 - 1, free.to))}`}
                </Text>
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    body: { gap: Spacing.lg, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
    footer: { gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
});
