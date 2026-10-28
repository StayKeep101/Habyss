import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { GrowBar } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { FontFamily, Spacing } from '@/theme/designSystem';
import type { HabitRecord } from '@/lib/habitRecord';

const HEIGHT = 120;
const GAP = 6;

/**
 * The habit week by week (habitRecord's `weeks`): a bar for each of the last
 * twelve weeks, as tall as the share of its due days kept, this week in full
 * colour. A week with nothing due is a faint stub. The line over it says how
 * the latest week went.
 */
export function HabitTrend({ record, color }: { record: HabitRecord; color: string }) {
    const t = useTokens();
    const [width, setWidth] = useState(0);
    const weeks = record.weeks;
    const bar = width ? (width - GAP * (weeks.length - 1)) / weeks.length : 0;
    const latest = [...weeks].reverse().find(week => week.due > 0);
    const label = (from: string) => new Date(`${from}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return (
        <View style={styles.wrap}>
            <Text style={[styles.readout, { color: t.color.textPrimary }]} accessibilityLiveRegion="polite">
                {latest ? `${latest.done} of ${latest.due} kept` : 'Nothing due yet'}
                {latest ? <Text style={{ color: t.color.textMuted }}>{latest === weeks[weeks.length - 1] ? ' this week' : ` week of ${label(latest.from)}`}</Text> : null}
            </Text>
            <View onLayout={event => setWidth(Math.round(event.nativeEvent.layout.width))} style={{ height: HEIGHT }}
                accessible accessibilityLabel={`Last 12 weeks: ${weeks.map(week => (week.share === null ? 'nothing due' : `${Math.round(week.share * 100)}%`)).join(', ')}`}>
                {width ? (
                    <Svg width={width} height={HEIGHT}>
                        {weeks.map((week, index) => {
                            const x = index * (bar + GAP);
                            if (week.share === null) return <Rect key={week.from} x={x} y={HEIGHT - 4} width={bar} height={4} rx={2} fill={t.color.border} />;
                            const isNow = index === weeks.length - 1;
                            return (
                                <React.Fragment key={week.from}>
                                    <Rect x={x} y={0} width={bar} height={HEIGHT} rx={Math.min(6, bar / 2)} fill={t.color.border} opacity={0.35} />
                                    <GrowBar x={x} width={bar} floor={HEIGHT} height={Math.max(4, week.share * HEIGHT)} rx={Math.min(6, bar / 2)}
                                        fill={color} opacity={isNow ? 1 : 0.55} delay={index * 30} />
                                </React.Fragment>
                            );
                        })}
                    </Svg>
                ) : null}
            </View>
            <View style={styles.axis} importantForAccessibility="no-hide-descendants">
                <Text style={[styles.axisText, { color: t.color.textSubtle }]}>{label(weeks[0].from)}</Text>
                <Text style={[styles.axisText, { color: t.color.textSubtle }]}>This week</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
    readout: { fontSize: 15, fontFamily: FontFamily.semibold },
    axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -Spacing.xs },
    axisText: { fontSize: 12, fontFamily: FontFamily.medium },
});
