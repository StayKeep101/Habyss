import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing, FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, ZoomIn,
} from 'react-native-reanimated';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { APP_NAME } from '@/constants/brand';

const MARK = 104;
const HALO = 240;

/**
 * The first thing anyone sees: the mark rising out of the dark with a slow
 * halo of the accent colour breathing behind it, then the name. Nothing to
 * read, nothing to decide. Still, without the motion, when Reduce Motion is on.
 */
export function WelcomeMark() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const breath = useSharedValue(0);
    useEffect(() => {
        breath.value = withDelay(900, withRepeat(withSequence(
            withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
            withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
        ), -1, false, undefined, ReduceMotion.System));
    }, [breath]);
    const halo = useAnimatedStyle(() => ({ opacity: 0.18 + breath.value * 0.17, transform: [{ scale: 0.9 + breath.value * 0.15 }] }));

    return (
        <View style={styles.wrap} accessible accessibilityRole="header" accessibilityLabel={APP_NAME}>
            <View style={styles.stage}>
                <Animated.View entering={FadeIn.delay(300).duration(1200).reduceMotion(ReduceMotion.System)} style={StyleSheet.absoluteFill}>
                    <Animated.View style={[styles.halo, { backgroundColor: primary, shadowColor: primary }, halo]} />
                </Animated.View>
                <Animated.View entering={ZoomIn.springify().damping(14).delay(150).reduceMotion(ReduceMotion.System)}>
                    <Image source={require('@/assets/images/habyss-mark.png')} style={styles.mark} resizeMode="contain" />
                </Animated.View>
            </View>
            <Animated.View entering={FadeIn.delay(800).duration(700).reduceMotion(ReduceMotion.System)}>
                <Text style={[styles.name, { color: colors.textPrimary }]}>{APP_NAME}</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', gap: Spacing.xl },
    stage: { width: HALO, height: HALO, alignItems: 'center', justifyContent: 'center' },
    halo: { position: 'absolute', top: HALO * 0.2, left: HALO * 0.2, width: HALO * 0.6, height: HALO * 0.6, borderRadius: HALO * 0.3, shadowOpacity: 1, shadowRadius: 60, shadowOffset: { width: 0, height: 0 } },
    mark: { width: MARK, height: MARK },
    name: { fontFamily: FontFamily.bold, fontSize: 40, lineHeight: 46, letterSpacing: -1 },
});
