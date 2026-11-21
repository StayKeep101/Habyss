import React from 'react';
import { StyleSheet, View } from 'react-native';
import { AnimatedFill, AppIcon, CountUp, SectionTitle, Text, VoidCard } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useTrackingProgress } from '@/hooks/useTrackingProgress';
import type { Habit } from '@/lib/habitsSQLite';
import { Radius, Spacing } from '@/theme/designSystem';

const amount = (value: number) => (Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 1 }));
const minutesSaid = (minutes: number) => (minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`);

/**
 * Today, for a habit that tracks itself: how far along it is, from where it
 * counts. "6,240 / 10,000 steps" from Apple Health; "18 / 30 min" in its
 * apps; "12 / 30 min" at its place. A bar fills toward the target. Nothing
 * for a habit ticked by hand.
 */
export function HabitTracking({ habit, color }: { habit: Habit; color: string }) {
    const t = useTokens();
    const progress = useTrackingProgress(habit);
    if (!progress) return null;

    const source = progress.kind === 'health' ? { icon: 'heart', label: `${progress.label} · Apple Health` }
        : progress.kind === 'app' ? { icon: 'apps', label: progress.quit ? 'Time in your apps · stay under' : 'Time in your apps' }
        : { icon: 'location', label: `At ${progress.place}` };
    const unit = progress.kind === 'health' ? progress.unit : 'min';
    const known = progress.value !== null;
    const value = progress.value ?? 0;
    const share = progress.target ? Math.min(1, value / progress.target) : 0;
    const reached = known && value >= progress.target;
    const note = progress.kind === 'health'
        ? (reached ? 'Done. Ticked from Health.' : 'Fills in as Health counts it.')
        : progress.kind === 'app'
            ? !known ? `Counting in the background. Ticks itself at ${minutesSaid(progress.target)}.`
                : progress.quit ? (reached ? 'Over for today.' : `Kept if the day ends under ${minutesSaid(progress.target)}.`)
                    : reached ? 'Done. Ticked from your apps.' : `Ticks itself at ${minutesSaid(progress.target)}.`
            : known ? (reached ? 'Done when you leave.' : `Here now. Ticks itself after ${minutesSaid(progress.target)}.`)
                : `Ticks itself after ${minutesSaid(progress.target)} there.`;

    return (
        <View>
            <SectionTitle first>Today</SectionTitle>
            <VoidCard>
                <View style={styles.body} accessible
                    accessibilityLabel={`${source.label}. ${known ? `${amount(value)} of ${amount(progress.target)} ${unit}` : 'Not counted yet'}. ${note}`}>
                    <View style={styles.head}>
                        <AppIcon name={source.icon} filled size={Spacing.lg} color={color} />
                        <Text variant="caption" tone="muted" grow numberOfLines={1}>{source.label}</Text>
                        {reached && !(progress.kind === 'app' && progress.quit) ? <AppIcon name="checkmark-circle" filled size={Spacing.lg + 2} color={color} /> : null}
                    </View>
                    <View style={styles.figure}>
                        <CountUp value={known ? amount(value) : '—'} style={[t.type.screenTitle, { color: t.color.textPrimary }]} />
                        <Text variant="body" tone="muted">{`/ ${amount(progress.target)}${unit ? ` ${unit}` : ''}`}</Text>
                    </View>
                    <View style={[styles.track, { backgroundColor: t.color.border }]}>
                        <AnimatedFill progress={share} style={[styles.fill, { backgroundColor: color }]} />
                    </View>
                    <Text variant="caption" tone="muted">{note}</Text>
                </View>
            </VoidCard>
        </View>
    );
}

const styles = StyleSheet.create({
    body: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    figure: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    track: { height: Spacing.sm, borderRadius: Radius.pill, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: Radius.pill },
});
