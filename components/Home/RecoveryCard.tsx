import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CountUp } from '@/components/ui/Motion';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { VoidCard } from '@/components/ui/VoidCard';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { s, vs, ms } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import type { Recovery } from '@/lib/recovery';

const EASE = { duration: 420, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

/**
 * How often a miss stayed a single miss.
 *
 * The card it replaces showed today's completion, which the profile ring and
 * the focus card already say twice over. This one answers a question nothing
 * else on the screen can: whether you get back up.
 *
 * When something is savable today the card stops reporting and starts asking —
 * it turns amber and breathes once, because a habit about to be missed twice is
 * the single most useful thing the home screen can point at.
 */
export const RecoveryCard: React.FC<{ recovery: Recovery; onPress: () => void }> = ({ recovery, onPress }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { primary } = useAccentGradient();

    const { rate, atRisk } = recovery;
    const risk = atRisk.length > 0;
    const tint = risk ? colors.warning : rate === null ? primary : rate >= 70 ? colors.success : rate >= 40 ? primary : colors.warning;

    // One slow breath while something is still savable; otherwise perfectly still.
    const pulse = useSharedValue(1);
    useEffect(() => {
        pulse.value = risk
            ? withRepeat(withSequence(withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System }),
                withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad), reduceMotion: ReduceMotion.System })), -1, false)
            : withTiming(1, EASE);
    }, [risk, pulse]);
    const breathe = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

    return (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={risk
                ? `${atRisk.length} habit${atRisk.length === 1 ? '' : 's'} about to be missed twice. Open recovery.`
                : rate === null ? 'Recovery, nothing missed yet' : `Recovery ${rate} percent`}
            style={styles.touchable}
        >
            <VoidCard glass={!isTrueDark} intensity={isLight ? 20 : 80} style={[styles.container]}>
                <Animated.View style={[styles.iconContainer, breathe]}>
                    <View style={[styles.iconCircle, { backgroundColor: tint + '30' }]}>
                        <Ionicons name={risk ? 'alert' : 'refresh'} size={s(20)} color={tint} />
                    </View>
                </Animated.View>

                <View style={styles.readout}>
                    <CountUp style={[styles.value, { color: risk ? tint : colors.textPrimary }]}
                        value={risk ? atRisk.length : rate === null ? '—' : `${rate}%`} />
                    <Text style={[styles.label, { color: colors.textTertiary }]}>
                        {risk ? 'TO PROTECT' : 'RECOVERY'}
                    </Text>
                </View>
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
});
