import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppButton, AppIcon, MatteSurface, Text, VoidSheet } from '@/components/ui';
import { useHaptics } from '@/hooks/useHaptics';
import { useTokens } from '@/hooks/useTokens';
import { PlaceMap, hasPlaceMap } from '@/components/Create/PlaceMap';
import { Radius, Spacing } from '@/theme/designSystem';

export interface PickedPlace { name: string; latitude: number; longitude: number; radius?: number }
type Point = { latitude: number; longitude: number };

/**
 * Choosing a place, on a map as big as the phone allows: tap the map where it
 * is, or use where you are now; its name is read from the address. Used by a
 * reminder at a place and by tracking time at a place (the same map, one
 * place each). `shortcut` offers a place already set elsewhere ("Same as your
 * reminder"). Done keeps it; closing leaves things as they were.
 */
export function PlaceSheet({ visible, title, initial, shortcut, onClose, onDone, footer }: {
    visible: boolean;
    title: string;
    initial: PickedPlace | null;
    shortcut?: { label: string; place: PickedPlace } | null;
    onClose: () => void;
    onDone: (place: PickedPlace) => void;
    /** Under the map: what to do there (Arrive · Leave, or how long). */
    footer?: React.ReactNode;
}) {
    const t = useTokens();
    const { height } = useWindowDimensions();
    const { selectionFeedback } = useHaptics();
    const [place, setPlace] = useState<PickedPlace | null>(initial);
    const [here, setHere] = useState<Point | null>(null);
    const [finding, setFinding] = useState(false);
    // Opened again: starts from what is set now.
    const [shownFor, setShownFor] = useState(visible);
    if (visible !== shownFor) { setShownFor(visible); if (visible) setPlace(initial); }

    const named = async (point: Point): Promise<PickedPlace> => {
        let name = 'Pinned place';
        try {
            const Location = require('expo-location') as typeof import('expo-location');
            const [found] = await Location.reverseGeocodeAsync(point);
            name = found?.name || found?.street || found?.city || name;
        } catch { /* the plain name */ }
        return { name, ...point, radius: 150 };
    };
    const locate = async (pick: boolean) => {
        if (finding) return;
        setFinding(true);
        try {
            const Location = require('expo-location') as typeof import('expo-location');
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const fix = await Location.getCurrentPositionAsync({});
            const point = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
            setHere(point);
            if (pick) { selectionFeedback(); setPlace(await named(point)); }
        } catch { /* stays where it was */ } finally { setFinding(false); }
    };
    // Centre the map on you, when there is no place yet.
    useEffect(() => {
        if (!visible || initial) return;
        const timer = setTimeout(() => void locate(false), 0);
        return () => clearTimeout(timer);
    }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

    // As tall as the sheet allows, less its title, the place's line and the buttons.
    const mapHeight = Math.max(260, height * 0.94 - Spacing.section * 9);
    return (
        <VoidSheet visible={visible} onClose={onClose} title={title} maxShare={0.94}
            footer={(
                <View style={styles.foot}>
                    <AppButton label="Done" icon="checkmark" variant="primary" disabled={!place} onPress={() => { if (place) { selectionFeedback(); onDone(place); } }} />
                </View>
            )}>
            <View style={styles.body}>
                {hasPlaceMap() ? (
                    <PlaceMap key={here ? "here" : "start"} center={place ?? here} places={place ? [place] : []} accent={t.color.accent} height={mapHeight}
                        onPick={point => { selectionFeedback(); void named(point).then(setPlace); }} />
                ) : null}
                <View style={styles.row}>
                    <AppIcon name="location" size={Spacing.lg} color={place ? t.color.accent : t.color.textSubtle} />
                    <Text variant="body" grow numberOfLines={1} tone={place ? 'primary' : 'muted'}>{place ? place.name : 'Tap the map where it is'}</Text>
                </View>
                <View style={styles.chips}>
                    <Pressable accessibilityRole="button" onPress={() => void locate(true)} disabled={finding}>
                        <MatteSurface radius={Radius.pill} level="control" style={styles.chip}>
                            <AppIcon name={finding ? 'hourglass-outline' : 'navigate'} size={Spacing.md + 2} color={t.color.textPrimary} />
                            <Text variant="bodySmall">{finding ? 'Finding you…' : 'Where I am now'}</Text>
                        </MatteSurface>
                    </Pressable>
                    {shortcut ? (
                        <Pressable accessibilityRole="button" onPress={() => { selectionFeedback(); setPlace(shortcut.place); }}>
                            <MatteSurface radius={Radius.pill} level="control" style={styles.chip}>
                                <AppIcon name="link" size={Spacing.md + 2} color={t.color.textPrimary} />
                                <Text variant="bodySmall" numberOfLines={1}>{shortcut.label}</Text>
                            </MatteSurface>
                        </Pressable>
                    ) : null}
                </View>
                {footer}
            </View>
        </VoidSheet>
    );
}

const styles = StyleSheet.create({
    body: { paddingHorizontal: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.sm },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, minHeight: Spacing.section + Spacing.sm },
    foot: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
});
