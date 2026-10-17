import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VoidCard } from '@/components/ui/VoidCard';
import { AppButton } from '@/components/ui/AppButton';
import { AnimatedFill } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { extendExperiment, keepExperiment, revertExperiment, type Experiment, type Verdict } from '@/lib/echoExperiments';

/**
 * One experiment: how far in it is, what the record says so far, and, once
 * the week is over, the choice to keep the change, go back, or run 7 more days.
 */
export function ExperimentCard({ experiment, verdict }: { experiment: Experiment; verdict: Verdict }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { selectionFeedback } = useHaptics();
    const change = experiment.type === 'morning' ? `Moved to ${experiment.after.startTime}` : `Target ${experiment.after.goalValue}`;
    return (
        <VoidCard style={styles.card}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{experiment.habitName}</Text>
            <Text style={[styles.meta, { color: colors.textTertiary }]}>
                {change} · day {Math.min(verdict.daysIn, experiment.days)} of {experiment.days}
            </Text>
            <View style={[styles.track, { backgroundColor: colors.surfaceTertiary }]}>
                <AnimatedFill progress={Math.min(1, verdict.daysIn / experiment.days)} style={[styles.fill, { backgroundColor: primary }]} />
            </View>
            <Text style={[styles.verdict, { color: colors.textSecondary }]}>{verdict.text}</Text>
            {verdict.done ? (
                <View style={styles.buttons}>
                    <AppButton label="Keep it" onPress={() => { selectionFeedback(); void keepExperiment(experiment.id); }} style={styles.flex} />
                    <AppButton label="Go back" variant="ghost" onPress={() => { selectionFeedback(); void revertExperiment(experiment.id); }} style={styles.flex} />
                    <AppButton label="7 more days" variant="ghost" onPress={() => { selectionFeedback(); void extendExperiment(experiment.id); }} style={styles.flex} />
                </View>
            ) : null}
        </VoidCard>
    );
}

const styles = StyleSheet.create({
    flex: { flex: 1 },
    card: { padding: Spacing.lg, gap: Spacing.xs + 2 },
    title: { fontFamily: FontFamily.semibold, fontSize: 15 },
    meta: { fontFamily: FontFamily.medium, fontSize: 12 },
    track: { height: 4, borderRadius: Radius.pill, overflow: 'hidden', marginVertical: Spacing.xs },
    fill: { height: '100%', borderRadius: Radius.pill },
    verdict: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 19 },
    buttons: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
});
