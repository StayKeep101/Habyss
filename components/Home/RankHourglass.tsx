import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Hourglass } from './Hourglass';
import { glassDesign } from '@/theme/hourglassDesigns';
import { HOURGLASS_FRAMES } from '@/theme/hourglassFrames';
import { Colors } from '@/theme/colors';
import { HOURGLASS_FADE } from '@/theme/hourglassArt';
import { LinearGradient } from 'expo-linear-gradient';

let MaskedView: typeof import('@react-native-masked-view/masked-view').default | null = null;
try { MaskedView = require('@react-native-masked-view/masked-view').default; } catch { MaskedView = null; }

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
        const glass = (
            <View style={box}>
                {look === 'shadow' ? null : <Image source={art} resizeMode="contain" accessibilityIgnoresInvertColors style={box} />}
                {shade > 0 ? <Image source={art} resizeMode="contain" accessibilityIgnoresInvertColors
                    style={[styles.over, box, { tintColor: Colors.common.black, opacity: shade }]} /> : null}
            </View>
        );
        return (
            // In the scene (the carousel), faded as Home's: see-through at the top, solid at the foot.
            <View style={box} accessible accessibilityLabel={look === 'shadow' ? `${rank} hourglass, not reached yet` : `${rank} hourglass`}>
                {look && MaskedView ? (
                    <MaskedView style={box} maskElement={<LinearGradient colors={[...HOURGLASS_FADE]} style={box} />}>{glass}</MaskedView>
                ) : glass}
            </View>
        );
    }
    return <Hourglass design={glassDesign(rank)} size={size} ran={sand} running={false} />;
}

// Its own size, given, not stretched: an image sized only by its edges draws at the art's full size.
const styles = StyleSheet.create({ over: { position: 'absolute', top: 0, left: 0 } });
