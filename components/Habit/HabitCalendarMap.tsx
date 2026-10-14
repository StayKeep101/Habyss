import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { CountUp, PopIn } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { localDateKey } from '@/lib/habitSchedule';

interface Day { date: string; completed: boolean; skipped: boolean; scheduled: boolean }

interface Props {
    history: Day[];
    color: string;
    /** YYYY-MM-DD the habit began; nothing before it is drawn. */
    startDate?: string;
    today: string;
    /** Page padding on each side, so the grid fills exactly the space it has. */
    inset: number;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const GAP = 6;

/**
 * Every day of a habit as a calendar you can actually read.
 *
 * The year strip it replaces drew twelve-point squares in a sideways scroll:
 * a year of effort the size of a postage stamp. This gives each month its own
 * block of full-width squares, newest first, so this month — the one you can
 * still change — is the first thing you see, with the four numbers that sum it
 * up above it.
 */
export function HabitCalendarMap({ history, color, startDate, today, inset }: Props) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const light = theme === 'light';
    const { width } = useWindowDimensions();
    const cell = Math.floor((width - inset * 2 - 32 - GAP * 6) / 7);
    const byDate = useMemo(() => new Map(history.map(day => [day.date, day])), [history]);

    const stats = useMemo(() => {
        const sorted = [...history].filter(day => (!startDate || day.date >= startDate) && day.date <= today)
            .sort((a, b) => a.date.localeCompare(b.date));
        let best = 0; let run = 0; let due = 0; let kept = 0;
        for (const day of sorted) {
            if (day.completed) kept++;
            if (!day.scheduled || day.skipped) continue;
            if (day.date === today && !day.completed) continue;
            due++;
            run = day.completed ? run + 1 : 0;
            best = Math.max(best, run);
        }
        return { streak: run, best, kept, rate: due ? Math.round((sorted.filter(day => day.completed && day.scheduled).length / due) * 100) : null };
    }, [history, startDate, today]);

    // Months from the habit's start (at most a year back) to this one, newest first.
    const months = useMemo(() => {
        const end = new Date(`${today}T12:00:00`);
        const earliest = new Date(end.getFullYear(), end.getMonth() - 11, 1);
        const begin = startDate ? new Date(`${startDate}T12:00:00`) : earliest;
        const from = begin > earliest ? new Date(begin.getFullYear(), begin.getMonth(), 1) : earliest;
        const out: { key: string; label: string; cells: (string | null)[] }[] = [];
        for (let cursor = new Date(end.getFullYear(), end.getMonth(), 1); cursor >= from; cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)) {
            const first = new Date(cursor);
            const lead = (first.getDay() + 6) % 7; // Monday first
            const length = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
            const cells: (string | null)[] = Array.from({ length: lead }, () => null);
            for (let day = 1; day <= length; day++) cells.push(localDateKey(new Date(first.getFullYear(), first.getMonth(), day, 12)));
            out.push({
                key: `${first.getFullYear()}-${first.getMonth()}`,
                label: first.toLocaleDateString(undefined, { month: 'long', year: first.getFullYear() === end.getFullYear() ? undefined : 'numeric' }),
                cells,
            });
        }
        return out;
    }, [today, startDate]);

    const tile = light ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)';

    return (
        <View style={styles.wrap}>
            <View style={styles.stats}>
                <Stat value={String(stats.streak)} label="Streak" color={color} />
                <Stat value={String(stats.best)} label="Best" />
                <Stat value={stats.rate === null ? '—' : `${stats.rate}%`} label="Kept" />
                <Stat value={String(stats.kept)} label="Days done" />
            </View>

            {months.map((month, monthIndex) => {
                const done = month.cells.filter(date => date && byDate.get(date)?.completed).length;
                return (
                    <PopIn key={month.key} index={monthIndex * 4} style={[styles.month, { backgroundColor: tile }]}>
                        <View style={styles.monthHead}>
                            <Text style={[styles.monthLabel, { color: colors.textPrimary }]}>{month.label}</Text>
                            <CountUp style={[styles.monthCount, { color: done ? color : colors.textTertiary }]} value={done ? `${done} done` : '—'} />
                        </View>
                        <View style={[styles.grid, { gap: GAP }]}>
                            {WEEKDAYS.map((label, index) => (
                                <Text key={`h${index}`} style={[styles.weekday, { width: cell, color: colors.textTertiary }]}>{label}</Text>
                            ))}
                            {month.cells.map((date, index) => {
                                if (!date) return <View key={`e${index}`} style={{ width: cell, height: cell }} />;
                                const day = byDate.get(date);
                                const future = date > today;
                                const before = !!startDate && date < startDate;
                                const isToday = date === today;
                                const doneDay = !!day?.completed;
                                const missed = !future && !before && !doneDay && !day?.skipped && day?.scheduled !== false && date !== today;
                                const off = !future && !before && day?.scheduled === false;
                                return (
                                    <View
                                        key={date}
                                        accessible
                                        accessibilityLabel={`${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}: ${doneDay ? 'done' : day?.skipped ? 'skipped' : off ? 'not scheduled' : missed ? 'missed' : future ? 'upcoming' : 'not done yet'}`}
                                        style={[styles.cell, {
                                            width: cell, height: cell, borderRadius: Math.round(cell * 0.3),
                                            backgroundColor: doneDay ? color : missed ? (light ? 'rgba(15,23,42,0.09)' : 'rgba(255,255,255,0.08)') : 'transparent',
                                            borderWidth: isToday ? 2 : day?.skipped ? 1.2 : 0,
                                            borderColor: isToday ? color : colors.textTertiary,
                                            borderStyle: day?.skipped && !isToday ? 'dashed' : 'solid',
                                            opacity: future || before ? 0.25 : off ? 0.4 : 1,
                                        }]}
                                    >
                                        <Text style={[styles.dayNumber, {
                                            color: doneDay ? '#FFFFFF' : isToday ? color : colors.textSecondary,
                                            fontFamily: doneDay || isToday ? FontFamily.semibold : FontFamily.regular,
                                        }]}>{Number(date.slice(8))}</Text>
                                    </View>
                                );
                            })}
                        </View>
                    </PopIn>
                );
            })}

            <View style={styles.legend}>
                <Legend swatch={<View style={[styles.swatch, { backgroundColor: color }]} />} label="Done" />
                <Legend swatch={<View style={[styles.swatch, { backgroundColor: light ? 'rgba(15,23,42,0.09)' : 'rgba(255,255,255,0.08)' }]} />} label="Missed" />
                <Legend swatch={<View style={[styles.swatch, { borderWidth: 1.2, borderStyle: 'dashed', borderColor: colors.textTertiary }]} />} label="Skipped" />
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
            <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label.toUpperCase()}</Text>
        </View>
    );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
    const { theme } = useTheme();
    return (
        <View style={styles.legendItem}>
            {swatch}
            <Text style={[styles.legendText, { color: Colors[theme].textTertiary }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: 14 },
    stats: { flexDirection: 'row', paddingVertical: 6 },
    stat: { flex: 1, alignItems: 'center', gap: 3 },
    statValue: { fontSize: 26, fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
    statLabel: { fontSize: 10, letterSpacing: 1.2, fontFamily: FontFamily.semibold },
    month: { borderRadius: 22, padding: 16 },
    monthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
    monthLabel: { fontSize: 16, fontFamily: FontFamily.bold },
    monthCount: { fontSize: 12, fontFamily: FontFamily.semibold },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    weekday: { textAlign: 'center', fontSize: 10, fontFamily: FontFamily.semibold, marginBottom: 2 },
    cell: { alignItems: 'center', justifyContent: 'center' },
    dayNumber: { fontSize: 12, fontVariant: ['tabular-nums'] },
    legend: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 4 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatch: { width: 12, height: 12, borderRadius: 4 },
    legendText: { fontSize: 11, fontFamily: FontFamily.medium },
});
