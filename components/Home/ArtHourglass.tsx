import React, { useId } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { GlassDesign } from '@/theme/hourglassDesigns';
import { HOURGLASS_ART_RATIO } from '@/theme/hourglassArt';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** The art's own grid (1113 × 1413): every hourglass shares this glass. */
const W = 1113;
const H = 1413;
const CX = 556;
const NECK = 776;
/** The smallest clear margin either side of the art, as a share of its width. */
const ART_BLEED = 0.06;
/** Where the top sand starts the day, and where the bottom pile ends it. */
const TOP_FULL = 450;
const BOTTOM = 1196;
const BOTTOM_FULL = 900;

/**
 * The inside of the glass, measured off the art (half-widths from the centre
 * at each height, a little inside the rim so the sand never spills over it).
 */
const TOP_EDGE: [number, number][] = [[360, 190], [380, 205], [420, 205], [460, 202], [500, 200], [540, 186], [580, 180], [620, 146], [660, 100], [700, 56], [740, 22], [NECK, 10]];
const BOTTOM_EDGE: [number, number][] = [[NECK, 10], [820, 18], [860, 46], [900, 88], [940, 122], [980, 146], [1020, 175], [1060, 222], [1100, 228], [1140, 224], [1170, 210], [BOTTOM, 170]];

const outline = (edge: [number, number][]) =>
    `M ${edge.map(([y, half]) => `${CX + half} ${y}`).join(' L ')} L ${[...edge].reverse().map(([y, half]) => `${CX - half} ${y}`).join(' L ')} Z`;
const TOP_BULB = outline(TOP_EDGE);
const BOTTOM_BULB = outline(BOTTOM_EDGE);

/**
 * Your rank's hourglass as finished art (theme/hourglassArt.ts, the empty
 * glass), with the day's sand in it: `ran` (0 to 1) is how much of the day has
 * fallen. The top sinks towards the neck, the pile below rises, and a thin
 * stream falls between them while the day runs. The same as the drawn
 * Hourglass, for a rank that has its art.
 */
export function ArtHourglass({ art, design, size, ran, running, streamColor }: {
    art: ImageSourcePropType;
    design: GlassDesign;
    /** Height in points; the width follows the art. */
    size: number;
    ran: SharedValue<number>;
    running: boolean;
    streamColor?: string;
}) {
    const id = useId().replace(/[^a-zA-Z0-9]/g, '');
    const ref = (name: string) => `${name}${id}`;
    const width = size * HOURGLASS_ART_RATIO;

    // Worklets: plain numbers only (never a helper call inside them).
    const topSand = useAnimatedProps(() => {
        const level = TOP_FULL + (NECK - TOP_FULL) * ran.get();
        return { y: level, height: Math.max(0, NECK - level) };
    });
    const bottomSand = useAnimatedProps(() => {
        const height = (BOTTOM - BOTTOM_FULL) * ran.get();
        return { y: BOTTOM - height, height };
    });
    const stream = useAnimatedProps(() => {
        const top = BOTTOM - (BOTTOM - BOTTOM_FULL) * ran.get();
        const flowing = ran.get() > 0.001 && ran.get() < 0.999;
        return { height: flowing ? Math.max(0, top - NECK) : 0 };
    });

    return (
        // The art has clear margins either side (6–9% of its width): they may overlap
        // what is beside it, so it takes about the room of the drawn glass on Home.
        <View style={{ width, height: size, marginHorizontal: -width * ART_BLEED }}>
            <Image source={art} resizeMode="contain" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
            <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${W} ${H}`}>
                <Defs>
                    <LinearGradient id={ref('sand')} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={design.sand[0]} /><Stop offset="1" stopColor={design.sand[1]} />
                    </LinearGradient>
                    <ClipPath id={ref('top')}><Path d={TOP_BULB} /></ClipPath>
                    <ClipPath id={ref('bottom')}><Path d={BOTTOM_BULB} /></ClipPath>
                </Defs>
                <G clipPath={`url(#${ref('top')})`}>
                    <AnimatedRect x={0} width={W} fill={`url(#${ref('sand')})`} fillOpacity={0.92} animatedProps={topSand} />
                </G>
                <G clipPath={`url(#${ref('bottom')})`}>
                    <AnimatedRect x={0} width={W} fill={`url(#${ref('sand')})`} fillOpacity={0.92} animatedProps={bottomSand} />
                </G>
                {running ? <AnimatedRect x={CX - 3} y={NECK} width={6} fill={streamColor ?? design.sand[0]} animatedProps={stream} /> : null}
            </Svg>
        </View>
    );
}
