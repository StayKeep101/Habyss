import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppIcon, AppIcons, appIconsSupported, ChoicePill, ChoiceRow, MatteSurface, Text } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { Spacing } from '@/theme/designSystem';
import type { AutoTrackOption } from '@/lib/autoTrackSources';
import { InlinePlaceMap, usePlaceMapFit, type PickedPlace } from '@/components/Create/InlinePlaceMap';

type Way = 'off' | 'health' | 'app' | 'place';
const WAYS: { id: Way; label: string }[] = [
    { id: 'off', label: 'By hand' }, { id: 'health', label: 'Health' }, { id: 'app', label: 'Apps' }, { id: 'place', label: 'Place' },
];
// An app icon's size, and its rounded-square corner (as iOS draws them: 23% of the side).
const TILE = Spacing.section + Spacing.md;
const TILE_RADIUS = Math.round(TILE * 0.23);

/**
 * The Tracking chip's panel: how this habit gets ticked, all of it in one
 * place. By hand; from Apple Health (any metric it counts, fed by the Watch,
 * Strava, Bevel, Oura…); from time in apps (Add apps opens Apple's own
 * picker: Libby, Kindle, Duolingo), for the habit's own time, 30 minutes
 * unless it says otherwise; or from time at a place, for that
 * same time. What each means is said under it, in one line.
 */
export function TrackingPicker({ options, chosen, onChoose, accent, stayPlace, reminderPlace, onStayPlace, appsHabitId, onAddApps, appsCount, appsAvailable, healthAvailable }: {
    /** Every option (lib/autoTrackSources.ts allTrackOptions). */
    options: AutoTrackOption[];
    chosen: AutoTrackOption | null;
    onChoose: (key: string) => void;
    accent: string;
    /** The place it counts time at, and a reminder's place to offer as the same. */
    stayPlace: PickedPlace | null;
    reminderPlace: PickedPlace | null;
    onStayPlace: (place: PickedPlace | null) => void;
    /** The habit the apps are chosen for (its id, new or saved), to show their icons. */
    appsHabitId?: string;
    /** Opens Apple's app picker. */
    onAddApps: () => void;
    /** How many apps are chosen so far. */
    appsCount: number;
    appsAvailable: boolean;
    healthAvailable: boolean;
}) {
    const { selectionFeedback } = useHaptics();
    const way: Way = chosen?.kind ?? 'off';
    const fit = usePlaceMapFit();
    const ways = WAYS.filter(item => (item.id !== 'health' || healthAvailable) && (item.id !== 'app' || appsAvailable) && (item.id !== 'health' || options.some(option => option.kind === 'health')));
    const of = (kind: Way) => options.filter(option => option.kind === kind);
    const pickWay = (next: Way) => {
        if (next === way) return;
        if (next === 'off') { onChoose('off'); return; }
        // The first of that kind, unless one of it was already chosen.
        const first = of(next)[0];
        if (first) onChoose(first.key);
    };
    const pick = (key: string) => { if (key !== chosen?.key) { selectionFeedback(); onChoose(key); } };

    return (
        <View style={styles.wrap} onLayout={way === 'place' ? fit.onLayout : undefined}>
            <ChoiceRow accessibilityLabel="How it is tracked" options={ways} value={way} onChange={pickWay} color={accent} />

            {way === 'health' ? (
                <>
                    <View style={styles.pills}>
                        {of('health').map(option => (
                            <ChoicePill key={option.key} label={option.label} on={option.key === chosen?.key} color={accent} onPress={() => pick(option.key)} />
                        ))}
                    </View>
                    {chosen ? <Text variant="caption" tone="muted">{chosen.detail}</Text> : null}
                </>
            ) : null}

            {way === 'app' && chosen?.kind === 'app' ? (
                <>
                    {/* The apps, as their icons (up to five; past that, how many), then a rounded square with a
                        plus that opens Apple's own picker. Tapping the icons opens it too. */}
                    <Pressable onPress={onAddApps} accessibilityRole="button"
                        accessibilityLabel={appsCount ? `${appsCount} app${appsCount > 1 ? 's' : ''} chosen. Change apps` : 'Add apps'} style={styles.apps}>
                        {appsCount && appsHabitId && appsCount <= 5 && appIconsSupported() ? (
                            <AppIcons habitId={appsHabitId} version={appsCount} size={TILE} count={appsCount} />
                        ) : appsCount ? (
                            <MatteSurface radius={TILE_RADIUS} level="control" style={styles.tile}>
                                <Text variant="heading" numeric>{appsCount}</Text>
                            </MatteSurface>
                        ) : null}
                        <MatteSurface radius={TILE_RADIUS} level="control" style={styles.tile}>
                            <AppIcon name="add" size={Spacing.xxl} color={accent} />
                        </MatteSurface>
                        {appsCount ? null : <Text variant="body" tone="muted">Add apps</Text>}
                    </Pressable>
                </>
            ) : null}

            {way === 'place' ? (
                <>
                    {reminderPlace && (!stayPlace || stayPlace.latitude !== reminderPlace.latitude || stayPlace.longitude !== reminderPlace.longitude) ? (
                        <View style={styles.pills}>
                            <ChoicePill label={`Same as reminder: ${reminderPlace.name}`} icon="location" on={false} color={accent}
                                onPress={() => { selectionFeedback(); onStayPlace(reminderPlace); }} />
                        </View>
                    ) : null}
                    <InlinePlaceMap place={stayPlace} accent={accent} onPick={point => onStayPlace({ ...point, radius: stayPlace?.radius ?? 150 })} height={fit.height} />
                </>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    apps: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, alignSelf: 'flex-start' },
    tile: { width: TILE, height: TILE, alignItems: 'center', justifyContent: 'center' },
});
