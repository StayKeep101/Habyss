import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { IconButton } from '@/components/ui/IconButton';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { ChoicePill } from '@/components/ui/ChoicePill';
import { DurationWheels } from '@/components/Create/DurationWheels';
import { ALERT_CHOICES } from '@/lib/itemAlerts';
import { InlinePlaceMap, usePlaceMapFit } from '@/components/Create/InlinePlaceMap';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { textOn } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import type { LocationReminder } from '@/lib/habitsSQLite';

type Mode = 'off' | 'before' | 'place';

export interface ReminderValue {
    /** "HH:MM" the reminder fires at (the start time when tied to it). */
    reminder?: string;
    /** Minutes before the start, when tied to it. */
    reminderOffset?: number;
    places: LocationReminder[];
    /** How long before it begins to be told, in minutes (lib/itemAlerts.ts). */
    alerts?: number[];
}

/**
 * When to be reminded, one way at a time — always the same three choices, in
 * the sheet's own colour:
 * - Off (the default): nothing else on screen.
 * - Before: how long before it begins — the usual leads in one tap, then
 *   hours and minutes on wheels, as the Clock app's timer sets them.
 * - At a place: a small map (tap to choose) and whether arriving or leaving.
 *   No leads: it fires as you cross the place's edge, and when you will
 *   arrive is not something the phone can know.
 * Its start is always told as well (lib/dayGuide.ts). No message: Echo
 * writes it in your voice.
 */
export function ReminderPicker({ startTime, value, onChange, accent, onError }: {
    startTime?: string;
    value: ReminderValue;
    onChange: (patch: Partial<ReminderValue>) => void;
    accent: string;
    onError: (message: string) => void;
}) {
    void startTime;
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback, lightFeedback } = useHaptics();
    const lead = value.alerts?.[0];
    // Places are shared with Tracking: a place it tracks time at ("stay") is Tracking's, not a reminder.
    const stays = value.places.filter(item => item.trigger === 'stay');
    const remindAt = value.places.find(item => item.trigger !== 'stay') ?? null;
    const derived: Mode = remindAt ? 'place' : lead || value.reminder ? 'before' : 'off';
    const [chosen, setChosen] = useState<Mode | null>(null);
    const mode = chosen ?? derived;
    const fit = usePlaceMapFit();
    // While a place is searched for, the choices step aside: the field sits first in the panel.
    const [searching, setSearching] = useState(false);
    const pinAt = (point: { latitude: number; longitude: number; name: string }) =>
        onChange({ places: [...stays, { ...point, radius: 150, trigger: remindAt?.trigger ?? 'arrive' }] });

    const pick = (next: Mode) => {
        setChosen(next);
        if (next === 'off') onChange({ reminder: undefined, reminderOffset: undefined, places: stays, alerts: [] });
        if (next === 'before') onChange({ reminder: undefined, reminderOffset: undefined, places: stays, alerts: [lead ?? 10] });
        // A place fires on arriving or leaving, never "before": nobody can know when you will get there.
        if (next === 'place') onChange({ reminder: undefined, reminderOffset: undefined, alerts: [] });
    };
    /** One lead at a time: a shortcut sets it, the wheels fine-tune it. */
    const setLead = (minutes: number) => onChange({ alerts: minutes > 0 ? [minutes] : [] });

    const options = [
        { id: 'off' as Mode, label: 'Off' },
        { id: 'before' as Mode, label: 'Before' },
        { id: 'place' as Mode, label: 'At a place' },
    ];

    return (
        <View style={styles.wrap} onLayout={mode === 'place' ? fit.onLayout : undefined}>
            {searching && mode === 'place' ? null : <ChoiceRow accessibilityLabel="When to remind you" options={options} value={mode} onChange={pick} color={accent} />}

            {mode === 'before' ? (
                // The usual leads, one tap each; tapping the chosen one again takes it off.
                <View style={styles.leads}>
                    {ALERT_CHOICES.map(minutes => (
                        <ChoicePill key={minutes} label={minutes === 60 ? '1 hr' : `${minutes} min`} on={lead === minutes} color={accent}
                            pressStyle={styles.flex} style={styles.lead} textStyle={styles.leadText}
                            accessibilityLabel={`${minutes === 60 ? '1 hour' : `${minutes} minutes`} before`}
                            onPress={() => { selectionFeedback(); setLead(lead === minutes ? 0 : minutes); }} />
                    ))}
                </View>
            ) : null}

            {mode === 'before' ? (
                <View style={styles.block}>
                    <DurationWheels parts={['hours', 'minutes']} seconds={(lead ?? 0) * 60}
                        onChange={seconds => setLead(Math.min(24 * 60, Math.round(seconds / 60)))} />
                </View>
            ) : null}

            {mode === 'place' ? (
                // The map, right here: tap it where the place is; the arrow pins where you are now.
                <View style={styles.block}>
                    <InlinePlaceMap place={remindAt} accent={accent} onPick={pinAt} height={fit.height} onSearching={setSearching}
                        // Arrive or Leave, on the same line as the place's name.
                        trailing={remindAt ? (
                            <>
                                {(['arrive', 'leave'] as const).map(trigger => {
                                    const on = (remindAt.trigger ?? 'arrive') === trigger;
                                    return (
                                        <Pressable key={trigger} accessibilityRole="radio" accessibilityState={{ selected: on }}
                                            accessibilityLabel={TRIGGER_SAID[trigger]} hitSlop={Spacing.sm}
                                            onPress={() => { if (!on) { selectionFeedback(); onChange({ places: [...stays, { ...remindAt, trigger }] }); } }}>
                                            <MatteSurface radius={Radius.pill} level="control" tint={on ? accent : undefined} style={styles.pill}>
                                                <Text style={[styles.pillText, { color: on ? textOn(accent) : colors.textSecondary }]}>{TRIGGER_LABEL[trigger]}</Text>
                                            </MatteSurface>
                                        </Pressable>
                                    );
                                })}
                                <IconButton icon="close" label={`Remove ${remindAt.name}`} diameter={26} size={13} color={colors.textTertiary}
                                    onPress={() => { lightFeedback(); onChange({ places: stays }); }} />
                            </>
                        ) : null} />
                </View>
            ) : null}
        </View>
    );
}

const TRIGGER_LABEL = { arrive: 'Arrive', leave: 'Leave', stay: 'Stay' } as const;
const TRIGGER_SAID = { arrive: 'Remind me when I arrive', leave: 'Remind me when I leave', stay: 'Tick it after time there' } as const;
/** How long at the place before it counts. */


const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
    leads: { flexDirection: 'row', gap: Spacing.xs },
    lead: { paddingHorizontal: Spacing.xs },
    leadText: { fontSize: 12 },
    flex: { flex: 1 },
    block: { gap: Spacing.sm },
    // As tall as the place's name beside them.
    pill: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.md },
    pillText: { fontFamily: FontFamily.medium, fontSize: 13 },
});
