import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Hourglass } from './Hourglass';
import { glassDesign } from '@/theme/hourglassDesigns';
import { HOURGLASS_ART, HOURGLASS_ART_RATIO } from '@/theme/hourglassArt';
import { HOURGLASS_FRAMES } from '@/theme/hourglassFrames';
import { Colors } from '@/theme/colors';

/**
 * A rank, shown as its hourglass: the one picture a rank has. Its finished art
 * (theme/hourglassArt.ts) when it has some, otherwise drawn from its design
 * (theme/hourglassDesigns.ts), still, with some sand in each bulb. `size` is its height.
 *
 * `look`: 'scene' dims it as Home's live one is dimmed, to sit in the night
 * scene; 'shadow' shows only its black silhouette (one not reached yet).
 */
export function RankHourglass({ rank, size, look }: { rank: string; size: number; look?: 'scene' | 'shadow' }) {
    const sand = useSharedValue(0.35);
    const art = HOURGLASS_ART[rank];
    if (art) {
        const box = { height: size, width: size * HOURGLASS_ART_RATIO };
        // The same picture in black over it: all of it for a shadow, a share of it to dim.
        const shade = look === 'shadow' ? 1 : look === 'scene' ? 1 - (HOURGLASS_FRAMES[rank]?.brightness ?? 0.8) : 0;
        return (
            <View style={box} accessible accessibilityLabel={look === 'shadow' ? `${rank} hourglass, not reached yet` : `${rank} hourglass`}>
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
