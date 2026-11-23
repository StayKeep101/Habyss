import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { PlaceMap, hasPlaceMap } from '@/components/Create/PlaceMap';
import { usePanelRoom } from '@/components/Create/DetailBar';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';

export type MapPoint = { latitude: number; longitude: number };
/** A place chosen on the map, and how near counts as there. */
export interface PickedPlace { name: string; latitude: number; longitude: number; radius?: number }

/**
 * The small map, right in a panel (Reminder's "At a place", Tracking's
 * "Place"): centred on you until a place is chosen; tap it where the place
 * is, or the arrow pins where you are now. Its name shows under it. As big as
 * the panel can grow.
 */
export function InlinePlaceMap({ place, accent, onPick }: {
    place: (MapPoint & { name: string }) | null;
    accent: string;
    /** A point chosen, with its name (the street or place found there). */
    onPick: (point: MapPoint & { name: string }) => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();
    const room = usePanelRoom();
    const mapHeight = Math.max(200, Math.min(340, room - 110));
    const [here, setHere] = useState<MapPoint | null>(null);
    const [finding, setFinding] = useState(false);

    useEffect(() => {
        if (place || here) return;
        const timer = setTimeout(() => {
            void (async () => {
                try {
                    const Location = require('expo-location') as typeof import('expo-location');
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== 'granted') return;
                    const fix = await Location.getCurrentPositionAsync({});
                    setHere({ latitude: fix.coords.latitude, longitude: fix.coords.longitude });
                } catch { /* the map starts where it does */ }
            })();
        }, 0);
        return () => clearTimeout(timer);
    }, [place, here]);

    const pinAt = async (point: MapPoint) => {
        let name = 'Pinned place';
        try {
            const Location = require('expo-location') as typeof import('expo-location');
            const [found] = await Location.reverseGeocodeAsync(point);
            name = found?.name || found?.street || found?.city || name;
        } catch { /* the plain name */ }
        selectionFeedback();
        onPick({ name, ...point });
    };
    const pinHere = async () => {
        if (finding) return;
        setFinding(true);
        try {
            const Location = require('expo-location') as typeof import('expo-location');
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const fix = await Location.getCurrentPositionAsync({});
            const point = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
            setHere(point);
            await pinAt(point);
        } catch { /* stays where it was */ } finally { setFinding(false); }
    };

    return (
        <View style={styles.block}>
            {hasPlaceMap() ? (
                <View>
                    <PlaceMap key={place ? `${place.latitude},${place.longitude}` : here ? 'here' : 'start'} center={place ?? here}
                        places={place ? [place] : []} accent={accent} height={mapHeight} onPick={point => void pinAt(point)} />
                    <View style={styles.locate}>
                        <IconButton icon={finding ? 'hourglass-outline' : 'navigate'} label="Use where I am now" diameter={32} size={15}
                            onPress={() => { selectionFeedback(); void pinHere(); }} />
                    </View>
                </View>
            ) : null}
            <MatteSurface radius={Radius.control} level="control" style={styles.here}>
                <AppIcon name="location" size={14} color={accent} />
                <Text numberOfLines={1} style={[styles.placeName, { color: place ? colors.textPrimary : colors.textTertiary }]}>{place ? place.name : 'Tap the map where it is'}</Text>
            </MatteSurface>
        </View>
    );
}

const styles = StyleSheet.create({
    block: { gap: Spacing.sm },
    placeName: { flex: 1, fontFamily: FontFamily.medium, fontSize: 14 },
    here: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm + 2 },
    /** The locate button, in the map's corner. */
    locate: { position: 'absolute', top: Spacing.sm, right: Spacing.sm },
});
