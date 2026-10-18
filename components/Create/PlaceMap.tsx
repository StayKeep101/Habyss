import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';

type Point = { latitude: number; longitude: number };

/** The map view, when this build has it (Apple Maps, iOS 17+). Older builds fall back to "use where I am now". */
function appleMaps(): any | null {
    try {
        const { requireOptionalNativeModule } = require('expo-modules-core') as typeof import('expo-modules-core');
        if (!requireOptionalNativeModule('ExpoMaps')) return null;
        return require('expo-maps').AppleMaps;
    } catch {
        return null;
    }
}

export const hasPlaceMap = (): boolean => !!appleMaps();

/**
 * A small map to choose a place: tap anywhere to drop the pin there. The
 * places already chosen show as pins with the circle they cover.
 */
export function PlaceMap({ center, places, accent, height, onPick }: {
    center: Point | null;
    places: (Point & { radius?: number; name: string })[];
    accent: string;
    height: number;
    onPick: (point: Point) => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const Maps = appleMaps();
    const [start] = useState(() => center ?? places[0] ?? { latitude: 43.6532, longitude: -79.3832 });
    if (!Maps) return null;
    return (
        <View style={[styles.frame, { height, borderColor: colors.border }]}>
            <Maps.View
                style={StyleSheet.absoluteFill}
                colorScheme={theme === 'light' ? 'LIGHT' : 'DARK'}
                cameraPosition={{ coordinates: start, zoom: 15 }}
                markers={places.map((place, index) => ({ id: String(index), coordinates: place, title: place.name, tintColor: accent }))}
                circles={places.map((place, index) => ({ id: `c${index}`, center: place, radius: place.radius ?? 150, color: `${accent}33` }))}
                uiSettings={{ compassEnabled: false, myLocationButtonEnabled: true, scaleBarEnabled: false, togglePitchEnabled: false }}
                onMapClick={(event: { coordinates: Partial<Point> }) => {
                    const { latitude, longitude } = event.coordinates;
                    if (typeof latitude === 'number' && typeof longitude === 'number') onPick({ latitude, longitude });
                }}
            />
            <View pointerEvents="none" style={[styles.hint, { backgroundColor: colors.background }]}>
                <Text style={[styles.hintText, { color: colors.textSecondary }]}>Tap the map to choose the place</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    frame: { borderRadius: Radius.small, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
    hint: { position: 'absolute', left: Spacing.sm, bottom: Spacing.sm, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.pill, opacity: 0.85 },
    hintText: { fontFamily: FontFamily.medium, fontSize: 11 },
});
