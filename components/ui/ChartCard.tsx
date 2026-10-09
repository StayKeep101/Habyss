import React from 'react';
import { View } from 'react-native';
import { GoalProgressChart } from '@/components/Goal/GoalProgressChart';
import type { GoalPoint } from '@/lib/goalInsights';
import { useTokens } from '@/hooks/useTokens';
import { Text } from './Text';

export interface ChartCardProps {
    /** The headline the chart explains: "62%", "1,240". */
    value: string;
    /** What the value is: "done overall", "Marks". */
    caption: string;
    series: GoalPoint[];
    /** A running total rather than a percentage (no pace line). */
    unbounded?: boolean;
    /** Names for the two lines; only shown when the chart has a pace line. */
    legend?: { actual: string; pace: string };
    onScrub?: (point: GoalPoint | null) => void;
    color?: string;
}

/** A finance-style chart with its headline above and its legend below. */
export function ChartCard({ value, caption, series, unbounded, legend, onScrub, color }: ChartCardProps) {
    const t = useTokens();
    const line = color ?? t.color.accent;
    return (
        <View style={{ gap: t.space.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: t.space.sm }}>
                <Text variant="display" numeric>{value}</Text>
                <Text variant="body" tone="muted">{caption}</Text>
            </View>
            {series.length > 1 ? <GoalProgressChart series={series} color={line} unbounded={unbounded} onScrub={onScrub} label={caption} /> : null}
            {legend && !unbounded && series.length > 1 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
                    <View style={{ width: t.space.lg, height: t.space.xs / 2 + 1 / 2, borderRadius: t.radius.sm, backgroundColor: line }} />
                    <Text variant="caption" tone="muted">{legend.actual}</Text>
                    <View style={{ width: t.space.lg, borderTopWidth: 1, borderStyle: 'dashed', borderColor: t.color.textMuted, marginLeft: t.space.sm }} />
                    <Text variant="caption" tone="muted">{legend.pace}</Text>
                </View>
            ) : null}
        </View>
    );
}
