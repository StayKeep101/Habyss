import React, { useEffect, useId } from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, LinearGradient, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { ReduceMotion, useAnimatedProps, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { mixHex } from '@/lib/colorContrast';
import { rankTone } from '@/theme/tokens';
import { useTokens } from '@/hooks/useTokens';
import { DURATION, EASE } from '@/theme/motion';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

/*
 * The gem, drawn on a 100 × 100 box: a brilliant cut seen from the side.
 * A table across the top, a crown of five facets down to the girdle, and a
 * pavilion of four running to the point. The glow fills the room around it.
 */
const X = (f: number) => 18 + 64 * f;
const Y = (f: number) => 24 + 56 * f;
const P = {
    A: [0.3, 0], C: [0.7, 0],
    G0: [0, 0.33], G1: [0.25, 0.33], G2: [0.5, 0.33], G3: [0.75, 0.33], G4: [1, 0.33],
    Cu: [0.5, 1],
} as const;
type Corner = keyof typeof P;
const pts = (...corners: Corner[]) => corners.map(c => `${X(P[c][0])},${Y(P[c][1])}`).join(' ');

const OUTLINE = pts('G0', 'A', 'C', 'G4', 'Cu');
/** Each facet and how much light it catches: towards white above the girdle, towards black below. */
const FACETS: { points: string; white?: number; black?: number }[] = [
    { points: pts('G0', 'A', 'G1'), white: 0.25 },
    { points: pts('A', 'G2', 'G1'), white: 0.5 },
    { points: pts('A', 'C', 'G2'), white: 0.7 },
    { points: pts('C', 'G3', 'G2'), white: 0.45 },
    { points: pts('C', 'G4', 'G3') },
    { points: pts('G0', 'G1', 'Cu'), black: 0.45 },
    { points: pts('G1', 'G2', 'Cu'), black: 0.15 },
    { points: pts('G2', 'G3', 'Cu'), black: 0.3 },
    { points: pts('G3', 'G4', 'Cu'), black: 0.55 },
];

/**
 * A rank, as a gem: the same cut for every rank, in that rank's colour
 * (theme/tokens.ts rankTone), with a soft glow of it around. Eternal is white
 * light split into an iridescent sheen.
 *
 * When it appears (and whenever `replay` changes) a band of light crosses it
 * once (Tier 2, docs/motion-system.md: never looping, still with Reduce
 * Motion). A rank not reached yet is `locked`: a dark stone, no glow.
 */
export function RankGem({ rank, size, locked = false, shine = true, replay }: {
    rank: string;
    size: number;
    locked?: boolean;
    /** The band of light crossing it as it appears. */
    shine?: boolean;
    replay?: unknown;
}) {
    const t = useTokens();
    const reduced = useReducedMotion();
    const id = useId().replace(/[^a-zA-Z0-9]/g, '');
    const tone = rankTone(rank);
    const base = locked ? mixHex(t.color.surfaceRaised, t.color.textSubtle, 0.25) : tone.color;

    // The sweep: from off the left edge to off the right, once.
    const sweep = useSharedValue(-40);
    useEffect(() => {
        if (!shine || locked || reduced) return;
        sweep.set(-40);
        sweep.set(withDelay(DURATION.base, withTiming(130, { duration: DURATION.reward, easing: EASE.move, reduceMotion: ReduceMotion.System })));
    }, [shine, locked, reduced, replay, sweep]);
    const band = useAnimatedProps(() => ({ x: sweep.get() }));

    return (
        <View style={{ width: size, height: size }} accessible accessibilityRole="image"
            accessibilityLabel={locked ? `${rank}, not reached yet` : `${rank} gem`}>
            <Svg width={size} height={size} viewBox="0 0 100 100">
                <Defs>
                    <RadialGradient id={`glow${id}`} cx="50" cy="52" r="48" gradientUnits="userSpaceOnUse">
                        <Stop offset="0" stopColor={tone.iridescent ? tone.iridescent[1] : base} stopOpacity={0.45} />
                        <Stop offset="1" stopColor={base} stopOpacity={0} />
                    </RadialGradient>
                    {tone.iridescent ? (
                        <LinearGradient id={`opal${id}`} x1="18" y1="24" x2="82" y2="80" gradientUnits="userSpaceOnUse">
                            {tone.iridescent.map((stop, index) => (
                                <Stop key={stop} offset={index / (tone.iridescent!.length - 1)} stopColor={stop} stopOpacity={0.75} />
                            ))}
                        </LinearGradient>
                    ) : null}
                    <LinearGradient id={`sweep${id}`} x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor={t.color.textPrimary} stopOpacity={0} />
                        <Stop offset="0.5" stopColor={t.color.textPrimary} stopOpacity={0.55} />
                        <Stop offset="1" stopColor={t.color.textPrimary} stopOpacity={0} />
                    </LinearGradient>
                    <ClipPath id={`cut${id}`}><Polygon points={OUTLINE} /></ClipPath>
                </Defs>

                {locked ? null : <Rect x="0" y="0" width="100" height="100" fill={`url(#glow${id})`} />}
                {FACETS.map(facet => (
                    <Polygon key={facet.points} points={facet.points}
                        fill={facet.white ? mixHex(base, t.color.textPrimary, facet.white * (locked ? 0.4 : 1))
                            : facet.black ? mixHex(base, t.color.background, facet.black) : base}
                        stroke={t.color.textPrimary} strokeOpacity={locked ? 0.08 : 0.18} strokeWidth={0.6} strokeLinejoin="round" />
                ))}
                {tone.iridescent && !locked ? <Polygon points={OUTLINE} fill={`url(#opal${id})`} /> : null}
                {shine && !locked ? (
                    <G clipPath={`url(#cut${id})`}>
                        <G transform="rotate(20 50 50)">
                            <AnimatedRect animatedProps={band} y="-20" width="26" height="140" fill={`url(#sweep${id})`} />
                        </G>
                    </G>
                ) : null}
            </Svg>
        </View>
    );
}
