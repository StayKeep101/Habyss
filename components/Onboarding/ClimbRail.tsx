import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing, ReduceMotion, ZoomIn, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { useTokens } from '@/hooks/useTokens';
import { FontFamily } from '@/theme/designSystem';
import { s, vs } from '@/theme/scale';

/** The column the rail takes on the left once the climb begins. */
export const RAIL_WIDTH = s(60);
const LIGHT = s(14);
const HALO = LIGHT * 4;
const DOT = s(7);
const TOP = vs(28);
const BOTTOM = vs(36);
/** On the welcome screen the light rests here, above the words, centred. */
const WELCOME_Y = 0.24;
const EASE = { easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

/**
 * The climb, as a rail down the left of onboarding. The little light is you.
 *
 * It falls from the top of the screen and settles above the welcome words.
 * "Start climbing" sends it up and over to the bottom of the rail on the
 * left, where a dot waits for each page; every answer moves it up one dot,
 * the dots behind it lit, and it glows brighter the higher it gets. Your
 * name rides on a tag just above it once you have given it.
 */
export function ClimbRail({ step, pages, name }: {
    /** Where you are: 0 is the welcome screen, then 1 … pages. */
    step: number;
    /** How many dots the rail has. */
    pages: number;
    name?: string | null;
}) {
    const t = useTokens();
    const [size, setSize] = useState({ width: 0, height: 0 });
    const railX = RAIL_WIDTH / 2;
    const dotY = (index: number) => {
        const span = Math.max(1, size.height - TOP - BOTTOM);
        return size.height - BOTTOM - ((index - 1) / Math.max(1, pages - 1)) * span;
    };
    const spot = (at: number) => at <= 0
        ? { x: size.width / 2, y: size.height * WELCOME_Y }
        : { x: railX, y: dotY(Math.min(at, pages)) };

    const x = useSharedValue(0);
    const y = useSharedValue(-HALO);
    const glow = useSharedValue(0);
    const breath = useSharedValue(0);
    const rail = useSharedValue(step > 0 ? 1 : 0);
    const placed = useRef(false);

    useEffect(() => {
        breath.value = withDelay(1300, withRepeat(withSequence(
            withTiming(1, { duration: 1400, ...EASE }), withTiming(0, { duration: 1400, ...EASE })), -1, false));
    }, [breath]);

    useEffect(() => {
        if (!size.height) return;
        const to = spot(step);
        if (!placed.current) {
            // First frame: drop in from above the screen to where it belongs.
            x.value = to.x;
            y.value = -HALO - size.height * 0.2;
            y.value = withTiming(to.y, { duration: 1400, ...EASE });
            placed.current = true;
        } else if (step > 0 && x.value > railX + 1) {
            // Off the welcome screen: up and over to the rail, along a curve
            // (across eases in late, up eases out early).
            x.value = withTiming(to.x, { duration: 1100, easing: Easing.inOut(Easing.cubic), reduceMotion: ReduceMotion.System });
            y.value = withTiming(to.y, { duration: 1100, easing: Easing.out(Easing.quad), reduceMotion: ReduceMotion.System });
        } else {
            x.value = withTiming(to.x, { duration: 700, ...EASE });
            y.value = withTiming(to.y, { duration: 700, ...EASE });
        }
        glow.value = withTiming(Math.min(1, Math.max(0, step - 1) / Math.max(1, pages - 1)), { duration: 700 });
        rail.value = withDelay(step > 0 ? 500 : 0, withTiming(step > 0 ? 1 : 0, { duration: 600, ...EASE }));
    }, [step, size.width, size.height]); // eslint-disable-line react-hooks/exhaustive-deps

    const light = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - HALO / 2 }, { translateY: y.value - HALO / 2 }] }));
    const halo = useAnimatedStyle(() => ({
        opacity: 0.18 + glow.value * 0.22 + breath.value * 0.18,
        transform: [{ scale: 1 + glow.value * 0.35 + breath.value * 0.25 }],
    }));
    const railStyle = useAnimatedStyle(() => ({ opacity: rail.value }));
    // The tag sits on the light; it is drawn in the light's own frame, just above.
    const tag = useAnimatedStyle(() => ({ transform: [{ translateX: x.value - RAIL_WIDTH / 2 }, { translateY: y.value - HALO / 2 - vs(22) }] }));

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={event => setSize(event.nativeEvent.layout)}
            accessibilityLabel={step > 0 ? `Step ${Math.min(step, pages)} of ${pages}` : undefined}>
            {size.height ? (
                <Animated.View style={[StyleSheet.absoluteFill, railStyle]}>
                    <View style={[styles.line, { left: railX, top: dotY(pages), height: dotY(1) - dotY(pages), backgroundColor: t.color.border }]} />
                    {Array.from({ length: pages }, (_, index) => {
                        const at = index + 1;
                        const passed = at < step;
                        const here = at === step;
                        return (
                            <View key={at} style={[styles.dot, {
                                left: railX - DOT / 2, top: dotY(at) - DOT / 2,
                                backgroundColor: passed || here ? t.color.accent : t.color.border,
                                opacity: passed ? 0.7 : 1,
                            }]} />
                        );
                    })}
                </Animated.View>
            ) : null}

            <Animated.View style={[styles.lightWrap, light]}>
                <Animated.View style={[styles.halo, { backgroundColor: t.color.accent }, halo]} />
                <View style={[styles.light, { backgroundColor: t.color.accent }]} />
            </Animated.View>

            {name ? (
                <Animated.View style={[styles.tagFrame, tag]}>
                    <Animated.View key={name} entering={ZoomIn.duration(300)}>
                        <MatteSurface radius={t.radius.full} level="control" tint={t.color.accent} style={styles.tag}>
                            <Text numberOfLines={1} style={[t.type.caption, styles.tagText, { color: t.color.onAccent }]}>{name}</Text>
                        </MatteSurface>
                    </Animated.View>
                </Animated.View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    line: { position: 'absolute', width: StyleSheet.hairlineWidth * 2, marginLeft: -StyleSheet.hairlineWidth },
    dot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2 },
    lightWrap: { position: 'absolute', left: 0, top: 0, width: HALO, height: HALO, alignItems: 'center', justifyContent: 'center' },
    halo: { position: 'absolute', width: HALO, height: HALO, borderRadius: HALO / 2 },
    light: { width: LIGHT, height: LIGHT, borderRadius: LIGHT / 2 },
    tagFrame: { position: 'absolute', left: 0, top: 0, width: RAIL_WIDTH, alignItems: 'center' },
    tag: { paddingHorizontal: s(8), paddingVertical: vs(2), maxWidth: RAIL_WIDTH },
    tagText: { fontFamily: FontFamily.semibold },
});
