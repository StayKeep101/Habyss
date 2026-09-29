import React, { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useAnimatedReaction, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { ScrubDot, ScrubLine } from '@/components/Common/ScrubReadout';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useScrub } from '@/hooks/useScrub';
import type { GoalPoint } from '@/lib/goalInsights';

type Range = '1W' | '1M' | '3M' | 'ALL';
const RANGE_DAYS: Record<Range, number> = { '1W': 7, '1M': 30, '3M': 90, ALL: Infinity };

interface Props {
    series: GoalPoint[];
    color: string;
    height?: number;
    /** Called with the point under the finger while scrubbing, then null. */
    onScrub?: (point: GoalPoint | null) => void;
    /** A small read-only sparkline: whole range, no buttons, no scrubbing. */
    compact?: boolean;
}

/**
 * Progress drawn the way a portfolio is: the solid line is what has been
 * banked, the dashed line is where a perfectly consistent plan would be.
 *
 * Dragging reads any day out of it, and the reading is done entirely on the UI
 * thread. This used to run on React Native's responder system, which loses the
 * touch to the scroll view around it — and losing it fires a termination, which
 * cleared the crosshair. That was the line jumping back to the end while you
 * were still dragging. A pan gesture that gives vertical movement to the page
 * and keeps horizontal movement for itself does not have to fight anybody.
 */
export const GoalProgressChart: React.FC<Props> = ({ series, color, height = 170, onScrub, compact }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();
    const [width, setWidth] = useState(0);
    const [range, setRange] = useState<Range>('ALL');
    // Unique per chart: several charts on one screen must not share a gradient.
    const gradientId = React.useId().replace(/:/g, '');

    // Only offer ranges the goal is old enough to fill, plus All.
    const ranges = compact ? [] : (Object.keys(RANGE_DAYS) as Range[])
        .filter(option => option === 'ALL' || series.length > RANGE_DAYS[option]);

    const visible = useMemo(() => {
        const days = RANGE_DAYS[range];
        return Number.isFinite(days) ? series.slice(-days) : series;
    }, [series, range]);

    const geometry = useMemo(() => {
        if (width === 0 || visible.length === 0) return null;
        const values = visible.flatMap(point => [point.actual, point.pace]);
        let min = Math.min(...values);
        let max = Math.max(...values);
        // Leave room so a flat line is not glued to an edge.
        const pad = Math.max(2, (max - min) * 0.15);
        min = Math.max(0, min - pad);
        max = Math.min(100, max + pad);
        if (max - min < 4) { max = Math.min(100, min + 4); min = Math.max(0, max - 4); }

        const top = 8;
        const bottom = height - 8;
        const x = (index: number) => (visible.length === 1 ? width / 2 : (index / (visible.length - 1)) * width);
        const y = (value: number) => bottom - ((value - min) / (max - min)) * (bottom - top);

        const line = (key: 'actual' | 'pace') =>
            visible.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`).join(' ');
        const actual = line('actual');
        const area = `${actual} L${x(visible.length - 1).toFixed(1)},${height} L${x(0).toFixed(1)},${height} Z`;
        // Handed to the UI thread so the dot can ride the curve without asking
        // React where the curve is on every frame.
        const ys = visible.map(point => y(point.actual));
        return { x, y, actual, area, pace: line('pace'), ys };
    }, [visible, width, height]);

    const last = visible.length - 1;
    const dotY = useSharedValue(0);

    const report = React.useCallback((index: number | null) => {
        onScrub?.(index === null ? null : visible[index] ?? null);
    }, [onScrub, visible]);

    const scrub = useScrub({ count: compact ? 0 : visible.length, width, mode: 'points', onIndex: report });

    // The dot's height follows the same index the line does, one frame later at
    // worst, because both are read from shared values rather than from props.
    const ys = useSharedValue<number[]>([]);
    useEffect(() => { ys.set(geometry?.ys ?? []); }, [geometry, ys]);
    useEffect(() => {
        if (geometry) dotY.set(geometry.ys[last] ?? 0);
    }, [geometry, last, dotY]);

    useDotOnCurve(scrub.index, ys, dotY, geometry?.ys[last] ?? 0);

    const chart = (
        <View
            style={{ height }}
            onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
            accessible
            accessibilityRole="image"
            accessibilityLabel={visible.length
                ? `Progress chart. ${visible[last].actual}% done, pace ${visible[last].pace}%. Drag across it to read any day.`
                : 'Progress chart, no data yet.'}
        >
            {geometry ? (
                <>
                    <Svg width={width} height={height}>
                        <Defs>
                            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor={color} stopOpacity={0.28} />
                                <Stop offset="1" stopColor={color} stopOpacity={0} />
                            </LinearGradient>
                        </Defs>
                        <Path d={geometry.area} fill={`url(#${gradientId})`} />
                        <Path d={geometry.pace} stroke={colors.textTertiary} strokeWidth={1.5} strokeDasharray="4 5" fill="none" />
                        <Path d={geometry.actual} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                    </Svg>

                    {/* Over the drawing rather than inside it: a view that moves
                        by transform costs nothing per frame, where re-rendering
                        an SVG element costs a render. */}
                    {!compact ? (
                        <>
                            <ScrubLine x={scrub.x} active={scrub.active} color={colors.textTertiary} height={height} />
                            <ScrubDot x={scrub.x} y={dotY} active={scrub.active} color={color} ring={colors.background} />
                        </>
                    ) : null}

                    {/* Where the line ends, always. The scrubbing dot fades in
                        over it rather than replacing it, so the chart never has
                        a moment with no marker at all. */}
                    <View
                        pointerEvents="none"
                        style={[styles.end, {
                            left: geometry.x(last) - 5.5, top: geometry.ys[last] - 5.5,
                            backgroundColor: color, borderColor: colors.background,
                        }]}
                    />
                </>
            ) : null}
        </View>
    );

    return (
        <View>
            {compact ? chart : <GestureDetector gesture={scrub.gesture}>{chart}</GestureDetector>}

            {ranges.length > 1 ? (
                <View style={styles.ranges}>
                    {ranges.map(option => {
                        const selected = option === range;
                        return (
                            <TouchableOpacity
                                key={option}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                                onPress={() => { selectionFeedback(); setRange(option); }}
                                style={[styles.range, selected && { backgroundColor: color + '22' }]}
                            >
                                <Text style={[styles.rangeText, { color: selected ? color : colors.textTertiary }]}>{option === 'ALL' ? 'All' : option}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            ) : null}
        </View>
    );
};

/**
 * Keeps the dot on the curve.
 *
 * On the UI thread and nowhere else: the heights were handed over once, so
 * following the finger costs a lookup rather than a render. It rests at the
 * last point when nothing is being read, which is where the line ends.
 */
function useDotOnCurve(
    index: SharedValue<number>,
    ys: SharedValue<number[]>,
    dotY: SharedValue<number>,
    resting: number,
) {
    const rest = useSharedValue(resting);
    useEffect(() => { rest.set(resting); }, [resting, rest]);

    useAnimatedReaction(
        () => index.value,
        now => { dotY.set(now >= 0 ? (ys.get()[now] ?? rest.get()) : rest.get()); },
    );
}

const styles = StyleSheet.create({
    ranges: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    range: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 999 },
    rangeText: { fontSize: 12, fontFamily: FontFamily.semibold, letterSpacing: 0.4 },
    end: { position: 'absolute', width: 11, height: 11, borderRadius: 5.5, borderWidth: 2 },
});
