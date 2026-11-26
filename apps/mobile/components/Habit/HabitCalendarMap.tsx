import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CountUp, PopIn } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { localDateKey } from '@/lib/habitSchedule';
import { useWeekStart } from '@/hooks/useWeekStart';
import { textOn } from '@/theme/tokens';
import { habitRecord } from '@/lib/habitRecord';

interface Day { date: string; completed: boolean; skipped: boolean; scheduled: boolean }

interface Props {
    history: Day[];
    color: string;
    /** YYYY-MM-DD the habit began; the grid starts there. */
    startDate?: string;
    today: string;
    /** Page padding on each side, so the grid fills exactly the space it has. */
    inset: number;
    /** Its four numbers on top; off where the page shows them itself. */
    showStats?: boolean;
}

const MONDAY_FIRST = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SUNDAY_FIRST = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const GAP = 6;
/** At most this many weeks back, the length of the history the app keeps. */
const MAX_WEEKS = 53;

type Row =
    | { kind: 'month'; key: string; label: string }
    | { kind: 'week'; key: string; days: (string | null)[] };

const keyOf = (date: Date) => localDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12));
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);

/**
 * Every day of a habit, built up like a wall from the day it began.
 *
 * The first day sits on the bottom row, in its weekday's column; each day
 * after it goes to its right, and a new week starts a row up, on the left.
 * So the climb reads bottom to top, with this week at the top. A month's name
 * sits where the month begins. A day done is a solid square in the habit's
 * colour; a day it was due and not done is just an outline.
 */
export function HabitCalendarMap({ history, color, startDate, today, inset, showStats = true }: Props) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { width } = useWindowDimensions();
    const startsMonday = useWeekStart() === 'monday';
    const weekdays = startsMonday ? MONDAY_FIRST : SUNDAY_FIRST;
    const cell = Math.floor((width - inset * 2 - GAP * 6) / 7);
    const byDate = useMemo(() => new Map(history.map(day => [day.date, day])), [history]);

    // The same record the habit page reads (lib/habitRecord.ts).
    const record = useMemo(() => habitRecord(history, today, startDate, startsMonday), [history, today, startDate, startsMonday]);
    const stats = { streak: record.streak, best: record.best, kept: record.done, rate: record.rate };

    // Weeks from the one it began in to this one, oldest first, with a month's
    // name before the week its first day falls in; then turned over, so the
    // newest is on top and the first day at the bottom.
    const rows = useMemo<Row[]>(() => {
        const end = new Date(`${today}T12:00:00`);
        const earliest = addDays(end, -(MAX_WEEKS * 7));
        const began = startDate ? new Date(`${startDate}T12:00:00`) : earliest;
        const first = began > earliest ? began : earliest;
        const lead = startsMonday ? (first.getDay() + 6) % 7 : first.getDay();
        const out: Row[] = [];
        const label = (date: Date) => date.toLocaleDateString(undefined, { month: 'long', year: date.getFullYear() === end.getFullYear() ? undefined : 'numeric' });
        out.push({ kind: 'month', key: `m-${keyOf(first)}`, label: label(first) });
        for (let weekStart = addDays(first, -lead); weekStart <= end; weekStart = addDays(weekStart, 7)) {
            const days: (string | null)[] = [];
            let newMonth: Date | null = null;
            for (let offset = 0; offset < 7; offset++) {
                const day = addDays(weekStart, offset);
                const inRange = day >= addDays(first, 0) && day <= end && keyOf(day) >= keyOf(first);
                days.push(inRange ? keyOf(day) : null);
                if (inRange && day.getDate() === 1 && keyOf(day) !== keyOf(first)) newMonth = day;
            }
            if (newMonth) out.push({ kind: 'month', key: `m-${keyOf(newMonth)}`, label: label(newMonth) });
            out.push({ kind: 'week', key: `w-${keyOf(weekStart)}`, days });
        }
        return out.reverse();
    }, [today, startDate, startsMonday]);

    return (
        <View style={styles.wrap}>
            {showStats ? <View style={styles.stats}>
                <Stat value={String(stats.streak)} label="Streak" color={color} />
                <Stat value={String(stats.best)} label="Best" />
                <Stat value={stats.rate === null ? '—' : `${stats.rate}%`} label="Kept" />
                <Stat value={String(stats.kept)} label="Days done" />
            </View> : null}

            <View style={[styles.row, { gap: GAP }]}>
                {weekdays.map((letter, index) => (
                    <Text key={index} style={[styles.weekday, { width: cell, color: colors.textTertiary }]}>{letter}</Text>
                ))}
            </View>

            <View style={{ gap: GAP }}>
                {rows.map((row, index) => row.kind === 'month' ? (
                    <Text key={row.key} style={[styles.month, { color: colors.textPrimary }]}>{row.label}</Text>
                ) : (
                    <PopIn key={row.key} index={Math.min(index, 20)} style={[styles.row, { gap: GAP }]}>
                        {row.days.map((date, column) => {
                            if (!date) return <View key={column} style={{ width: cell, height: cell }} />;
                            const day = byDate.get(date);
                            const isToday = date === today;
                            const done = !!day?.completed;
                            const off = day?.scheduled === false && !done;
                            const skipped = !!day?.skipped && !done;
                            return (
                                <View
                                    key={date}
                                    accessible
                                    accessibilityLabel={`${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}: ${done ? 'done' : skipped ? 'skipped' : off ? 'not scheduled' : isToday ? 'not done yet' : 'not done'}`}
                                    style={[styles.cell, {
                                        width: cell, height: cell, borderRadius: Math.round(cell * 0.3),
                                        backgroundColor: done ? color : 'transparent',
                                        borderWidth: done || off ? 0 : isToday ? 2 : 1.5,
                                        borderColor: isToday ? color : colors.textTertiary,
                                        borderStyle: skipped ? 'dashed' : 'solid',
                                        opacity: off ? 0.35 : 1,
                                    }]}
                                >
                                    <Text style={[styles.dayNumber, {
                                        color: done ? textOn(color) : isToday ? color : colors.textSecondary,
                                        fontFamily: done || isToday ? FontFamily.semibold : FontFamily.regular,
                                    }]}>{Number(date.slice(8))}</Text>
                                </View>
                            );
                        })}
                    </PopIn>
                ))}
            </View>
        </View>
    );
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <View style={styles.stat}>
            <CountUp style={[styles.statValue, { color: color ?? colors.textPrimary }]} value={value} />
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: 14 },
    stats: { flexDirection: 'row', paddingVertical: 6 },
    stat: { flex: 1, alignItems: 'center', gap: 3 },
    statValue: { fontSize: 26, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
    statLabel: { fontSize: 12, fontFamily: FontFamily.regular },
    month: { fontSize: 15, fontFamily: FontFamily.bold, marginTop: 6 },
    row: { flexDirection: 'row' },
    weekday: { textAlign: 'center', fontSize: 11, fontFamily: FontFamily.semibold },
    cell: { alignItems: 'center', justifyContent: 'center' },
    dayNumber: { fontSize: 12, fontVariant: ['tabular-nums'] },
});
