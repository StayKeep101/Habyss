import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CountUp } from '@/components/ui/Motion';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { VoidCard } from '@/components/ui/VoidCard';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { s, vs, ms } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import type { Momentum } from '@/lib/momentum';

const EASE = { duration: 420, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

/**
 * Whether the habits are getting stronger.
 *
 * The number it replaces graded you — and graded you harshly, since a single
 * missed habit wrote off the whole day and adding a habit lowered the score.
 * This one carries its own direction instead, which is the part a person can
 * move, and the arrow rather than the percentage is what the eye lands on.
 *
 * The delta rides in the corner where the streak card keeps its badge, so the
 * three cards still read as one row.
 */
export const MomentumCard: React.FC<{ momentum: Momentum; onPress: () => void }> = ({ momentum, onPress }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { primary } = useAccentGradient();

    const { rate, delta, direction, comparable } = momentum;
    const tint = !comparable ? primary : direction === 'up' ? colors.success : direction === 'down' ? colors.warning : primary;
    const icon = !comparable ? 'pulse' : direction === 'up' ? 'trending-up' : direction === 'down' ? 'trending-down' : 'remove';

    // The dial fills to the rate, but it is the arrow that carries the meaning.
    const filled = useSharedValue(0);
    useEffect(() => { filled.value = withTiming(Math.min(1, Math.max(0, rate / 100)), EASE); }, [rate, filled]);
    const bar = useAnimatedStyle(() => ({ width: `${filled.value * 100}%` }));

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={comparable
                ? `Momentum ${rate} percent, ${delta >= 0 ? 'up' : 'down'} ${Math.abs(delta)} on the previous ${momentum.days} days`
                : `Momentum ${rate} percent`}
            style={styles.touchable}
        >
            <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[styles.container, isLight && { backgroundColor: colors.surfaceSecondary }]}>
                <View style={styles.iconContainer}>
                    <View style={[styles.iconCircle, { backgroundColor: tint + '30' }]}>
                        <Ionicons name={icon as never} size={s(20)} color={tint} />
                    </View>
                </View>

                <View style={styles.readout}>
                    <CountUp style={[styles.value, { color: colors.textPrimary }]} value={`${rate}%`} />
                    <Text style={[styles.label, { color: colors.textTertiary }]}>MOMENTUM</Text>
                </View>

                {/* A hairline of the rate, so the percentage is not the only cue. */}
                <View style={[styles.track, { backgroundColor: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)' }]}>
                    <Animated.View style={[styles.fill, bar, { backgroundColor: tint }]} />
                </View>

                {comparable && delta !== 0 ? (
                    <View style={[styles.delta, { backgroundColor: tint + '22' }]}>
                        <Text style={[styles.deltaText, { color: tint }]}>{`${delta > 0 ? '+' : ''}${delta}`}</Text>
                    </View>
                ) : null}
            </VoidCard>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    touchable: { flex: 1 },
    container: { flex: 1, padding: s(10), alignItems: 'center', justifyContent: 'center', gap: s(6), minHeight: s(100) },
    iconContainer: { marginBottom: vs(2) },
    iconCircle: { width: s(36), height: s(36), borderRadius: s(18), alignItems: 'center', justifyContent: 'center' },
    readout: { alignItems: 'center' },
    value: { fontSize: ms(24), fontFamily: FontFamily.bold, textAlign: 'center', lineHeight: ms(24), fontVariant: ['tabular-nums'] },
    label: { fontSize: ms(8), letterSpacing: 1, fontFamily: FontFamily.bold, textAlign: 'center', marginTop: vs(2) },
    track: { height: vs(3), borderRadius: s(2), width: '68%', overflow: 'hidden', marginTop: vs(2) },
    fill: { height: '100%', borderRadius: s(2) },
    delta: { position: 'absolute', top: vs(10), right: s(10), paddingHorizontal: s(5), paddingVertical: vs(2), borderRadius: s(8) },
    deltaText: { fontSize: ms(9), fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
});
