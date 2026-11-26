import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTokens } from '@/hooks/useTokens';
import { s } from '@/theme/scale';

const EDGE = s(34);

/**
 * The red edge of demon mode: the four sides of the screen glow red, fading
 * to nothing towards the middle. It sits over everything and catches no
 * touches. It fades in and out; it does not pulse.
 */
export function DemonEdge({ on }: { on: boolean }) {
    const t = useTokens();
    const shown = useSharedValue(on ? 1 : 0);
    useEffect(() => { shown.set(withTiming(on ? 1 : 0, { duration: 900 })); }, [on, shown]);
    const style = useAnimatedStyle(() => ({ opacity: shown.get() }));
    const red = t.color.danger;
    const fade = [`${red}B3`, `${red}00`] as const;
    return (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <LinearGradient colors={fade} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.top, { height: EDGE }]} />
            <LinearGradient colors={fade} start={{ x: 0, y: 1 }} end={{ x: 0, y: 0 }} style={[styles.bottom, { height: EDGE }]} />
            <LinearGradient colors={fade} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.left, { width: EDGE }]} />
            <LinearGradient colors={fade} start={{ x: 1, y: 0 }} end={{ x: 0, y: 0 }} style={[styles.right, { width: EDGE }]} />
            <View style={[StyleSheet.absoluteFill, styles.rim, { borderColor: `${red}99` }]} />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    top: { position: 'absolute', top: 0, left: 0, right: 0 },
    bottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
    left: { position: 'absolute', top: 0, bottom: 0, left: 0 },
    right: { position: 'absolute', top: 0, bottom: 0, right: 0 },
    rim: { borderWidth: s(2), borderRadius: s(44) },
});
