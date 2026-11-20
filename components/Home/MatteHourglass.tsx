import React, { useId } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import type { GlassDesign } from '@/theme/hourglassDesigns';
import type { MatteGlass } from '@/theme/hourglassArt';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/**
 * Home's hourglass in the app's own quiet, matte style: the image, with the
 * day's sand drawn into its glass in the rank's colour. `ran` (0 to 1) is how
 * much of the day has fallen: the top sinks to the neck, the pile rises, and a
 * thin stream falls between them while the day runs.
 */
export function MatteHourglass({ glass, design, size, ran, running, streamColor }: {
    glass: MatteGlass;
    design: GlassDesign;
    /** Height in points; the width follows the image. */
    size: number;
    ran: SharedValue<number>;
    running: boolean;
    streamColor?: string;
}) {
    const id = useId().replace(/[^a-zA-Z0-9]/g, '');
    const ref = (name: string) => `${name}${id}`;
    const width = (size * glass.width) / glass.height;
    const cx = glass.centre;
    const neck = glass.top[glass.top.length - 1][0];
    const base = glass.bottom[glass.bottom.length - 1][0];
    const outline = (edge: [number, number][]) =>
        `M ${edge.map(([y, half]) => `${cx + half} ${y}`).join(' L ')} L ${[...edge].reverse().map(([y, half]) => `${cx - half} ${y}`).join(' L ')} Z`;
    // Plain numbers for the worklets.
    const topFull = glass.topFull;
    const pileFull = glass.pileFull;

    const topSand = useAnimatedProps(() => {
        const level = topFull + (neck - topFull) * ran.get();
        return { y: level, height: Math.max(0, neck - level) };
    });
    const pile = useAnimatedProps(() => {
        const height = (base - pileFull) * ran.get();
        return { y: base - height, height };
    });
    const stream = useAnimatedProps(() => {
        const top = base - (base - pileFull) * ran.get();
        const flowing = ran.get() > 0.001 && ran.get() < 0.999;
        return { height: flowing ? Math.max(0, top - neck) : 0 };
    });

    return (
        // The clear margins either side may overlap what is beside it.
        <View style={{ width, height: size, marginHorizontal: -width * glass.bleed }}>
            <Image source={glass.image} resizeMode="contain" style={[styles.layer, { width, height: size }]} accessibilityIgnoresInvertColors />
            <Svg width={width} height={size} style={styles.layer} viewBox={`0 0 ${glass.width} ${glass.height}`}>
                <Defs>
                    <LinearGradient id={ref('sand')} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={design.sand[0]} /><Stop offset="1" stopColor={design.sand[1]} />
                    </LinearGradient>
                    <ClipPath id={ref('top')}><Path d={outline(glass.top)} /></ClipPath>
                    <ClipPath id={ref('bottom')}><Path d={outline(glass.bottom)} /></ClipPath>
                </Defs>
                <G clipPath={`url(#${ref('top')})`}>
                    <AnimatedRect x={0} width={glass.width} fill={`url(#${ref('sand')})`} fillOpacity={0.94} animatedProps={topSand} />
                </G>
                <G clipPath={`url(#${ref('bottom')})`}>
                    <AnimatedRect x={0} width={glass.width} fill={`url(#${ref('sand')})`} fillOpacity={0.94} animatedProps={pile} />
                </G>
                {running ? <AnimatedRect x={cx - 4} y={neck} width={8} fill={streamColor ?? design.sand[0]} animatedProps={stream} /> : null}
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    layer: { position: 'absolute', top: 0, left: 0 },
});
