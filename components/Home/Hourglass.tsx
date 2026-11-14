import React, { useId } from 'react';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import type { GlassDesign } from '@/theme/hourglassDesigns';
import { Colors } from '@/theme/colors';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/** Drawn on a 100 × 160 grid. */
const W = 100;
const H = 160;
const NECK = 80;
const TOP_GLASS = 13;
const BOTTOM_GLASS = 147;
const BULB = NECK - TOP_GLASS;

const TOP_BULB = `M 23 ${TOP_GLASS} C 23 50, 46 68, 48.5 ${NECK} L 51.5 ${NECK} C 54 68, 77 50, 77 ${TOP_GLASS} Z`;
const BOTTOM_BULB = `M 48.5 ${NECK} C 46 92, 23 110, 23 ${BOTTOM_GLASS} L 77 ${BOTTOM_GLASS} C 77 110, 54 92, 51.5 ${NECK} Z`;

/**
 * One hourglass, in a rank's design (theme/hourglassDesigns.ts): two caps,
 * two turned pillars, the glass, and the sand. `ran` (0 to 1) is how much of
 * the day has fallen: the top sand sinks towards the neck, the pile in the
 * bottom rises, and a thin stream falls between them while the day runs.
 *
 * `part` draws only the top or bottom half (a glass pulled apart).
 */
export function Hourglass({ design, size, ran, running, part = 'whole', streamColor }: {
    design: GlassDesign;
    /** Height in points; the width follows (100 : 160). */
    size: number;
    ran: SharedValue<number>;
    /** The stream shows only while the day runs (not at night, not mid-flip). */
    running: boolean;
    /** The falling stream's colour: the habit or task you are on now (else the glass's own sand). */
    streamColor?: string;
    part?: 'whole' | 'top' | 'bottom';
}) {
    const id = useId().replace(/[^a-zA-Z0-9]/g, '');
    const ref = (name: string) => `${name}${id}`;
    const width = (size * W) / H;

    // Worklets: plain numbers only (never a helper call inside them).
    const topSand = useAnimatedProps(() => {
        const level = TOP_GLASS + BULB * ran.get();
        return { y: level, height: Math.max(0, NECK - level) };
    });
    const bottomSand = useAnimatedProps(() => {
        const height = BULB * ran.get();
        return { y: BOTTOM_GLASS - height, height };
    });
    const stream = useAnimatedProps(() => {
        const top = BOTTOM_GLASS - BULB * ran.get();
        const flowing = ran.get() > 0.001 && ran.get() < 0.999;
        return { height: flowing ? Math.max(0, top - NECK) : 0 };
    });

    const rings = Array.from({ length: design.rings }, (_, index) => 30 + index * ((H - 60) / Math.max(1, design.rings - 1 || 1)));
    const clip = part === 'top' ? { y: 0, height: NECK } : part === 'bottom' ? { y: NECK, height: H - NECK } : { y: 0, height: H };

    return (
        <Svg width={width} height={size} viewBox={`0 0 ${W} ${H}`}>
            <Defs>
                <LinearGradient id={ref('sand')} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={design.sand[0]} /><Stop offset="1" stopColor={design.sand[1]} />
                </LinearGradient>
                <LinearGradient id={ref('frame')} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={design.frame} /><Stop offset="0.5" stopColor={design.frameLight} /><Stop offset="1" stopColor={design.frame} />
                </LinearGradient>
                <RadialGradient id={ref('glow')} cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={design.sand[0]} stopOpacity={design.glow * 0.55} />
                    <Stop offset="1" stopColor={design.sand[0]} stopOpacity={0} />
                </RadialGradient>
                <ClipPath id={ref('top')}><Path d={TOP_BULB} /></ClipPath>
                <ClipPath id={ref('bottom')}><Path d={BOTTOM_BULB} /></ClipPath>
                <ClipPath id={ref('part')}><Rect x={0} y={clip.y} width={W} height={clip.height} /></ClipPath>
            </Defs>

            <G clipPath={`url(#${ref('part')})`}>
                {design.glow > 0 ? <Ellipse cx={50} cy={NECK} rx={48} ry={76} fill={`url(#${ref('glow')})`} /> : null}

                {/* The glass, faintly there, then the sand in it. */}
                <Path d={TOP_BULB} fill={Colors.common.white} fillOpacity={0.05} />
                <Path d={BOTTOM_BULB} fill={Colors.common.white} fillOpacity={0.05} />
                <G clipPath={`url(#${ref('top')})`}>
                    <AnimatedRect x={0} width={W} fill={`url(#${ref('sand')})`} animatedProps={topSand} />
                </G>
                <G clipPath={`url(#${ref('bottom')})`}>
                    <AnimatedRect x={0} width={W} fill={`url(#${ref('sand')})`} animatedProps={bottomSand} />
                </G>
                {running ? <AnimatedRect x={49.4} y={NECK} width={1.2} fill={streamColor ?? design.sand[0]} animatedProps={stream} /> : null}
                <Path d={TOP_BULB} fill="none" stroke={design.frameLight} strokeOpacity={0.55} strokeWidth={1.2} />
                <Path d={BOTTOM_BULB} fill="none" stroke={design.frameLight} strokeOpacity={0.55} strokeWidth={1.2} />
                {/* A highlight down the glass. */}
                <Path d={`M 29 ${TOP_GLASS + 6} C 30 40, 40 58, 45 70`} stroke={Colors.common.white} strokeOpacity={0.22} strokeWidth={1.6} fill="none" strokeLinecap="round" />

                {/* The stand: two pillars, their rings, the caps and their finials. */}
                {[10, 84].map(x => (
                    <G key={x}>
                        <Rect x={x} y={8} width={6} height={H - 16} rx={2.5} fill={`url(#${ref('frame')})`} />
                        {rings.map(y => <Rect key={y} x={x - 1.5} y={y} width={9} height={4} rx={2} fill={design.frameLight} />)}
                    </G>
                ))}
                <Rect x={2} y={1} width={W - 4} height={9} rx={4} fill={`url(#${ref('frame')})`} />
                <Rect x={2} y={H - 10} width={W - 4} height={9} rx={4} fill={`url(#${ref('frame')})`} />
                {design.finials ? [6, 94].flatMap(x => [
                    <Ellipse key={`t${x}`} cx={x} cy={1.5} rx={3.5} ry={2.5} fill={design.frameLight} />,
                    <Ellipse key={`b${x}`} cx={x} cy={H - 1.5} rx={3.5} ry={2.5} fill={design.frameLight} />,
                ]) : null}
            </G>
        </Svg>
    );
}
