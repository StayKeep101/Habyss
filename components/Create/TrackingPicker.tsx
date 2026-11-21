import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AppButton, ChoicePill, ChoiceRow, Text } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { Spacing } from '@/theme/designSystem';
import type { AutoTrackOption } from '@/lib/autoTrackSources';

type Way = 'off' | 'health' | 'app' | 'place';
const WAYS: { id: Way; label: string }[] = [
    { id: 'off', label: 'By hand' }, { id: 'health', label: 'Health' }, { id: 'app', label: 'Apps' }, { id: 'place', label: 'Place' },
];
const minutesSaid = (minutes: number) => (minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`);
const PLACE_MINUTES = [10, 15, 20, 30, 45, 60, 90];

/**
 * The Tracking chip's panel: how this habit gets ticked, all of it in one
 * place. By hand; from Apple Health (any metric it counts, fed by the Watch,
 * Strava, Bevel, Oura…); from time in apps (Libby, Kindle, Duolingo: chosen
 * in Apple's own picker), and for how long; or from time at a place, and for
 * how long. What each means is said under it, in one line.
 */
export function TrackingPicker({ options, chosen, onChoose, minutes, onMinutes, accent, placeName, onPickPlace, onChangeApps, appsLinked, appsAvailable, healthAvailable }: {
    /** Every option (lib/autoTrackSources.ts allTrackOptions). */
    options: AutoTrackOption[];
    chosen: AutoTrackOption | null;
    onChoose: (key: string) => void;
    /** For apps and a place: how long before it counts. */
    minutes: number;
    onMinutes: (minutes: number) => void;
    accent: string;
    placeName?: string;
    onPickPlace: () => void;
    /** Editing a habit already linked to apps: choose them again now. */
    onChangeApps?: () => void;
    appsLinked?: boolean;
    appsAvailable: boolean;
    healthAvailable: boolean;
}) {
    const { selectionFeedback } = useHaptics();
    const way: Way = chosen?.kind ?? 'off';
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
        <View style={styles.wrap}>
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
                    <View style={styles.pills}>
                        {of('app').map(option => (
                            <ChoicePill key={option.key} label={option.label} on={option.key === chosen.key} color={accent} onPress={() => pick(option.key)} />
                        ))}
                    </View>
                    <View style={styles.pills}>
                        {chosen.idea.choices.map(value => (
                            <ChoicePill key={value} label={minutesSaid(value)} on={value === minutes} color={accent} onPress={() => { selectionFeedback(); onMinutes(value); }} />
                        ))}
                    </View>
                    <Text variant="caption" tone="muted">
                        {`${chosen.idea.quit ? `Kept when the day ends under ${minutesSaid(minutes)}` : `Ticks itself after ${minutesSaid(minutes)}`} in the apps you choose. ${appsLinked ? '' : 'Apple’s picker opens when you save: tap Libby, Kindle, or any app.'}`}
                    </Text>
                    {appsLinked && onChangeApps ? <AppButton label="Change apps" icon="apps" onPress={onChangeApps} /> : null}
                </>
            ) : null}

            {way === 'place' ? (
                <>
                    <View style={styles.pills}>
                        {PLACE_MINUTES.map(value => (
                            <ChoicePill key={value} label={minutesSaid(value)} on={value === minutes} color={accent} onPress={() => { selectionFeedback(); onMinutes(value); }} />
                        ))}
                    </View>
                    <Text variant="caption" tone="muted">
                        {placeName ? `Ticks itself after ${minutesSaid(minutes)} at ${placeName}.` : `Ticks itself after ${minutesSaid(minutes)} there.`}
                    </Text>
                    <AppButton label={placeName ? 'Change the place' : 'Choose the place'} icon="location" onPress={onPickPlace} />
                </>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
