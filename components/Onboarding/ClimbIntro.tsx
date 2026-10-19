import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { APP_NAME } from '@/constants/brand';

/**
 * The opening of the story (docs: "Climb Out" trailer): the bottom of the
 * abyss, where everyone starts. The light — you — falls into the dark below
 * (that is ClimbRoad, which stays for the whole climb); then these two lines,
 * then the mark. Plays once, about three seconds.
 */
export function ClimbIntro() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();

    return (
        <View style={styles.wrap} accessible accessibilityLabel="Everyone starts Lost. Echo: Just one thing. Today.">
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
    lost: { fontFamily: FontFamily.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.6, textAlign: 'center' },
    echo: { fontFamily: FontFamily.medium, fontSize: 18, lineHeight: 26, textAlign: 'center' },
    mark: { alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xxl },
    markImage: { width: 56, height: 56 },
    name: { fontFamily: FontFamily.semibold, fontSize: 15 },
});
