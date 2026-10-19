import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChoiceRow } from '@/components/ui/ChoiceRow';
import { IconButton } from '@/components/ui/IconButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { TimeWheels } from '@/components/ui/TimeWheels';
import { PlaceMap, hasPlaceMap } from '@/components/Create/PlaceMap';
import { usePanelRoom } from '@/components/Create/DetailBar';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { textOn } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import type { LocationReminder } from '@/lib/habitsSQLite';

type Mode = 'off' | 'time' | 'place';

export interface ReminderValue {
    /** "HH:MM" the reminder fires at (the start time when tied to it). */
    reminder?: string;
    /** Minutes before the start, when tied to it. */
    reminderOffset?: number;
    places: LocationReminder[];
}

/**
 * When to be reminded, one way at a time — always the same three choices:
 * - Off: nothing else on screen.
 * - At a time: a clock time on wheels.
 * - At a place: a small map (tap to choose), then whether arriving or leaving.
 * No message: Echo writes it in your voice.
 */
export function ReminderPicker({ startTime, value, onChange, accent, onError }: {
    startTime?: string;
    value: ReminderValue;
    onChange: (patch: Partial<ReminderValue>) => void;
    accent: string;
    onError: (message: string) => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback, lightFeedback } = useHaptics();
    const room = usePanelRoom();
    // A reminder once tied to the start time shows as the clock time it fires at.
    const derived: Mode = value.reminder ? 'time' : value.places.length ? 'place' : 'off';
    const [chosen, setChosen] = useState<Mode | null>(null);
    const mode = chosen === 'place' || (chosen === 'off' && derived === 'off') ? chosen : derived;
    const [here, setHere] = useState<{ latitude: number; longitude: number } | null>(null);
    const [finding, setFinding] = useState(false);

    const pick = (next: Mode) => {
        setChosen(next);
        if (next === 'off') onChange({ reminder: undefined, reminderOffset: undefined, places: [] });
        if (next === 'time') onChange({ reminder: value.reminder ?? startTime ?? '08:00', reminderOffset: undefined, places: [] });
        if (next === 'place') { onChange({ reminder: undefined, reminderOffset: undefined }); void locate(false); }
    };

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
        { id: 'time' as Mode, label: 'At a time' },
        { id: 'place' as Mode, label: 'At a place' },
    ];
    const place = value.places[0];
    const mapHeight = Math.max(120, Math.min(220, room - 150));

    return (
        <View style={styles.wrap}>
            <ChoiceRow accessibilityLabel="When to remind you" options={options} value={mode} onChange={pick} />

            {mode === 'time' ? (
                <View style={styles.block}>
                    <TimeWheels value={value.reminder ?? '08:00'} onChange={reminder => onChange({ reminder, reminderOffset: undefined })} />
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

const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
    block: { gap: Spacing.sm },
    caption: { fontFamily: FontFamily.medium, fontSize: 12, textAlign: 'center' },
    placeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    placeName: { flex: 1, fontFamily: FontFamily.medium, fontSize: 14 },
    pill: { paddingHorizontal: Spacing.md, paddingVertical: 6 },
    pillText: { fontFamily: FontFamily.medium, fontSize: 13 },
    here: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm + 2 },
});
