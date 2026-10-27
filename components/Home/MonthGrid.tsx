import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconButton } from '@/components/ui/IconButton';
import { textOn } from '@/theme/tokens';
import { FontFamily } from '@/theme/designSystem';
import type { DayMarks } from '@/components/Home/CalendarStrip';

/** One row of days, and the rows above the days: kept here so the strip can size the sheet it opens. */
export const MONTH_ROW = 44;
export const MONTH_HEAD = 44 + 20;

const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const LETTERS_MONDAY = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const LETTERS_SUNDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** The weeks of a month, each a row of seven days or blanks. */
export function monthWeeks(month: Date, startsMonday: boolean): (Date | null)[][] {
    const first = new Date(month.getFullYear(), month.getMonth(), 1, 12);
    const lead = startsMonday ? (first.getDay() + 6) % 7 : first.getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (Date | null)[] = [
        ...Array.from({ length: lead }, () => null),
        ...Array.from({ length: days }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1, 12)),
    ];
    while (cells.length % 7) cells.push(null);
    return Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
}

/**
 * The whole month, opened by pulling the day strip down: the month's name
 * with arrows to the months either side, then every day with the same marks
 * the strip gives it (a goal's colour on its deadline, a yellow dot for a
 * task's deadline, a white one for a milestone). Tapping a day picks it.
 */
export function MonthGrid({ month, selected, today, startsMonday, marks, goalDays, colors, accent, onSelect, onMonth }: {
    month: Date;
    selected: Date;
    today: Date;
    startsMonday: boolean;
    marks: Record<string, DayMarks>;
    /** The colour of the first goal due on each day. */
    goalDays: Record<string, string>;
    colors: { textPrimary: string; textSecondary: string; textTertiary: string; warning: string; border: string };
    accent: string;
    onSelect: (date: Date) => void;
    onMonth: (delta: number) => void;
}) {
    const weeks = useMemo(() => monthWeeks(month, startsMonday), [month, startsMonday]);
    const selectedKey = keyOf(selected);
    const todayKey = keyOf(today);
    const title = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return (
        <View>
            <View style={styles.head}>
                <IconButton icon="chevron-back" label="Previous month" onPress={() => onMonth(-1)} diameter={36} size={22} color={colors.textSecondary} />
                <Text style={[styles.title, { color: colors.textPrimary }]} accessibilityRole="header">{title}</Text>
                <IconButton icon="chevron-forward" label="Next month" onPress={() => onMonth(1)} diameter={36} size={22} color={colors.textSecondary} />
            </View>
            <View style={styles.letters}>
                {(startsMonday ? LETTERS_MONDAY : LETTERS_SUNDAY).map((letter, index) => (
                    <Text key={index} style={[styles.letter, { color: colors.textTertiary }]}>{letter}</Text>
                ))}
            </View>
            {weeks.map((week, row) => (
                <View key={row} style={styles.week}>
                    {week.map((date, column) => {
                        if (!date) return <View key={column} style={styles.cell} />;
                        const key = keyOf(date);
                        const isSelected = key === selectedKey;
                        const isToday = key === todayKey;
                        const mark = marks[key];
                        const goal = goalDays[key];
                        const said = [
                            date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
                            isToday ? 'today' : null, goal ? 'a goal deadline' : null,
                            mark?.deadline ? 'a task deadline' : null, mark?.milestone ? 'a milestone due' : null,
                        ].filter(Boolean).join(', ');
                        return (
                            <Pressable key={key} style={styles.cell} onPress={() => onSelect(date)}
                                accessibilityRole="button" accessibilityState={{ selected: isSelected }} accessibilityLabel={said}>
                                <View style={[styles.disc, isSelected
                                    ? { backgroundColor: accent }
                                    : isToday ? { borderWidth: 1.5, borderColor: accent } : null]}>
                                    <Text style={[styles.number, { color: isSelected ? textOn(accent) : isToday ? accent : colors.textPrimary }]}>{date.getDate()}</Text>
                                </View>
                                <View style={styles.dots}>
                                    {goal ? <View style={[styles.dot, { backgroundColor: goal }]} /> : null}
                                    {mark?.deadline ? <View style={[styles.dot, { backgroundColor: colors.warning }]} /> : null}
                                    {mark?.milestone ? <View style={[styles.dot, { backgroundColor: colors.textPrimary }]} /> : null}
                                </View>
                            </Pressable>
                        );
                    })}
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    head: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
    title: { fontSize: 17, fontFamily: FontFamily.semibold },
    letters: { height: 20, flexDirection: 'row' },
    letter: { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: FontFamily.semibold },
    week: { height: MONTH_ROW, flexDirection: 'row' },
    cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    disc: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    number: { fontSize: 15, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    dots: { height: 4, marginTop: 2, flexDirection: 'row', gap: 2 },
    dot: { width: 4, height: 4, borderRadius: 2 },
});
