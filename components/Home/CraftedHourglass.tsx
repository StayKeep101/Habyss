import React, { useId } from 'react';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useTheme } from '@/context/ThemeContext';
import { mixHex } from '@/lib/colorContrast';
import { Colors } from '@/theme/colors';
import { surfaceFor } from '@/theme/designSystem';
import type { GlassDesign } from '@/theme/hourglassDesigns';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Drawn on a 120 × 170 grid. */
const W = 120;
const H = 170;
const CX = 60;
const NECK = 85;
const GLASS_TOP = 22;
const GLASS_BOTTOM = 148;
/** Where the top sand starts the day, and how high the pile ends it. */
const TOP_FULL = 40;
const PILE_FULL = 112;

/** The glass: two soft bulbs meeting at a narrow neck, rounded like the app's cards. */
const GLASS = `M 42 ${GLASS_TOP} L 78 ${GLASS_TOP} C 90 ${GLASS_TOP} 93 28 93 38 C 93 58 69 73 63.2 ${NECK} C 69 97 93 112 93 132 C 93 142 90 ${GLASS_BOTTOM} 78 ${GLASS_BOTTOM} L 42 ${GLASS_BOTTOM} C 30 ${GLASS_BOTTOM} 27 142 27 132 C 27 112 51 97 56.8 ${NECK} C 51 73 27 58 27 38 C 27 28 30 ${GLASS_TOP} 42 ${GLASS_TOP} Z`;

/**
 * Home's hourglass, drawn in the app's own material so it belongs on the page:
 * the frame is the cards' matte surface (light falling from the top, darker
 * below), a little lighter so it stands off the panel; the glass is a quiet
 * dark shape with a crisp rim and one highlight. Only the sand is the rank's
 * colour, with a thin line of it on the cap and the base. `ran` (0 to 1) is
 * how much of the day has fallen: the top sand sinks with a soft dip in its
 * surface, the pile rises as a mound, and a thin stream falls between them.
 */
export function CraftedHourglass({ design, size, ran, running, streamColor }: {
    design: GlassDesign;
    /** Height in points; the width follows (120 : 170). */
    size: number;
    ran: SharedValue<number>;
    running: boolean;
    streamColor?: string;
}) {
    const id = useId().replace(/[^a-zA-Z0-9]/g, '');
    const ref = (name: string) => `${name}${id}`;
    const { theme } = useTheme();
    const tone = surfaceFor(theme);
    const white = Colors.common.white;
    // The cards' material, lifted so the frame reads against the panel.
    const frameTop = mixHex(tone.top, white, 0.3);
    const frameBottom = mixHex(tone.bottom, white, 0.14);
    const glassFill = mixHex(tone.top, white, 0.07);
    const rim = mixHex(tone.top, white, 0.45);
    const accent = design.sand[0];
    const width = (size * W) / H;

    // Worklets: plain numbers and string building only.
    const topSand = useAnimatedProps(() => {
        const level = TOP_FULL + (NECK - TOP_FULL) * ran.get();
        // The surface dips in the middle as it drains, less as it empties.
        const dip = 5 * (1 - ran.get());
        return { d: `M 0 ${level} Q ${CX} ${level + dip * 2} ${W} ${level} L ${W} ${NECK + 2} L 0 ${NECK + 2} Z` };
    });
    const pile = useAnimatedProps(() => {
        const height = (GLASS_BOTTOM - PILE_FULL) * ran.get();
        const shoulder = GLASS_BOTTOM - height * 0.4;
        const peak = GLASS_BOTTOM - height;
        // A soft mound: low at the sides, highest under the stream.
        return { d: `M 0 ${GLASS_BOTTOM + 2} L 0 ${shoulder} Q ${CX} ${peak - height * 0.9} ${W} ${shoulder} L ${W} ${GLASS_BOTTOM + 2} Z` };
    });
    const stream = useAnimatedProps(() => {
        const height = (GLASS_BOTTOM - PILE_FULL) * ran.get();
        const flowing = ran.get() > 0.001 && ran.get() < 0.999;
        return { height: flowing ? Math.max(0, GLASS_BOTTOM - height * 1.1 - NECK) : 0 };
    });

    return (
        <Svg width={width} height={size} viewBox={`0 0 ${W} ${H}`}>
            <Defs>
                <LinearGradient id={ref('frame')} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={frameTop} /><Stop offset="1" stopColor={frameBottom} />
                </LinearGradient>
                <LinearGradient id={ref('pillar')} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={frameBottom} /><Stop offset="0.45" stopColor={frameTop} /><Stop offset="1" stopColor={frameBottom} />
                </LinearGradient>
                <LinearGradient id={ref('sand')} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={design.sand[0]} /><Stop offset="1" stopColor={design.sand[1]} />
                </LinearGradient>
                <ClipPath id={ref('glass')}><Path d={GLASS} /></ClipPath>
            </Defs>

            {/* The pillars, then the glass between them. */}
            <Rect x={14} y={14} width={7} height={H - 28} rx={3.5} fill={`url(#${ref('pillar')})`} />
            <Rect x={W - 21} y={14} width={7} height={H - 28} rx={3.5} fill={`url(#${ref('pillar')})`} />

            <Path d={GLASS} fill={glassFill} />
            <G clipPath={`url(#${ref('glass')})`}>
                <AnimatedPath fill={`url(#${ref('sand')})`} animatedProps={topSand} />
                <AnimatedPath fill={`url(#${ref('sand')})`} animatedProps={pile} />
                {running ? <AnimatedRect x={CX - 0.8} y={NECK} width={1.6} fill={streamColor ?? design.sand[0]} animatedProps={stream} /> : null}
            </G>
            <Path d={GLASS} fill="none" stroke={rim} strokeOpacity={0.55} strokeWidth={1.2} />
            {/* One highlight down each bulb, where the light catches the glass. */}
            <Path d="M 33 36 C 33 46 39 56 47 64" stroke={white} strokeOpacity={0.16} strokeWidth={2} fill="none" strokeLinecap="round" />
            <Path d="M 33 118 C 33 126 35 133 39 138" stroke={white} strokeOpacity={0.12} strokeWidth={2} fill="none" strokeLinecap="round" />

            {/* The cap and the base, the cards' material, each with a thin line of the rank's colour. */}
            <Rect x={8} y={6} width={W - 16} height={12} rx={6} fill={`url(#${ref('frame')})`} />
            <Rect x={8} y={H - 18} width={W - 16} height={12} rx={6} fill={`url(#${ref('frame')})`} />
            <Rect x={8} y={6.5} width={W - 16} height={1} rx={0.5} fill={white} fillOpacity={0.14} />
            <Rect x={CX - 16} y={11.4} width={32} height={1.4} rx={0.7} fill={accent} fillOpacity={0.9} />
            <Rect x={CX - 16} y={H - 12.8} width={32} height={1.4} rx={0.7} fill={accent} fillOpacity={0.9} />
        </Svg>
    );
}
