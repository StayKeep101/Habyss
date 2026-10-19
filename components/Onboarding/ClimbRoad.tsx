import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing, FadeIn, ReduceMotion, ZoomIn, interpolate, useAnimatedStyle, useSharedValue,
    withDelay, withRepeat, withSequence, withSpring, withTiming, type SharedValue,
} from 'react-native-reanimated';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { useTokens } from '@/hooks/useTokens';
import { FontFamily } from '@/theme/designSystem';
import { s, vs } from '@/theme/scale';

/** The road's height on screen; the questions take the rest. */
export const ROAD_HEIGHT = vs(170);
/** How far apart the stops on the road are: one per question. */
const GAP = vs(64);
const LIGHT = s(14);
const HALO = LIGHT * 4;
/** Where the light sits, from the bottom of the road. */
const LIGHT_CENTER = vs(44);
const DOT = s(8);
const EASE = { easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

/**
 * The climb, along the bottom of onboarding. The little light is you.
 *
 * It falls into the dark at the start and settles. Every answer is a step up:
 * the road slides down under the light (it stays where it is, so the eye
 * never has to look for it), the stop you just passed keeps a word of what
 * you said, and the light grows a little brighter the higher it gets. Your
 * name rides on a tag just above it once you have given it.
 */
export function ClimbRoad({ climb, stops, name, marks, showRoad }: {
    /** How many steps up you are (0 at the bottom). */
    climb: number;
    /** How many stops the whole road has. */
    stops: number;
    /** Your name tag, once given. */
    name?: string | null;
    /** A word left at each stop you have passed (index = stop). */
    marks: (string | null | undefined)[];
    /** The road itself appears once the climb begins. */
    showRoad: boolean;
}) {
    const t = useTokens();
    const height = useSharedValue(climb);
    const hop = useSharedValue(0);
    const fall = useSharedValue(-ROAD_HEIGHT);
    const breath = useSharedValue(0);
    const road = useSharedValue(showRoad ? 1 : 0);

    useEffect(() => {
        fall.value = withTiming(0, { duration: 1400, ...EASE });
        breath.value = withDelay(1300, withRepeat(withSequence(
            withTiming(1, { duration: 1400, ...EASE }), withTiming(0, { duration: 1400, ...EASE })), -1, false));
    }, [fall, breath]);

    useEffect(() => {
        height.value = withTiming(climb, { duration: 700, ...EASE });
        // A little leap as the world slides under it.
        hop.value = withSequence(withTiming(-vs(12), { duration: 240, ...EASE }), withSpring(0, { damping: 9, stiffness: 160 }));
    }, [climb, height, hop]);

    useEffect(() => { road.value = withTiming(showRoad ? 1 : 0, { duration: 600, ...EASE }); }, [showRoad, road]);

    const light = useAnimatedStyle(() => ({ transform: [{ translateY: fall.value + hop.value }] }));
    const halo = useAnimatedStyle(() => {
        // Brighter the higher it climbs; it breathes either way.
        const lift = Math.min(1, height.value / Math.max(1, stops - 1));
        return {
            opacity: 0.18 + lift * 0.22 + breath.value * 0.18,
            transform: [{ scale: 1 + lift * 0.35 + breath.value * 0.25 }],
        };
    });
    const roadStyle = useAnimatedStyle(() => ({ opacity: road.value }));

    return (
        <View style={styles.wrap} pointerEvents="none"
            accessibilityLabel={name ? `${name}, ${climb} of ${stops - 1} steps up` : `${climb} of ${stops - 1} steps up`}>
            <Animated.View style={[StyleSheet.absoluteFill, roadStyle]}>
                <View style={[styles.line, { backgroundColor: t.color.border }]} />
                {Array.from({ length: stops }, (_, index) => (
                    <Stop key={index} index={index} height={height} passed={index <= climb} mark={index < climb ? marks[index] : null} />
                ))}
            </Animated.View>

            <Animated.View style={[styles.anchor, light]}>
                {name ? (
                    <Animated.View key={name} entering={ZoomIn.springify().damping(12)} style={styles.tagWrap}>
                        <MatteSurface radius={t.radius.full} level="control" tint={t.color.accent} style={styles.tag}>
                            <Text numberOfLines={1} style={[t.type.caption, styles.tagText, { color: t.color.onAccent }]}>{name}</Text>
                        </MatteSurface>
                    </Animated.View>
                ) : null}
                <View style={styles.lightWrap}>
                    <Animated.View style={[styles.halo, { backgroundColor: t.color.accent }, halo]} />
                    <View style={[styles.light, { backgroundColor: t.color.accent }]} />
                </View>
            </Animated.View>
        </View>
    );
}

/** One stop on the road: lit once passed, with the word you left there. */
function Stop({ index, height, passed, mark }: { index: number; height: SharedValue<number>; passed: boolean; mark?: string | null }) {
    const t = useTokens();
    const place = useAnimatedStyle(() => {
        const offset = index - height.value;
        return {
            // Above the light, fading into the dark; below, fading as it falls away.
            opacity: interpolate(offset, [-2.4, -0.2, 0, 1.6], [0, 1, 1, 0], 'clamp'),
            transform: [{ translateY: -offset * GAP }],
        };
    });
    const left = index % 2 === 0;
    return (
        <Animated.View style={[styles.stop, place]}>
            <View style={[styles.dot, { backgroundColor: passed ? t.color.accent : t.color.border }]} />
            {mark ? (
                <Animated.Text entering={FadeIn.duration(400)} numberOfLines={1}
                    style={[t.type.caption, styles.mark, left ? styles.markLeft : styles.markRight, { color: t.color.textSubtle }]}>
                    {mark}
                </Animated.Text>
            ) : null}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: { height: ROAD_HEIGHT, overflow: 'hidden' },
    line: { position: 'absolute', top: 0, bottom: 0, left: '50%', width: StyleSheet.hairlineWidth * 2, marginLeft: -StyleSheet.hairlineWidth },
    stop: { position: 'absolute', left: 0, right: 0, bottom: LIGHT_CENTER - DOT / 2, height: DOT, alignItems: 'center', justifyContent: 'center' },
    dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
    mark: { position: 'absolute', width: '40%' },
    markLeft: { right: '50%', marginRight: s(16), textAlign: 'right' },
    markRight: { left: '50%', marginLeft: s(16), textAlign: 'left' },
    anchor: { position: 'absolute', left: 0, right: 0, bottom: LIGHT_CENTER - HALO / 2, alignItems: 'center' },
    tagWrap: { marginBottom: -s(8), maxWidth: '60%' },
    tag: { paddingHorizontal: s(12), paddingVertical: vs(4) },
    tagText: { fontFamily: FontFamily.semibold },
    lightWrap: { width: HALO, height: HALO, alignItems: 'center', justifyContent: 'center' },
    halo: { position: 'absolute', width: HALO, height: HALO, borderRadius: HALO / 2 },
    light: { width: LIGHT, height: LIGHT, borderRadius: LIGHT / 2 },
});
