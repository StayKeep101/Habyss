import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, FadeIn, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppButton } from '@/components/ui/AppButton';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { echoLineFor, type ClimbMoment } from '@/lib/climbMoments';

const RISE = { duration: 1100, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

/**
 * A beat of the climb: light rising from the bottom of the screen, a spark
 * settling, then what happened — your first foothold, or the rank you just
 * reached — and Echo's line. One button back to the day.
 */
export function ClimbMomentOverlay({ moment, onDone }: { moment: ClimbMoment | null; onDone: () => void }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary, colors: gradient } = useAccentGradient();
    const rise = useSharedValue(0);

    useEffect(() => {
        if (!moment) return;
        rise.value = 0;
        rise.value = withTiming(1, RISE);
    }, [moment, rise]);

    const beam = useAnimatedStyle(() => ({ opacity: rise.value, transform: [{ translateY: (1 - rise.value) * 220 }] }));
    const spark = useAnimatedStyle(() => ({ transform: [{ translateY: (1 - rise.value) * 320 }], opacity: rise.value }));

    if (!moment) return null;
    const kicker = moment.kind === 'foothold' ? 'Your first foothold' : 'You climbed to';
    const title = moment.kind === 'foothold' ? 'Out of the dark' : moment.rank;

    return (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onDone}>
            <View style={[styles.screen, { backgroundColor: colors.background }]}>
                <Animated.View style={[StyleSheet.absoluteFill, beam]} pointerEvents="none">
                    <LinearGradient colors={['transparent', gradient[0] + '33', gradient[1] + '66']} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
                </Animated.View>
                <View style={styles.center}>
                    <Animated.View style={[styles.sparkWrap, spark]}>
                        <View style={[styles.halo, { backgroundColor: primary }]} />
                        <View style={[styles.spark, { backgroundColor: primary, shadowColor: primary }]} />
                    </Animated.View>
                    <Animated.Text entering={FadeIn.delay(900).duration(500)} style={[styles.kicker, { color: colors.textSecondary }]}>{kicker}</Animated.Text>
                    <Animated.Text entering={FadeIn.delay(1100).duration(500)} style={[styles.title, { color: colors.textPrimary }]}>{title}</Animated.Text>
                    <Animated.Text entering={FadeIn.delay(1600).duration(500)} style={[styles.echo, { color: primary }]}>“{echoLineFor(moment)}”</Animated.Text>
                    <Animated.Text entering={FadeIn.delay(1600).duration(500)} style={[styles.by, { color: colors.textTertiary }]}>Echo</Animated.Text>
                </View>
                <Animated.View entering={FadeIn.delay(2000).duration(400)} style={styles.actions}>
                    <AppButton label="Keep climbing" onPress={onDone} />
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, paddingHorizontal: Spacing.xl },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    sparkWrap: { width: 90, height: 90, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
    halo: { position: 'absolute', width: 80, height: 80, borderRadius: 40, opacity: 0.25 },
    spark: { width: 18, height: 18, borderRadius: 9, shadowOpacity: 0.9, shadowRadius: 16, shadowOffset: { width: 0, height: 0 } },
    kicker: { fontFamily: FontFamily.medium, fontSize: 15 },
    title: { fontFamily: FontFamily.bold, fontSize: 40, lineHeight: 46, letterSpacing: -1, textAlign: 'center' },
    echo: { fontFamily: FontFamily.medium, fontSize: 18, lineHeight: 26, textAlign: 'center', marginTop: Spacing.lg },
    by: { fontFamily: FontFamily.regular, fontSize: 12 },
    actions: { paddingBottom: Spacing.section + Spacing.lg },
});
