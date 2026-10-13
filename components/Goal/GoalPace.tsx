import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import type { GoalMeasure } from '@/lib/goalInsights';

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 1 : 0 });

/** An amount in the goal's own terms: hours for time, the unit otherwise. */
export function goalAmount(measure: Pick<GoalMeasure, 'kind' | 'unit'>, amount: number): string {
    if (measure.kind === 'time') return amount < 60 ? `${fmt(amount)} min` : `${fmt(amount / 60)} h`;
    return fmt(amount);
}

/** "750 / 2000 calls", "12 / 100 h", "34 / 73 tasks". */
export function goalFraction(measure: GoalMeasure): { done: string; total: string; unit: string } {
    if (measure.kind === 'time') {
        return { done: fmt(measure.done / 60), total: fmt(measure.total / 60), unit: 'h' };
    }
    return { done: fmt(measure.done), total: fmt(measure.total), unit: measure.unit === 'sessions' ? '' : measure.unit };
}

/** What every remaining day now asks, in words. */
export function paceLine(measure: GoalMeasure): string | null {
    if (measure.remaining <= 0) return 'Target reached';
    if (measure.perDay === null || !measure.daysLeft) return measure.daysLeft === 0 ? 'The deadline has passed' : null;
    const unit = measure.kind === 'time' ? '' : measure.unit === 'sessions' ? '' : ` ${measure.unit}`;
    const perDay = measure.kind === 'time' ? goalAmount(measure, measure.perDay) : `${Math.ceil(measure.perDay)}${unit}`;
    return `${perDay} a day to finish on time`;
}

/**
 * The goal's one number, and what it asks of today.
 *
 * "133 / 2000 calls · 69 a day" is the whole goal in a line. The daily figure is
 * what was left this morning spread over the days that remain, so missing a day
 * raises it, and doing extra lowers it.
 */
export const GoalPace: React.FC<{ measure: GoalMeasure; color: string }> = ({ measure, color }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { done, total, unit } = goalFraction(measure);
    const share = measure.total > 0 ? Math.min(1, measure.done / measure.total) : 0;
    const pace = paceLine(measure);
    const leftToday = measure.leftToday !== null && measure.remaining > 0
        ? (measure.leftToday <= 0 ? 'Today is covered' : `${goalAmount(measure, Math.ceil(measure.leftToday))} left today`)
        : null;

    return (
        <View
            accessible
            accessibilityLabel={`${done} of ${total} ${unit}. ${pace ?? ''}. ${leftToday ?? ''}`}
            style={[styles.card, { backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)', borderColor: colors.border }]}
        >
            <View style={styles.top}>
                <Text style={[styles.done, { color: colors.textPrimary }]}>{done}</Text>
                <Text style={[styles.total, { color: colors.textTertiary }]}> / {total}{unit ? ` ${unit}` : ''}</Text>
                <View style={{ flex: 1 }} />
                <Text style={[styles.percent, { color }]}>{Math.round(share * 100)}%</Text>
            </View>
            <View style={[styles.track, { backgroundColor: color + '22' }]}>
                <View style={[styles.fill, { width: `${share * 100}%`, backgroundColor: color }]} />
            </View>
            {pace || leftToday ? (
                <View style={styles.bottom}>
                    {pace ? <Text style={[styles.pace, { color: colors.textSecondary }]}>{pace}</Text> : null}
                    {leftToday ? <Text style={[styles.today, { color }]}>{leftToday}</Text> : null}
                </View>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    card: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
    top: { flexDirection: 'row', alignItems: 'baseline' },
    done: { fontSize: 30, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
    total: { fontSize: 15, fontFamily: FontFamily.medium, fontVariant: ['tabular-nums'] },
    percent: { fontSize: 15, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
    track: { height: 6, borderRadius: 3, overflow: 'hidden' },
    fill: { height: 6, borderRadius: 3 },
    bottom: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
    pace: { fontSize: 13, fontFamily: FontFamily.medium },
    today: { fontSize: 13, fontFamily: FontFamily.semibold },
});
