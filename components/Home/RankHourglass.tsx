import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Hourglass } from './Hourglass';
import { glassDesign } from '@/theme/hourglassDesigns';
import { HOURGLASS_FRAMES } from '@/theme/hourglassFrames';
import { Colors } from '@/theme/colors';
import { HOURGLASS_OPACITY } from '@/theme/hourglassArt';

/**
 * A rank, shown as its hourglass: its empty frame (theme/hourglassFrames.ts, the
 * same glass as on Home, no painted sand), otherwise drawn from its design
 * (theme/hourglassDesigns.ts), still, with some sand in each bulb. `size` is its height.
 *
 * `look`: 'scene' dims it into the night scene (by `dim`, else as Home's live
 * one is dimmed); 'shadow' shows only its black silhouette (one not reached yet).
 */
export function RankHourglass({ rank, size, look, dim }: { rank: string; size: number; look?: 'scene' | 'shadow'; dim?: number }) {
    const sand = useSharedValue(0.35);
    const frame = HOURGLASS_FRAMES[rank];
    const art = frame?.image;
    if (frame && art) {
        const box = { height: size, width: size * frame.width / frame.height };
        // The same picture in black over it: all of it for a shadow, a share of it to dim.
        const shade = look === 'shadow' ? 1 : look === 'scene' ? (dim ?? 1 - frame.brightness) : 0;
        return (
            // In the scene (the carousel), as see-through as Home's.
            <View style={[box, look ? { opacity: HOURGLASS_OPACITY } : null]} accessible accessibilityLabel={look === 'shadow' ? `${rank} hourglass, not reached yet` : `${rank} hourglass`}>
                {look === 'shadow' ? null : <Image source={art} resizeMode="contain" accessibilityIgnoresInvertColors style={box} />}
                {shade > 0 ? <Image source={art} resizeMode="contain" accessibilityIgnoresInvertColors
                    style={[styles.over, box, { tintColor: Colors.common.black, opacity: shade }]} /> : null}
            </View>
        );
    }
    return <Hourglass design={glassDesign(rank)} size={size} ran={sand} running={false} />;
}

// Its own size, given, not stretched: an image sized only by its edges draws at the art's full size.
const styles = StyleSheet.create({ over: { position: 'absolute', top: 0, left: 0 } });
