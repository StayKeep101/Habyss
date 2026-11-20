import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { HOURGLASS_ART_RATIO, type LiveGlassArt } from '@/theme/hourglassArt';

/** The art's own grid (1113 × 1413): every hourglass shares this glass. */
const H = 1413;
const CX = 556;
const NECK = 776;
/** Just under the bottom of the glass, where the pile stands. */
const BASE = 1215;
/** The stream's window, either side of the centre. */
const STREAM = 10;
/** The smallest clear margin either side of the art, as a share of its width. */
const ART_BLEED = 0.06;

/**
 * Your rank's hourglass as finished art, live on Home: the empty glass, and the
 * art's own painted sand (its glow, its grain, its mound) shown a little at a
 * time. `ran` (0 to 1) is how much of the day has fallen: the top sand sinks
 * to the neck, the pile rises from the bottom to its full mound, and the stream
 * falls between them while the day runs. Three windows onto the sand, nothing
 * redrawn, so it looks exactly like the art at every moment.
 */
export function ArtHourglass({ art, size, ran, running }: {
    art: LiveGlassArt;
    /** Height in points; the width follows the art. */
    size: number;
    ran: SharedValue<number>;
    running: boolean;
}) {
    const width = size * HOURGLASS_ART_RATIO;
    // Points per pixel of the art, and the art's two levels: plain numbers for the worklets.
    const k = size / H;
    const top = art.topSand;
    const pile = art.pile;
    const streamLeft = k * (CX - STREAM);

    const topWindow = useAnimatedStyle(() => {
        const level = top + (NECK - top) * ran.get();
        return { top: k * level, height: Math.max(0, k * (NECK - level)) };
    });
    const topSand = useAnimatedStyle(() => ({ transform: [{ translateY: -k * (top + (NECK - top) * ran.get()) }] }));
    const pileWindow = useAnimatedStyle(() => {
        const level = BASE - (BASE - pile) * ran.get();
        return { top: k * level, height: Math.max(0, size - k * level) };
    });
    const pileSand = useAnimatedStyle(() => ({ transform: [{ translateY: -k * (BASE - (BASE - pile) * ran.get()) }] }));
    const streamWindow = useAnimatedStyle(() => {
        const flowing = ran.get() > 0.001 && ran.get() < 0.999;
        const level = BASE - (BASE - pile) * ran.get();
        return { height: flowing ? Math.max(0, k * (level - NECK)) : 0 };
    });

    const sandStyle = [styles.layer, { width, height: size }];
    return (
        // The art has clear margins either side (6–9% of its width): they may overlap
        // what is beside it, so it takes about the room of the drawn glass on Home.
        <View style={{ width, height: size, marginHorizontal: -width * ART_BLEED }}>
            {/* Every layer sized exactly: "fill the parent" drew the image at its own size on Home. */}
            <Image source={art.glass} resizeMode="contain" style={sandStyle} accessibilityIgnoresInvertColors />
            <Animated.View style={[styles.window, { width }, topWindow]} pointerEvents="none">
                <Animated.Image source={art.sand} resizeMode="contain" style={[sandStyle, topSand]} />
            </Animated.View>
            <Animated.View style={[styles.window, { width }, pileWindow]} pointerEvents="none">
                <Animated.Image source={art.sand} resizeMode="contain" style={[sandStyle, pileSand]} />
            </Animated.View>
            {running ? (
                <Animated.View style={[styles.window, { left: streamLeft, top: k * NECK, width: k * STREAM * 2 }, streamWindow]} pointerEvents="none">
                    <Image source={art.sand} resizeMode="contain" style={[sandStyle, { left: -streamLeft, top: -k * NECK }]} />
                </Animated.View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    layer: { position: 'absolute', top: 0, left: 0 },
    window: { position: 'absolute', left: 0, overflow: 'hidden' },
});
