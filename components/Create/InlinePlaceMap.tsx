import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { MatteInput } from '@/components/ui/MatteInput';
import { searchPlaces, type FoundPlace } from '@/lib/placeSearch';
import { DURATION, OVERLAY } from '@/theme/motion';
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
 * The map's height in a panel, so the whole panel fits with nothing to
 * scroll on any phone: everything else in it (the choices above, the name and
 * buttons below) is measured, and the map takes exactly the room that is
 * left. Put `onLayout` on the panel's outer view while the map shows.
 */
export function usePlaceMapFit() {
    const room = usePanelRoom();
    // What the panel holds besides the map, until it is measured.
    const [rest, setRest] = useState(190);
    const height = Math.round(Math.max(120, Math.min(360, room - rest - 2)));
    const onLayout = (event: LayoutChangeEvent) => {
        const measured = Math.round(event.nativeEvent.layout.height - height);
        if (Math.abs(measured - rest) > 1) setRest(measured);
    };
    return { height, onLayout };
}

/**
 * The small map, right in a panel (Reminder's "At a place", Tracking's
 * "Place"): centred on you until a place is chosen; tap it where the place
 * is, or the arrow pins where you are now. Its name shows under it.
 *
 * The name's bar is also the search: tap it and it becomes a field, the map
 * folds away above it (so the field rises into the map's place, right under
 * the choices, and nothing is drawn over anything while the keyboard is up),
 * and what is found lists under the field. Choosing one puts the map back,
 * pinned there; Cancel puts it back as it was.
 */
export function InlinePlaceMap({ place, accent, onPick, height, trailing }: {
    /** Beside the name, on its line (Reminder's Arrive / Leave): the name then sits on the left. */
    trailing?: React.ReactNode;
    place: (MapPoint & { name: string }) | null;
    /** From usePlaceMapFit. */
    height: number;
    accent: string;
    /** A point chosen, with its name (the street or place found there). */
    onPick: (point: MapPoint & { name: string }) => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();
    const [here, setHere] = useState<MapPoint | null>(null);
    const [finding, setFinding] = useState(false);
    // Where the camera glides to. A tap on the map only moves the pin; the map never starts over.
    const [focus, setFocus] = useState<MapPoint | null>(null);
    const tapped = useRef<MapPoint | null>(null);
    const placeKey = place ? `${place.latitude},${place.longitude}` : '';
    useEffect(() => {
        if (!place) return;
        const same = tapped.current && tapped.current.latitude === place.latitude && tapped.current.longitude === place.longitude;
        // A place chosen another way (Same as reminder): the camera goes to it.
        if (!same) setTimeout(() => setFocus({ latitude: place.latitude, longitude: place.longitude }), 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [placeKey]);

    useEffect(() => {
        if (place || here) return;
        const timer = setTimeout(() => {
            void (async () => {
                try {
                    const Location = require('expo-location') as typeof import('expo-location');
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status !== 'granted') return;
                    const fix = await Location.getCurrentPositionAsync({});
                    const point = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
                    setHere(point);
                    setFocus(point);
                } catch { /* the map starts where it does */ }
            })();
        }, 0);
        return () => clearTimeout(timer);
    }, [place, here]);

    // Search: the bar becomes a field and the map folds away while it is open.
    const [searching, setSearching] = useState(false);
    const [query, setQuery] = useState('');
    const [found, setFound] = useState<FoundPlace[]>([]);
    const [looking, setLooking] = useState(false);
    const fold = useSharedValue(1);
    useEffect(() => { fold.value = withTiming(searching ? 0 : 1, searching ? OVERLAY.out : OVERLAY.in); }, [searching, fold]);
    const mapStyle = useAnimatedStyle(() => ({ height: fold.value * height, opacity: fold.value }));
    useEffect(() => {
        if (!searching) return;
        const text = query.trim();
        if (text.length < 2) return;
        let live = true;
        // Once typing pauses, near the place chosen or where you are.
        const timer = setTimeout(() => {
            void searchPlaces(text, place ?? here).then(list => {
                if (live) { setFound(list); setLooking(false); }
            });
        }, 300);
        return () => { live = false; clearTimeout(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, searching]);
    const openSearch = () => { selectionFeedback(); setQuery(''); setFound([]); setSearching(true); };
    const closeSearch = () => { Keyboard.dismiss(); setSearching(false); };
    const choose = (item: FoundPlace) => {
        selectionFeedback();
        const point = { latitude: item.latitude, longitude: item.longitude };
        tapped.current = point;
        closeSearch();
        setFocus(point);
        onPick({ name: item.name, ...point });
    };

    const pinAt = async (point: MapPoint) => {
        let name = 'Pinned place';
        try {
            const Location = require('expo-location') as typeof import('expo-location');
            const [found] = await Location.reverseGeocodeAsync(point);
            name = found?.name || found?.street || found?.city || name;
        } catch { /* the plain name */ }
        selectionFeedback();
        tapped.current = point;
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
            setFocus(point);
            await pinAt(point);
        } catch { /* stays where it was */ } finally { setFinding(false); }
    };

    const nameBar = (beside: boolean) => (
        <Pressable onPress={openSearch} style={beside ? styles.flex : undefined} accessibilityRole="search"
            accessibilityLabel={place ? `${place.name}. Search for another place` : 'Search for a place'}>
            <MatteSurface radius={Radius.control} level="control" style={[styles.here, beside && styles.beside]}>
                <AppIcon name={place ? 'location' : 'search'} size={Spacing.lg} color={accent} />
                <Text numberOfLines={1} style={[styles.placeName, { color: place ? colors.textPrimary : colors.textTertiary }]}>
                    {place ? place.name : hasPlaceMap() ? 'Search, or tap the map' : 'Search for a place'}
                </Text>
            </MatteSurface>
        </Pressable>
    );

    return (
        <View style={styles.block}>
            {hasPlaceMap() ? (
                // Folds to nothing while searching; never unmounted, so the map keeps where it was.
                <Animated.View style={[styles.fold, mapStyle]} pointerEvents={searching ? 'none' : 'auto'}
                    accessibilityElementsHidden={searching} importantForAccessibility={searching ? 'no-hide-descendants' : 'auto'}>
                    <PlaceMap center={place ?? here} focus={focus}
                        places={place ? [place] : []} accent={accent} height={height} onPick={point => void pinAt(point)} />
                    <View style={styles.locate}>
                        <IconButton icon={finding ? 'hourglass-outline' : 'navigate'} label="Use where I am now" diameter={32} size={15}
                            onPress={() => { selectionFeedback(); void pinHere(); }} />
                    </View>
                </Animated.View>
            ) : null}
            {searching ? (
                <Animated.View entering={FadeIn.duration(DURATION.quick)} style={styles.search}>
                    <View style={styles.row}>
                        <MatteInput autoFocus value={query} onChangeText={text => { setQuery(text); setLooking(text.trim().length >= 2); if (text.trim().length < 2) setFound([]); }} placeholder="A place or an address"
                            returnKeyType="search" autoCorrect={false} clearButtonMode="while-editing"
                            accessibilityLabel="Search for a place" style={[styles.field, { color: colors.textPrimary }]} />
                        <Pressable onPress={closeSearch} hitSlop={Spacing.sm} accessibilityRole="button" accessibilityLabel="Cancel search" style={styles.cancel}>
                            <Text style={[styles.cancelText, { color: accent }]}>Cancel</Text>
                        </Pressable>
                    </View>
                    {found.map((item, index) => (
                        <Animated.View key={`${item.name}${item.latitude}${item.longitude}`} entering={FadeIn.duration(DURATION.quick).delay(index * 35)} exiting={FadeOut.duration(DURATION.tap)}>
                            <Pressable onPress={() => choose(item)} accessibilityRole="button"
                                accessibilityLabel={item.address ? `${item.name}, ${item.address}` : item.name}>
                                <MatteSurface radius={Radius.control} level="control" style={styles.result}>
                                    <AppIcon name="location" size={Spacing.lg} color={accent} />
                                    <View style={styles.flex}>
                                        <Text numberOfLines={1} style={[styles.placeName, { color: colors.textPrimary }]}>{item.name}</Text>
                                        {item.address ? <Text numberOfLines={1} style={[styles.address, { color: colors.textSecondary }]}>{item.address}</Text> : null}
                                    </View>
                                </MatteSurface>
                            </Pressable>
                        </Animated.View>
                    ))}
                    {query.trim().length >= 2 && !found.length ? (
                        <Text style={[styles.note, { color: colors.textSecondary }]} accessibilityLiveRegion="polite">
                            {looking ? 'Searching…' : 'Nothing found. Try a street, a city or a business name.'}
                        </Text>
                    ) : null}
                </Animated.View>
            ) : trailing ? (
                <View style={styles.row}>
                    {nameBar(true)}
                    {trailing}
                </View>
            ) : nameBar(false)}
        </View>
    );
}

const styles = StyleSheet.create({
    block: { gap: Spacing.sm },
    flex: { flex: 1 },
    fold: { overflow: 'hidden' },
    search: { gap: Spacing.sm },
    field: { flex: 1, fontFamily: FontFamily.medium, fontSize: 15, minHeight: Spacing.xxl * 2 },
    cancel: { justifyContent: 'center', minHeight: Spacing.xxl * 2 },
    cancelText: { fontFamily: FontFamily.medium, fontSize: 15 },
    result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, minHeight: Spacing.xxl * 2 },
    address: { fontFamily: FontFamily.regular, fontSize: 13 },
    note: { fontFamily: FontFamily.regular, fontSize: 13, paddingHorizontal: Spacing.xs },
    placeName: { flexShrink: 1, fontFamily: FontFamily.medium, fontSize: 15 },
    here: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    /** Next to other controls: the name starts at the left and takes the room left. */
    beside: { flex: 1, justifyContent: 'flex-start', paddingHorizontal: Spacing.md },
    /** The locate button, in the map's corner. */
    locate: { position: 'absolute', top: Spacing.sm, right: Spacing.sm },
});
