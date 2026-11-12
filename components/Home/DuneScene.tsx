import React, { useEffect, useId, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming, Easing, type SharedValue } from 'react-native-reanimated';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { Colors } from '@/theme/colors';
import { surfaceFor } from '@/theme/designSystem';
import { mixHex } from '@/lib/colorContrast';
import { timingFor } from '@/theme/motion';

/** Drawn on a 300 × 400 grid (3 : 4), scaled to the scene's size. */
const W = 300;
const H = 400;
const HORIZON = 250;
/** The moon: low in the sky to the right, clear of the stats bar. */
const MOON = { x: 232, y: 168, r: 15 };

/** The stars: where each sits and how bright, the same every time. */
const STARS = Array.from({ length: 70 }, (_, index) => {
    const hash = (n: number) => Math.abs(Math.sin(index * 12.9898 + n * 78.233) * 43758.5453) % 1;
    return { x: hash(1) * W, y: hash(2) * (HORIZON - 40), r: 0.35 + hash(3) * 0.9, o: 0.25 + hash(4) * 0.6 };
});

// Built once, outside any worklet.
const TWINKLE = timingFor(4200, Easing.inOut(Easing.sin));

/**
 * Home's world, drawn in the app's own materials rather than photographed:
 * a night sky with stars and a crescent moon, mountains, and three dunes in
 * the matte surface's gradient, lit from above like every card, their crests
 * caught in your rank's colour, a glow on the horizon in it too. Each layer
 * drifts at its own pace as the page scrolls (`scrollY`), so it has depth.
 * A rank's scene is only its colours, so every rank has one without a picture.
 */
export function DuneScene({ width, height, scrollY, scrollRest = 0, tintColor }: {
    width: number; height: number; scrollY?: SharedValue<number>;
    /** Where the page rests unscrolled (a page that starts under a bar rests below 0). */
    scrollRest?: number;
    /** Another rank's colour (the carousel); yours by default. */
    tintColor?: string;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const tone = surfaceFor(theme);
    const { primary } = useAccentGradient();
    const accent = tintColor ?? primary;
    const reduced = useReducedMotion();
    // Its own gradient names, so two scenes on screen (Home, the carousel) never share them.
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');

    const palette = useMemo(() => ({
        skyTop: colors.background,
        skyLow: mixHex(colors.background, accent, 0.22),
        glow: accent,
        far: mixHex(tone.fill, accent, 0.18),
        mid: [mixHex(tone.top, accent, 0.12), tone.fill] as const,
        near: [mixHex(tone.top, accent, 0.08), colors.background] as const,
        crest: mixHex(accent, Colors.common.white, 0.45),
        moon: mixHex(Colors.common.white, accent, 0.15),
    }), [colors.background, tone.fill, tone.top, accent]);

    const twinkle = useSharedValue(0.7);
    useEffect(() => {
        if (reduced) return;
        twinkle.set(withRepeat(withTiming(1, TWINKLE), -1, true));
    }, [twinkle, reduced]);
    const starsStyle = useAnimatedStyle(() => ({ opacity: twinkle.get() }));

    // Parallax: the sky barely moves, the near dunes most. Plain numbers in the worklets.
    const useLayer = (speed: number) => useAnimatedStyle(() => ({ transform: [{ translateY: (scrollY ? -Math.min(200, Math.max(0, scrollY.get() - scrollRest)) : 0) * speed }] }));
    const skyMove = useLayer(-0.15);
    const farMove = useLayer(-0.08);
    const midMove = useLayer(0.02);
    const nearMove = useLayer(0.08);

    const svg = (children: React.ReactNode) => (
        <Svg width={width} height={height} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" style={StyleSheet.absoluteFill}>{children}</Svg>
    );

    return (
        <View style={[styles.scene, { width, height }]} pointerEvents="none">
            {/* The sky, the horizon's glow, the moon. */}
            <Animated.View style={[StyleSheet.absoluteFill, skyMove]}>
                {svg(<>
                    <Defs>
                        <LinearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={palette.skyTop} /><Stop offset="0.65" stopColor={palette.skyLow} /><Stop offset="1" stopColor={palette.skyTop} />
                        </LinearGradient>
                        <RadialGradient id={`glow${uid}`} cx="50%" cy={`${(HORIZON / H) * 100}%`} r="60%">
                            <Stop offset="0" stopColor={palette.glow} stopOpacity={0.4} /><Stop offset="1" stopColor={palette.glow} stopOpacity={0} />
                        </RadialGradient>
                        <RadialGradient id={`moonGlow${uid}`} cx="50%" cy="50%" r="50%">
                            <Stop offset="0" stopColor={palette.moon} stopOpacity={0.18} /><Stop offset="1" stopColor={palette.moon} stopOpacity={0} />
                        </RadialGradient>
                    </Defs>
                    <Rect x={0} y={0} width={W} height={H} fill={`url(#sky${uid})`} />
                    <Rect x={0} y={0} width={W} height={H} fill={`url(#glow${uid})`} />
                    <Circle cx={MOON.x} cy={MOON.y} r={MOON.r * 2.2} fill={`url(#moonGlow${uid})`} />
                    {/* A crescent as one shape (two arcs), so nothing is drawn over the sky to cut it. */}
                    <Path fill={palette.moon} d={`M ${MOON.x} ${MOON.y - MOON.r} A ${MOON.r} ${MOON.r} 0 1 0 ${MOON.x} ${MOON.y + MOON.r} A ${MOON.r * 0.62} ${MOON.r} 0 1 1 ${MOON.x} ${MOON.y - MOON.r} Z`} />
                </>)}
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, skyMove, starsStyle]}>
                {svg(STARS.map((star, index) => <Circle key={index} cx={star.x} cy={star.y} r={star.r} fill={Colors.common.white} opacity={star.o} />))}
            </Animated.View>

            {/* The mountains on the horizon. */}
            <Animated.View style={[StyleSheet.absoluteFill, farMove]}>
                {svg(<Path fill={palette.far} d={`M0 ${HORIZON} L0 232 L30 218 L58 228 L92 206 L128 224 L160 212 L196 226 L226 208 L262 222 L300 214 L300 ${HORIZON} Z`} />)}
            </Animated.View>

            {/* The dunes: the app's matte surface, lit from above, their crests in your rank's light. */}
            <Animated.View style={[StyleSheet.absoluteFill, midMove]}>
                {svg(<>
                    <Defs>
                        <LinearGradient id={`mid${uid}`} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={palette.mid[0]} /><Stop offset="1" stopColor={palette.mid[1]} />
                        </LinearGradient>
                    </Defs>
                    <Path fill={`url(#mid${uid})`} d="M0 262 C 60 236, 120 238, 170 252 C 220 266, 262 246, 300 240 L300 400 L0 400 Z" />
                    <Path fill="none" stroke={palette.crest} strokeOpacity={0.55} strokeWidth={1.1} d="M0 262 C 60 236, 120 238, 170 252 C 220 266, 262 246, 300 240" />
                </>)}
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, nearMove]}>
                {svg(<>
                    <Defs>
                        <LinearGradient id={`near${uid}`} x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={palette.near[0]} /><Stop offset="0.6" stopColor={palette.near[1]} />
                        </LinearGradient>
                    </Defs>
                    <Path fill={`url(#near${uid})`} d="M0 300 C 70 270, 150 282, 210 300 C 250 312, 280 300, 300 292 L300 400 L0 400 Z" />
                    <Path fill="none" stroke={palette.crest} strokeOpacity={0.8} strokeWidth={1.4} d="M0 300 C 70 270, 150 282, 210 300 C 250 312, 280 300, 300 292" />
                </>)}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    scene: { overflow: 'hidden' },
});
