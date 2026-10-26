import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { APP_NAME } from '@/constants/brand';

const MARK = 104;
const HALO = 240;

/**
 * The first thing anyone sees: the mark fading up out of the dark over a
 * still, soft glow of the accent colour, then the name. Calm and timed, no
 * spring, no pulse. Still, without the motion, when Reduce Motion is on.
 */
export function WelcomeMark() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    // The mark settles from just under full size, eased, once: no overshoot.
    const settle = useSharedValue(0);
    useEffect(() => {
        settle.value = withDelay(150, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System }));
    }, [settle]);
    const mark = useAnimatedStyle(() => ({ opacity: settle.value, transform: [{ scale: 0.97 + settle.value * 0.03 }] }));

    return (
        <View style={styles.wrap} accessible accessibilityRole="header" accessibilityLabel={APP_NAME}>
            <View style={styles.stage}>
                <Animated.View entering={FadeIn.delay(300).duration(1400).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System)} style={StyleSheet.absoluteFill}>
                    <View style={[styles.halo, { backgroundColor: primary, shadowColor: primary }]} />
                </Animated.View>
                <Animated.View style={mark}>
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
    halo: { position: 'absolute', top: HALO * 0.2, left: HALO * 0.2, width: HALO * 0.6, height: HALO * 0.6, borderRadius: HALO * 0.3, opacity: 0.22, shadowOpacity: 1, shadowRadius: 60, shadowOffset: { width: 0, height: 0 } },
    mark: { width: MARK, height: MARK },
    name: { fontFamily: FontFamily.bold, fontSize: 40, lineHeight: 46, letterSpacing: -1 },
});
