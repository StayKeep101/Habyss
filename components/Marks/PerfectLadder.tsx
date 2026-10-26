import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AnimatedFill, PopIn } from '@/components/ui/Motion';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { MAX_MULTIPLIER } from '@/lib/marks';

/** Perfect days in a row for each step up the multiplier (lib/marks.ts multiplierFor). */
const DAYS_PER_STEP = 7;

/**
 * The perfect-day multiplier as a picture: one dot per step from ×1 to the
 * top, filled up to where you are, and a bar for how close the next step is.
 */
export function PerfectLadder({ multiplier, run }: { multiplier: number; run: number }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const steps = Array.from({ length: MAX_MULTIPLIER }, (_, index) => index + 1);
    const top = multiplier >= MAX_MULTIPLIER;
    const intoStep = top ? DAYS_PER_STEP : run % DAYS_PER_STEP;

    return (
        <View style={styles.wrap} accessible accessibilityLabel={`Perfect days: ${run} in a row, ×${multiplier}. ${top ? 'Top multiplier.' : `${DAYS_PER_STEP - intoStep} more for ×${multiplier + 1}.`} Missing a day resets it to ×1.`}>
            <View style={styles.head}>
                <AppIcon name="flame" size={16} color={run > 0 ? colors.warning : colors.textTertiary} />
                <Text style={[styles.run, { color: colors.textPrimary }]}>{run}</Text>
                <Text style={[styles.times, { color: primary }]}>×{multiplier}</Text>
            </View>

            <View style={styles.steps}>
                {steps.map((step, index) => {
                    const reached = step <= multiplier;
                    const current = step === multiplier;
                    return (
                        <PopIn key={step} index={index} style={styles.step}>
                            <View style={[styles.dot, {
                                backgroundColor: reached ? primary : 'transparent',
                                borderColor: reached ? primary : colors.border,
                                transform: [{ scale: current ? 1.25 : 1 }],
                            }]} />
                            <Text style={[styles.stepLabel, { color: current ? colors.textPrimary : colors.textTertiary }]}>×{step}</Text>
                        </PopIn>
                    );
                })}
            </View>

            {top ? null : (
                <View style={styles.next}>
                    <View style={[styles.track, { backgroundColor: colors.border }]}>
                        <AnimatedFill progress={intoStep / DAYS_PER_STEP} style={[styles.fill, { backgroundColor: primary }]} replay={run} />
                    </View>
                    <Text style={[styles.nextLabel, { color: colors.textSecondary }]}>{intoStep}/{DAYS_PER_STEP} → ×{multiplier + 1}</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    run: { fontFamily: FontFamily.bold, fontSize: 20, fontVariant: ['tabular-nums'] },
    times: { fontFamily: FontFamily.bold, fontSize: 20, marginLeft: 'auto' },
    steps: { flexDirection: 'row', justifyContent: 'space-between' },
    step: { alignItems: 'center', gap: 4 },
    dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5 },
    stepLabel: { fontFamily: FontFamily.medium, fontSize: 11, fontVariant: ['tabular-nums'] },
    next: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
    nextLabel: { fontFamily: FontFamily.medium, fontSize: 12, fontVariant: ['tabular-nums'] },
});
