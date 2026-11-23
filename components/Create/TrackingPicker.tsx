import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton, AppIcons, ChoicePill, ChoiceRow, Text } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { Spacing } from '@/theme/designSystem';
import type { AutoTrackOption } from '@/lib/autoTrackSources';
import { InlinePlaceMap, usePlaceMapFit, type PickedPlace } from '@/components/Create/InlinePlaceMap';

type Way = 'off' | 'health' | 'app' | 'place';
const WAYS: { id: Way; label: string }[] = [
    { id: 'off', label: 'By hand' }, { id: 'health', label: 'Health' }, { id: 'app', label: 'Apps' }, { id: 'place', label: 'Place' },
];
const minutesSaid = (minutes: number) => (minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`);

/**
 * The Tracking chip's panel: how this habit gets ticked, all of it in one
 * place. By hand; from Apple Health (any metric it counts, fed by the Watch,
 * Strava, Bevel, Oura…); from time in apps (Add apps opens Apple's own
 * picker: Libby, Kindle, Duolingo), for the habit's own time, 30 minutes
 * unless it says otherwise; or from time at a place, for that
 * same time. What each means is said under it, in one line.
 */
export function TrackingPicker({ options, chosen, onChoose, minutes, accent, stayPlace, reminderPlace, onStayPlace, appsHabitId, onAddApps, appsCount, minutesFromHabit, appsAvailable, healthAvailable }: {
    /** Every option (lib/autoTrackSources.ts allTrackOptions). */
    options: AutoTrackOption[];
    chosen: AutoTrackOption | null;
    onChoose: (key: string) => void;
    /** How long before it counts: the habit's own time (its amount in minutes, else its length). */
    minutes: number;
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
    /** The time came from the habit itself (its amount or length), not the 30-minute default. */
    minutesFromHabit?: boolean;
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

            {way === 'off' ? (
                <Text variant="caption" tone="muted">You tick it yourself. A photo, if you like.</Text>
            ) : null}

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
                    {/* Which apps: Apple's own picker, opened right here. How long: the habit's own time. */}
                    {/* The apps themselves, by their icons, once there are some. */}
                    {appsCount && appsHabitId ? <AppIcons habitId={appsHabitId} version={appsCount} /> : null}
                    <AppButton label={appsCount ? `${appsCount} app${appsCount > 1 ? 's' : ''} chosen · Change` : 'Add apps'} icon={appsCount ? 'apps' : 'add'}
                        variant={appsCount ? 'default' : 'primary'} onPress={onAddApps} />
                    <Text variant="caption" tone="muted">
                        {`${chosen.idea.quit ? `Kept when the day ends under ${minutesSaid(minutes)}` : `Ticks itself after ${minutesSaid(minutes)}`} in ${appsCount ? 'them' : 'the apps you add'}. ${minutesFromHabit ? '' : 'Set another time in Measure.'}`}
                    </Text>
                </>
            ) : null}

            {way === 'place' ? (
                <>
                    <Text variant="caption" tone="muted">
                        {stayPlace ? `Ticks itself after ${minutesSaid(minutes)} at ${stayPlace.name}.` : `Ticks itself after ${minutesSaid(minutes)} there.`}
                    </Text>
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
});
