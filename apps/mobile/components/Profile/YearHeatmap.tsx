import React, { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Reveal, SectionTitle, Text } from '@/components/ui';
import { useTokens } from '@/hooks/useTokens';
import { Spacing } from '@/theme/designSystem';
import { mixHex } from '@/lib/colorContrast';

/** One square a day, and the gap between. */
const CELL = 12;
const GAP = 3;
const STEP = CELL + GAP;
const LABEL = 16;
const WEEKS = 53;
/** How full a day was, in five shades: nothing, a little, half, most, all. */
const LEVELS = [0, 0.25, 0.5, 0.75, 1];

export interface HeatDay { date: string; fill: number }

const shadeOf = (fill: number) => (fill <= 0 ? 0 : fill < 0.34 ? 1 : fill < 0.67 ? 2 : fill < 1 ? 3 : 4);
const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * A year of days, the way GitHub shows a year of work: a column a week, a
 * square a day, darker the more of the day's habits were kept. Scrolled to
 * today; months along the top; how many days were active, and a Less → More
 * key, underneath. Draws in from left to right as it opens.
 */
export function YearHeatmap({ days, color, today }: { days: HeatDay[]; color: string; today: string }) {
    const t = useTokens();
    const scroller = useRef<ScrollView>(null);
    const byDate = useMemo(() => new Map(days.map(day => [day.date, day.fill])), [days]);
    const { cells, months, active } = useMemo(() => {
        const end = new Date(`${today}T12:00:00`);
        // The grid starts on the Sunday 52 weeks before this week's.
        const start = new Date(end);
        start.setDate(start.getDate() - start.getDay() - (WEEKS - 1) * 7);
        const out: { x: number; y: number; level: number; date: string }[] = [];
        const labels: { x: number; text: string }[] = [];
        let count = 0;
        for (let week = 0; week < WEEKS; week++) {
            for (let dow = 0; dow < 7; dow++) {
                const date = new Date(start);
                date.setDate(start.getDate() + week * 7 + dow);
                if (date > end) continue;
                const key = keyOf(date);
                const fill = byDate.get(key) ?? 0;
                if (fill > 0) count += 1;
                out.push({ x: week * STEP, y: LABEL + dow * STEP, level: shadeOf(fill), date: key });
                if (date.getDate() <= 7 && dow === 0) labels.push({ x: week * STEP, text: date.toLocaleDateString(undefined, { month: 'short' }) });
            }
        }
        return { cells: out, months: labels, active: count };
    }, [byDate, today]);

    const shades = LEVELS.map((level, index) => (index === 0 ? t.color.border : mixHex(t.color.border, color, 0.25 + level * 0.75)));
    const width = WEEKS * STEP;
    const height = LABEL + 7 * STEP;
    return (
        <View style={styles.wrap}>
            <SectionTitle first>This year</SectionTitle>
            <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false}
                onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
                accessible accessibilityLabel={`${active} active days in the last year`}>
                <Reveal>
                    <Svg width={width} height={height}>
                        {months.map(month => (
                            <SvgText key={`${month.x}`} x={month.x} y={LABEL - 5} fontSize={11} fill={t.color.textMuted}>{month.text}</SvgText>
                        ))}
                        {cells.map(cell => (
                            <Rect key={cell.date} x={cell.x} y={cell.y} width={CELL} height={CELL} rx={3} fill={shades[cell.level]} />
                        ))}
                    </Svg>
                </Reveal>
            </ScrollView>
            <View style={styles.foot}>
                <Text variant="caption" tone="muted" grow>{`${active} active day${active === 1 ? '' : 's'} in the last year`}</Text>
                <Text variant="caption" tone="muted">Less</Text>
                {shades.map((shade, index) => <View key={index} style={[styles.key, { backgroundColor: shade }]} />)}
                <Text variant="caption" tone="muted">More</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.sm },
    foot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    key: { width: CELL - 2, height: CELL - 2, borderRadius: Spacing.xs - 1 },
});
