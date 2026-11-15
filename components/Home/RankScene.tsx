import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { DuneScene } from './DuneScene';
import { mixHex } from '@/lib/colorContrast';
import { rankGradient } from '@/theme/rankLooks';
import { LinearGradient } from 'expo-linear-gradient';
import { useTokens } from '@/hooks/useTokens';
import { tint } from '@/theme/tokens';
import { DayGlassBackdrop } from './DayHourglass';

/** The scenes are painted 3 : 4; shown whole across the screen's width, the horizon falls where the hourglass stands. */
const SCENE_RATIO = 4 / 3;

/**
 * The world behind Home: your rank's scene, drawn in the app's own materials
 * (DuneScene), fixed while the day's panel rises over it. Shown whole
 * across the top, so the hourglass stands in it; a faint wash of your rank's
 * colour and its drifting motes over the sky; darker under the floating stats
 * bar, and falling into the page below, where the cards read on dark.
 */
export function RankScene({ rank, fill = false, centred = false, scrollY, scrollRest }: {
    /** Where the page rests unscrolled. */
    scrollRest?: number;
    /** The page's scroll, for the scene's layers to drift at their own pace. */
    scrollY?: SharedValue<number>;
    /** Whose scene; your own by default. */
    rank?: string;
    /** The whole screen (the hourglass carousel), rather than the picture's own height across the top (Home). */
    fill?: boolean;
    /** Its middle in the middle of the screen (Focus with the phone sideways), rather than its top at the top. */
    centred?: boolean;
} = {}) {
    const t = useTokens();
    const { width, height: screen } = useWindowDimensions();
    const height = fill ? screen : width * SCENE_RATIO;
    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={[{ height, overflow: 'hidden' }, centred && { marginTop: (screen - height) / 2 }]}>
                <DuneScene width={width} height={height} scrollY={scrollY} scrollRest={scrollRest} tintColor={rank ? mixHex(...rankGradient(rank)) : undefined} />
                <DayGlassBackdrop />
                {/* Under the floating bar: enough dark for its figures to read. */}
                <LinearGradient colors={[tint(t.color.background, 'border'), 'transparent']} locations={[0, 0.25]} style={StyleSheet.absoluteFill} />
                {/* Into the page. */}
                <LinearGradient colors={['transparent', t.color.background]} locations={[0.62, 1]} style={StyleSheet.absoluteFill} />
            </View>
        </View>
    );
}
