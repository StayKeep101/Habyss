import React, { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PopIn } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { useWeekStart } from '@/hooks/useWeekStart';
import { FontFamily, Spacing } from '@/theme/designSystem';
import type { RecordDay } from '@/lib/habitRecord';

const CELL = 16;
const GAP = 4;
const LETTERS_MONDAY = ['M', '', 'W', '', 'F', '', 'S'];
const LETTERS_SUNDAY = ['S', '', 'T', '', 'T', '', 'S'];

const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const at = (key: string) => new Date(`${key}T12:00:00`);

/**
 * Every day since the habit began, as a heat map: a column per week, a row
 * per weekday, a square per day, solid in the habit's colour where it was
 * done, faint where it was due and missed, empty on days off. The month's
 * name sits over the week it begins in. It opens on this week, and scrolls
 * back to the first.
 */
export function HabitHeatmap({ history, color, startDate, today }: { history: RecordDay[]; color: string; startDate?: string; today: string }) {
    const t = useTokens();
    const mondayFirst = useWeekStart() === 'monday';
    const scroll = useRef<ScrollView>(null);
    const byDate = useMemo(() => new Map(history.map(day => [day.date, day])), [history]);
    const weeks = useMemo(() => {
        const first = at(startDate && startDate <= today ? startDate : today);
        const lead = mondayFirst ? (first.getDay() + 6) % 7 : first.getDay();
        const start = new Date(first); start.setDate(first.getDate() - lead);
        const out: { key: string; month: string | null; days: (string | null)[] }[] = [];
        let lastMonth = -1;
        for (let week = new Date(start); keyOf(week) <= today; week.setDate(week.getDate() + 7)) {
            const days: (string | null)[] = [];
            let month: string | null = null;
            for (let i = 0; i < 7; i++) {
                const day = new Date(week); day.setDate(week.getDate() + i);
                const key = keyOf(day);
                const inside = key >= keyOf(first) && key <= today;
                days.push(inside ? key : null);
                if (inside && day.getMonth() !== lastMonth) { month = day.toLocaleDateString(undefined, { month: 'short' }); lastMonth = day.getMonth(); }
            }
            out.push({ key: keyOf(week), month, days });
        }
        return out;
    }, [startDate, today, mondayFirst]);
    const done = history.filter(day => day.completed && (!startDate || day.date >= startDate) && day.date <= today).length;

    return (
        <View style={styles.wrap} accessible accessibilityLabel={`${done} ${done === 1 ? 'day' : 'days'} done since it began`}>
            <View style={styles.letters}>
                <View style={{ height: 18 }} />
                {(mondayFirst ? LETTERS_MONDAY : LETTERS_SUNDAY).map((letter, index) => (
                    <Text key={index} style={[styles.letter, { color: t.color.textSubtle }]}>{letter}</Text>
                ))}
            </View>
            <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
                <View style={styles.grid}>
                    {weeks.map((week, column) => (
                        <View key={week.key} style={styles.column}>
                            <Text numberOfLines={1} style={[styles.month, { color: t.color.textMuted }]}>{week.month ?? ''}</Text>
                            <PopIn index={Math.min(column, 30)} style={styles.days}>
                                {week.days.map((key, row) => {
                                    if (!key) return <View key={row} style={styles.cell} />;
                                    const day = byDate.get(key);
                                    const isDone = !!day?.completed;
                                    const off = day ? !day.scheduled && !isDone : false;
                                    const isToday = key === today;
                                    return (
                                        <View key={key} style={[styles.cell, {
                                            backgroundColor: isDone ? color : off ? 'transparent' : t.color.border,
                                            opacity: day?.skipped && !isDone ? 0.4 : 1,
                                            borderWidth: isToday && !isDone ? 1.5 : 0,
                                            borderColor: color,
                                        }]} />
                                    );
                                })}
                            </PopIn>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { flexDirection: 'row', gap: Spacing.sm },
    letters: { gap: GAP },
    letter: { height: CELL, fontSize: 11, lineHeight: CELL, fontFamily: FontFamily.medium },
    grid: { flexDirection: 'row', gap: GAP },
    column: { width: CELL, gap: 2 },
    month: { height: 16, width: 40, fontSize: 11, fontFamily: FontFamily.medium },
    days: { gap: GAP },
    cell: { width: CELL, height: CELL, borderRadius: 4 },
});
