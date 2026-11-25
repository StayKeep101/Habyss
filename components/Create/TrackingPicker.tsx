import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HEALTH_GROUPS, healthInfo, type HealthGroup, type HealthMetric } from '@/lib/healthMetrics';
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
const groupOf = (metric: HealthMetric): HealthGroup => healthInfo(metric)?.group ?? 'activity';
const TILE_RADIUS = Math.round(TILE * 0.23);

/**
 * The Tracking chip's panel: how this habit gets ticked, all of it in one
 * place. By hand; from Apple Health (any metric it counts, fed by the Watch,
 * Strava, Bevel, Oura…); from time in apps (Add apps opens Apple's own
 * picker: Libby, Kindle, Duolingo), for the habit's own time, 30 minutes
 * unless it says otherwise; or from time at a place, for that
 * same time. Whichever way is tapped starts on what the habit's name
 * suggests, so a walk ticks itself from Steps with one tap.
 */
export function TrackingPicker({ options, suggested = [], chosen, onChoose, accent, stayPlace, reminderPlace, onStayPlace, appsHabitId, onAddApps, appsCount, appsAvailable, healthAvailable }: {
    /** Every option (lib/autoTrackSources.ts allTrackOptions). */
    options: AutoTrackOption[];
    /** What the habit's name suggests (autoTrackOptions), best first: tapping Health, Apps or Place picks its one of that kind. */
    suggested?: AutoTrackOption[];
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
        // What the name suggests of that kind (Steps for a walk), else the first of it.
        const hint = suggested.find(option => option.kind === next && options.some(item => item.key === option.key));
        const first = hint ?? of(next)[0];
        if (first) onChoose(first.key);
    };
    // Which kind of Health number is showing: the chosen one's, until another is tapped.
    const chosenGroup = chosen?.kind === 'health' ? groupOf(chosen.metric) : null;
    const [shownGroup, setGroup] = React.useState<HealthGroup | null>(null);
    // While a place is searched for, the choices step aside: the field sits first in the panel.
    const [searching, setSearching] = React.useState(false);
    const hinted = suggested.find(option => option.kind === 'health');
    const healthGroup: HealthGroup = shownGroup ?? chosenGroup ?? (hinted?.kind === 'health' ? groupOf(hinted.metric) : 'activity');
    const pick = (key: string) => { if (key !== chosen?.key) { selectionFeedback(); onChoose(key); } };

    return (
        <View style={styles.wrap} onLayout={way === 'place' ? fit.onLayout : undefined}>
            {searching && way === 'place' ? null : <ChoiceRow accessibilityLabel="How it is tracked" options={ways} value={way} onChange={pickWay} color={accent} />}

            {way === 'health' ? (
                <>
                    {/* The kinds first (the day's numbers, sports, gym and studio, sleep and mind), then that kind's. */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.row}>
                        {HEALTH_GROUPS.map(group => (
                            <ChoicePill key={group.id} label={group.label} icon={group.icon} on={healthGroup === group.id} color={accent}
                                onPress={() => { selectionFeedback(); setGroup(group.id); }} />
                        ))}
                    </ScrollView>
                    <View style={styles.pills}>
                        {of('health').filter(option => option.kind === 'health' && groupOf(option.metric) === healthGroup).map(option => (
                            <ChoicePill key={option.key} label={option.label} on={option.key === chosen?.key} color={accent} onPress={() => pick(option.key)} />
                        ))}
                    </View>
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
                    {!searching && reminderPlace && (!stayPlace || stayPlace.latitude !== reminderPlace.latitude || stayPlace.longitude !== reminderPlace.longitude) ? (
                        <View style={styles.pills}>
                            <ChoicePill label={`Same as reminder: ${reminderPlace.name}`} icon="location" on={false} color={accent}
                                onPress={() => { selectionFeedback(); onStayPlace(reminderPlace); }} />
                        </View>
                    ) : null}
                    <InlinePlaceMap place={stayPlace} accent={accent} onPick={point => onStayPlace({ ...point, radius: stayPlace?.radius ?? 150 })} height={fit.height} onSearching={setSearching} />
                </>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    row: { flexDirection: 'row', gap: Spacing.sm },
    apps: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, alignSelf: 'flex-start' },
    tile: { width: TILE, height: TILE, alignItems: 'center', justifyContent: 'center' },
});
