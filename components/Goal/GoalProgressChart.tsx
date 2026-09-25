import React, { useMemo, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useHaptics } from '@/hooks/useHaptics';
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
 * Dragging across the chart reads out any day, like a stock chart.
 */
export const GoalProgressChart: React.FC<Props> = ({ series, color, height = 170, onScrub, compact }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();
    const [width, setWidth] = useState(0);
    const [range, setRange] = useState<Range>('ALL');
    const [scrubIndex, setScrubIndex] = useState<number | null>(null);
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
        return { x, y, actual, area, pace: line('pace') };
    }, [visible, width, height]);

    const scrubTo = (event: GestureResponderEvent) => {
        if (!geometry || visible.length === 0) return;
        const ratio = Math.min(1, Math.max(0, event.nativeEvent.locationX / width));
        const index = Math.round(ratio * (visible.length - 1));
        if (index !== scrubIndex) {
            selectionFeedback();
            setScrubIndex(index);
            onScrub?.(visible[index]);
        }
    };
    const endScrub = () => { setScrubIndex(null); onScrub?.(null); };

    const last = visible.length - 1;
    const marker = scrubIndex ?? last;

    return (
        <View>
            <View
                style={{ height }}
                onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
                onStartShouldSetResponder={() => !compact}
                onMoveShouldSetResponder={() => !compact}
                onResponderTerminationRequest={() => false}
                onResponderGrant={scrubTo}
                onResponderMove={scrubTo}
                onResponderRelease={endScrub}
                onResponderTerminate={endScrub}
                accessible
                accessibilityRole="image"
                accessibilityLabel={visible.length
                    ? `Progress chart. ${visible[last].actual}% done, pace ${visible[last].pace}%.`
                    : 'Progress chart, no data yet.'}
            >
                {geometry ? (
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
                        {scrubIndex !== null ? (
                            <Line x1={geometry.x(scrubIndex)} x2={geometry.x(scrubIndex)} y1={0} y2={height} stroke={colors.textTertiary} strokeWidth={1} />
                        ) : null}
                        <Circle cx={geometry.x(marker)} cy={geometry.y(visible[marker].actual)} r={5} fill={color} stroke={colors.background} strokeWidth={2} />
                    </Svg>
                ) : null}
            </View>

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

const styles = StyleSheet.create({
    ranges: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    range: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 999 },
    rangeText: { fontSize: 12, fontFamily: FontFamily.semibold, letterSpacing: 0.4 },
});
