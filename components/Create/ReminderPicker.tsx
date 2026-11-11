import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { IconButton } from '@/components/ui/IconButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { ChoicePill } from '@/components/ui/ChoicePill';
import { DurationWheels } from '@/components/Create/DurationWheels';
import { ALERT_CHOICES } from '@/lib/itemAlerts';
import { PlaceMap, hasPlaceMap } from '@/components/Create/PlaceMap';
import { usePanelRoom } from '@/components/Create/DetailBar';
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
    const room = usePanelRoom();
    const lead = value.alerts?.[0];
    const derived: Mode = value.places.length ? 'place' : lead || value.reminder ? 'before' : 'off';
    const [chosen, setChosen] = useState<Mode | null>(null);
    const mode = chosen ?? derived;
    const [here, setHere] = useState<{ latitude: number; longitude: number } | null>(null);
    const [finding, setFinding] = useState(false);

    const pick = (next: Mode) => {
        setChosen(next);
        if (next === 'off') onChange({ reminder: undefined, reminderOffset: undefined, places: [], alerts: [] });
        if (next === 'before') onChange({ reminder: undefined, reminderOffset: undefined, places: [], alerts: [lead ?? 10] });
        // A place fires on arriving or leaving, never "before": nobody can know when you will get there.
        if (next === 'place') { onChange({ reminder: undefined, reminderOffset: undefined, alerts: [] }); void locate(false); }
    };
    /** One lead at a time: a shortcut sets it, the wheels fine-tune it. */
    const setLead = (minutes: number) => onChange({ alerts: minutes > 0 ? [minutes] : [] });

    /** Where you are: to centre the map, or to add as the place itself. */
    const locate = async (add: boolean) => {
        if (finding) return;
        setFinding(true);
        try {
            const Location = require('expo-location') as typeof import('expo-location');
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') { onError('Habyss needs location access to remind you somewhere.'); return; }
            const fix = await Location.getCurrentPositionAsync({});
            const point = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
            setHere(point);
            if (add || !hasPlaceMap()) await addPlace(point);
        } catch {
            onError('Could not find where you are. Try again.');
        } finally {
            setFinding(false);
        }
    };

    const addPlace = async (point: { latitude: number; longitude: number }) => {
        const already = value.places.some(item => Math.abs(item.latitude - point.latitude) < 0.0005 && Math.abs(item.longitude - point.longitude) < 0.0005);
        if (already) return;
        let name = 'Pinned place';
        try {
            const Location = require('expo-location') as typeof import('expo-location');
            const [place] = await Location.reverseGeocodeAsync(point);
            name = place?.name || place?.street || place?.city || name;
        } catch { /* keep the plain name */ }
        selectionFeedback();
        // One place per habit keeps it simple: choosing another moves it.
        onChange({ places: [{ name, ...point, radius: 150, trigger: value.places[0]?.trigger ?? 'arrive' }] });
    };

    const options = [
        { id: 'off' as Mode, label: 'Off' },
        { id: 'before' as Mode, label: 'Before' },
        { id: 'place' as Mode, label: 'At a place' },
    ];
    const place = value.places[0];
    const mapHeight = Math.max(120, Math.min(220, room - 150));

    return (
        <View style={styles.wrap}>
            <ChoiceRow accessibilityLabel="When to remind you" options={options} value={mode} onChange={pick} color={accent} />

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
                    <Text style={[styles.caption, { color: colors.textTertiary }]}>
                        {lead ? `${leadLabel(lead)} before it starts` : 'Turn the wheels to choose how long before'}
                    </Text>
                </View>
            ) : null}

            {mode === 'place' ? (
                <View style={styles.block}>
                    {hasPlaceMap() ? (
                        <PlaceMap center={here} places={value.places} accent={accent} height={mapHeight} onPick={point => void addPlace(point)} />
                    ) : null}
                    {place ? (
                        <View style={styles.placeRow}>
                            <AppIcon name="location" size={14} color={accent} />
                            <Text numberOfLines={1} style={[styles.placeName, { color: colors.textPrimary }]}>{place.name}</Text>
                            {(['arrive', 'leave'] as const).map(trigger => {
                                const on = (place.trigger ?? 'arrive') === trigger;
                                return (
                                    <Pressable key={trigger} accessibilityRole="radio" accessibilityState={{ selected: on }}
                                        accessibilityLabel={trigger === 'arrive' ? 'When I arrive' : 'When I leave'}
                                        onPress={() => { if (!on) { selectionFeedback(); onChange({ places: [{ ...place, trigger }] }); } }}>
                                        <MatteSurface radius={Radius.pill} level="control" tint={on ? accent : undefined} style={styles.pill}>
                                            <Text style={[styles.pillText, { color: on ? textOn(accent) : colors.textSecondary }]}>{trigger === 'arrive' ? 'Arrive' : 'Leave'}</Text>
                                        </MatteSurface>
                                    </Pressable>
                                );
                            })}
                            <IconButton icon="close" label={`Remove ${place.name}`} diameter={26} size={13} color={colors.textTertiary}
                                onPress={() => { lightFeedback(); onChange({ places: [] }); }} />
                        </View>
                    ) : (
                        <Pressable accessibilityRole="button" onPress={() => void locate(true)} disabled={finding}>
                            <MatteSurface radius={Radius.pill} level="control" style={styles.here}>
                                <AppIcon name={finding ? 'hourglass-outline' : 'navigate'} size={14} color={colors.textPrimary} />
                                <Text style={[styles.pillText, { color: colors.textPrimary }]}>{finding ? 'Finding where you are…' : 'Use where I am now'}</Text>
                            </MatteSurface>
                        </Pressable>
                    )}
                </View>
            ) : null}
        </View>
    );
}

/** "1 hr 30 min", "45 min". */
const leadLabel = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return [hours ? `${hours} hr` : '', rest ? `${rest} min` : ''].filter(Boolean).join(' ');
};

const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
    leads: { flexDirection: 'row', gap: Spacing.xs },
    lead: { paddingHorizontal: Spacing.xs },
    leadText: { fontSize: 12 },
    flex: { flex: 1 },
    block: { gap: Spacing.sm },
    caption: { fontFamily: FontFamily.medium, fontSize: 12, textAlign: 'center' },
    placeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    placeName: { flex: 1, fontFamily: FontFamily.medium, fontSize: 14 },
    pill: { paddingHorizontal: Spacing.md, paddingVertical: 6 },
    pillText: { fontFamily: FontFamily.medium, fontSize: 13 },
    here: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm + 2 },
});
