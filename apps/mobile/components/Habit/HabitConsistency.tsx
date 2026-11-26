import React, { useId, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { Reveal, Text } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { Spacing } from '@/theme/designSystem';

const HEIGHT = Spacing.xxl * 4;
const STROKE = Spacing.xs - 1;
/** Days that fill the width; a longer life scrolls sideways at the same scale. */
const WINDOW = 56;

export interface ConsistencySeries { id: string; name: string; color: string; points: { date: string; share: number | null }[] }

const label = (date: string, long = false) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined,
    long ? { weekday: 'short', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric' });
const pct = (share: number) => Math.round(share * 100);

/**
 * How consistent a habit has been: for each day, the share of due days kept in
 * the week ending on it, from the day it began on the left to today on the
 * right. One line per person on a shared habit, each in its own colour (one
 * line with a soft fill when it is just one). Eight weeks fill the width; a
 * longer life scrolls sideways and opens on today.
 *
 * Touch it to read a day: a tap, or a drag across it (hold first where it
 * scrolls), shows the date and each person's figure, with a dot on each line.
 */
export function HabitConsistency({ series, replay }: { series: ConsistencySeries[]; replay?: unknown }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const gradient = useId().replace(/:/g, '');
    const [width, setWidth] = useState(0);
    const [picked, setPicked] = useState<number | null>(null);
    const scroll = useRef<ScrollView>(null);
    const days = series[0]?.points.length ?? 0;
    // Eight weeks across, always: a young habit's line starts on the left and
    // grows to the right, an older one scrolls on from where it began.
    const step = width ? width / WINDOW : 0;
    const plotWidth = days > 1 ? step * (days - 1) : width;
    const scrolls = days - 1 > WINDOW;

    const x = (index: number) => index * step;
    const y = (share: number) => STROKE + (1 - share) * (HEIGHT - STROKE * 2);
    const paths = useMemo(() => series.map(item => {
        const runs: { index: number; share: number }[][] = [[]];
        item.points.forEach((point, index) => {
            if (point.share === null) { if (runs[runs.length - 1].length) runs.push([]); return; }
            runs[runs.length - 1].push({ index, share: point.share });
        });
        const drawn = runs.filter(run => run.length);
        const line = drawn.map(run => run.map((p, i) => `${i ? 'L' : 'M'}${x(p.index).toFixed(1)},${y(p.share).toFixed(1)}`).join(' ')).join(' ');
        const area = drawn.map(run => `${run.map((p, i) => `${i ? 'L' : 'M'}${x(p.index).toFixed(1)},${y(p.share).toFixed(1)}`).join(' ')} L${x(run[run.length - 1].index).toFixed(1)},${HEIGHT} L${x(run[0].index).toFixed(1)},${HEIGHT} Z`).join(' ');
        return { id: item.id, color: item.color, line, area };
        // x and y follow `step`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [series, step]);

    // Where each person stands: today, or the day under the finger.
    const at = picked ?? days - 1;
    const valueAt = (item: ConsistencySeries, index: number) => {
        for (let i = index; i >= 0; i--) { const share = item.points[i]?.share; if (share !== null && share !== undefined) return i === index ? share : null; }
        return null;
    };
    const lastKnown = (item: ConsistencySeries) => [...item.points].reverse().find(point => point.share !== null)?.share ?? null;
    const weekAgo = (item: ConsistencySeries) => [...item.points.slice(0, -7)].reverse().find(point => point.share !== null)?.share ?? null;
    const one = series.length === 1 ? series[0] : null;
    const now = one ? lastKnown(one) : null;
    const before = one ? weekAgo(one) : null;
    const delta = now !== null && before !== null ? pct(now) - pct(before) : null;

    const pick = (px: number) => {
        if (!step) return;
        const index = Math.max(0, Math.min(days - 1, Math.round(px / step)));
        setPicked(current => { if (current !== index) selectionFeedback(); return index; });
    };
    const tap = Gesture.Tap().onEnd(event => { runOnJS(pick)(event.x); });
    const drag = Gesture.Pan()
        .activateAfterLongPress(scrolls ? 180 : 0)
        .activeOffsetX(scrolls ? [-1, 1] : [-4, 4])
        .failOffsetY([-14, 14])
        .onStart(event => { runOnJS(pick)(event.x); })
        .onUpdate(event => { runOnJS(pick)(event.x); });
    const gestures = Gesture.Exclusive(drag, tap);

    const date = series[0]?.points[at]?.date;
    const spoken = series.map(item => { const share = lastKnown(item); return `${item.name} ${share === null ? 'nothing due yet' : `${pct(share)}%`}`; }).join(', ');

    return (
        <View style={styles.wrap}>
            {/* The one thing to know, or the day under the finger. */}
            <View style={styles.headline} accessibilityLiveRegion="polite">
                {picked !== null && date ? (
                    <>
                        <Text variant="bodySmall">{label(date, true)}</Text>
                        <View style={styles.values}>
                            {series.map(item => { const share = valueAt(item, at); return (
                                <View key={item.id} style={styles.value}>
                                    <View style={[styles.swatch, { backgroundColor: item.color }]} />
                                    <Text variant="bodySmall" numeric tone={share === null ? 'muted' : 'primary'}>{share === null ? '—' : `${pct(share)}%`}</Text>
                                </View>
                            ); })}
                        </View>
                    </>
                ) : one ? (
                    <>
                        <Text variant="title" numeric>{now === null ? '—' : `${pct(now)}%`}</Text>
                        <Text variant="bodySmall" tone="muted">{now === null ? 'Nothing due yet' : 'this week'}</Text>
                        {delta ? <Text variant="bodySmall" tone={delta > 0 ? 'success' : 'muted'} grow align="right">{delta > 0 ? `+${delta}` : `${delta}`}</Text> : null}
                    </>
                ) : (
                    <View style={styles.values}>
                        {series.map(item => { const share = lastKnown(item); return (
                            <View key={item.id} style={styles.value}>
                                <View style={[styles.swatch, { backgroundColor: item.color }]} />
                                <Text variant="bodySmall" tone="muted" numberOfLines={1}>{item.name}</Text>
                                <Text variant="bodySmall" numeric>{share === null ? '—' : `${pct(share)}%`}</Text>
                            </View>
                        ); })}
                    </View>
                )}
            </View>

            <View onLayout={event => setWidth(Math.round(event.nativeEvent.layout.width))} style={styles.plot}
                accessible accessibilityRole="adjustable"
                accessibilityLabel={`Consistency since ${days ? label(series[0].points[0].date) : 'it began'}, each day counting the week before it. ${spoken}.`}
                accessibilityValue={date ? { text: `${label(date, true)}: ${series.map(item => { const share = valueAt(item, at); return `${item.name} ${share === null ? 'nothing due' : `${pct(share)}%`}`; }).join(', ')}` } : undefined}
                onAccessibilityAction={event => {
                    const next = event.nativeEvent.actionName === 'increment' ? Math.min(days - 1, at + 7) : Math.max(0, at - 7);
                    setPicked(next);
                }}
                accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}>
                {width && step ? (
                    <ScrollView ref={scroll} horizontal scrollEnabled={scrolls} showsHorizontalScrollIndicator={false}>
                        <GestureDetector gesture={gestures}>
                            <View style={{ width: Math.max(width, plotWidth), height: HEIGHT }}>
                                <Reveal style={styles.plot} replay={replay}>
                                    <Svg width={Math.max(width, plotWidth)} height={HEIGHT}>
                                        <Defs>
                                            <LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                                                <Stop offset="0" stopColor={series[0]?.color ?? t.color.accent} stopOpacity={0.28} />
                                                <Stop offset="1" stopColor={series[0]?.color ?? t.color.accent} stopOpacity={0} />
                                            </LinearGradient>
                                        </Defs>
                                        {[1, 0.5].map(level => (
                                            <Line key={level} x1={0} x2={Math.max(width, plotWidth)} y1={y(level)} y2={y(level)} stroke={t.color.border} strokeWidth={1} strokeDasharray="3 5" />
                                        ))}
                                        {one ? <Path d={paths[0].area} fill={`url(#${gradient})`} /> : null}
                                        {paths.map(item => (
                                            <Path key={item.id} d={item.line} stroke={item.color} strokeWidth={STROKE} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                                        ))}
                                        {picked !== null ? (
                                            <>
                                                <Line x1={x(picked)} x2={x(picked)} y1={0} y2={HEIGHT} stroke={t.color.textSubtle} strokeWidth={1} />
                                                {series.map(item => { const share = valueAt(item, picked); return share === null ? null
                                                    : <Circle key={item.id} cx={x(picked)} cy={y(share)} r={STROKE + 2} fill={item.color} stroke={t.color.background} strokeWidth={2} />; })}
                                            </>
                                        ) : null}
                                    </Svg>
                                </Reveal>
                            </View>
                        </GestureDetector>
                    </ScrollView>
                ) : null}
            </View>
            <View style={styles.axis} importantForAccessibility="no-hide-descendants">
                <Text variant="caption" tone="muted">{days ? label(series[0].points[0].date) : ''}</Text>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
    headline: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, minHeight: Spacing.xxl },
    values: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.md, flex: 1, justifyContent: 'flex-end' },
    value: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    swatch: { width: Spacing.sm, height: Spacing.sm, borderRadius: Spacing.xs },
    plot: { height: HEIGHT },
    axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -Spacing.xs },
});
