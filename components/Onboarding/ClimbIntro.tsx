import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Easing, FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { APP_NAME } from '@/constants/brand';

const SPARK = 14;
const EASE = { easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

/**
 * The opening of the story (docs: "Climb Out" trailer): the bottom of the
 * abyss, where everyone starts. Echo's spark drifts down out of the dark and
 * settles; then the two lines, then the mark. Plays once, about three seconds.
 */
export function ClimbIntro() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();

    const fall = useSharedValue(-160);
    const glow = useSharedValue(0);
    useEffect(() => {
        fall.value = withTiming(0, { duration: 1400, ...EASE });
        // Three soft breaths once it arrives, then it rests lit.
        glow.value = withDelay(1300, withRepeat(withSequence(
            withTiming(1, { duration: 900, ...EASE }), withTiming(0.55, { duration: 900, ...EASE })), 3, false));
    }, [fall, glow]);
    const spark = useAnimatedStyle(() => ({ transform: [{ translateY: fall.value }] }));
    const halo = useAnimatedStyle(() => ({ opacity: 0.15 + glow.value * 0.35, transform: [{ scale: 1 + glow.value * 0.6 }] }));

    return (
        <View style={styles.wrap} accessible accessibilityLabel="Everyone starts Lost. Echo: Just one thing. Today.">
            <View style={styles.sparkArea}>
                <Animated.View style={[styles.sparkWrap, spark]}>
                    <Animated.View style={[styles.halo, { backgroundColor: primary }, halo]} />
                    <View style={[styles.spark, { backgroundColor: primary, shadowColor: primary }]} />
                </Animated.View>
            </View>
            <Animated.Text entering={FadeIn.delay(1500).duration(600)} style={[styles.lost, { color: colors.textPrimary }]}>
                Everyone starts Lost.
            </Animated.Text>
            <Animated.Text entering={FadeIn.delay(2300).duration(600)} style={[styles.echo, { color: primary }]}>
                “Just one thing. Today.”
            </Animated.Text>
            <Animated.View entering={FadeIn.delay(3000).duration(600)} style={styles.mark}>
                <Image source={require('@/assets/images/habyss-mark.png')} style={styles.markImage} resizeMode="contain"
                    accessibilityLabel={`${APP_NAME} logo`} />
                <Text style={[styles.name, { color: colors.textSecondary }]}>{APP_NAME}</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { alignItems: 'center', gap: Spacing.md },
    sparkArea: { height: 120, justifyContent: 'flex-end', alignItems: 'center', marginBottom: Spacing.lg },
    sparkWrap: { width: SPARK * 5, height: SPARK * 5, alignItems: 'center', justifyContent: 'center' },
    halo: { position: 'absolute', width: SPARK * 4, height: SPARK * 4, borderRadius: SPARK * 2 },
    spark: { width: SPARK, height: SPARK, borderRadius: SPARK / 2, shadowOpacity: 0.9, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
    lost: { fontFamily: FontFamily.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, textAlign: 'center' },
    echo: { fontFamily: FontFamily.medium, fontSize: 18, lineHeight: 26, textAlign: 'center' },
    mark: { alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xxl },
    markImage: { width: 56, height: 56 },
    name: { fontFamily: FontFamily.semibold, fontSize: 15 },
});
