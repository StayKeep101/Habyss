import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PopIn } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { useWeekStart } from '@/hooks/useWeekStart';
import { useHaptics } from '@/hooks/useHaptics';
import { FontFamily, Spacing } from '@/theme/designSystem';
import type { RecordDay } from '@/lib/habitRecord';

/** Always this many weeks, so the grid is the same clean block for a new habit and an old one. */
const WEEKS = 17;
const GAP = 3;
const LETTER_WIDTH = 14;

const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const at = (key: string) => new Date(`${key}T12:00:00`);

type State = 'done' | 'missed' | 'skipped' | 'off' | 'today' | 'none';
const WORD: Record<State, string> = { done: 'Done', missed: 'Missed', skipped: 'Skipped', off: 'Day off', today: 'Not done yet', none: 'Not started' };

/**
 * The last seventeen weeks of a habit, as a heat map: a column a week, a row a
 * weekday, a small square a day, filling the width. Done is the habit's
 * colour, missed a quiet grey, a day off or skipped barely there, and days
 * before it began or still to come only a faint outline of the grid. Tap a
 * day to read it.
 */
export function HabitHeatmap({ history, color, startDate, today }: { history: RecordDay[]; color: string; startDate?: string; today: string }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const mondayFirst = useWeekStart() === 'monday';
    const [width, setWidth] = useState(0);
    const [picked, setPicked] = useState<string | null>(null);
    const byDate = useMemo(() => new Map(history.map(day => [day.date, day])), [history]);

    const weeks = useMemo(() => {
        const now = at(today);
        const lead = mondayFirst ? (now.getDay() + 6) % 7 : now.getDay();
        const first = new Date(now); first.setDate(now.getDate() - lead - (WEEKS - 1) * 7);
        let lastMonth = -1;
        return Array.from({ length: WEEKS }, (_, column) => {
            const start = new Date(first); start.setDate(first.getDate() + column * 7);
            const month = start.getMonth() !== lastMonth ? start.toLocaleDateString(undefined, { month: 'short' }) : null;
            lastMonth = start.getMonth();
            const days = Array.from({ length: 7 }, (_, row) => { const day = new Date(start); day.setDate(start.getDate() + row); return keyOf(day); });
            return { key: keyOf(start), month, days };
        });
    }, [today, mondayFirst]);

    const stateOf = (key: string): State => {
        if (key > today || (startDate && key < startDate)) return 'none';
        const day = byDate.get(key);
        if (day?.completed) return 'done';
        if (day?.skipped) return 'skipped';
        if (key === today) return 'today';
        if (day && !day.scheduled) return 'off';
        return 'missed';
    };
    const look = (state: State) => ({
        backgroundColor: state === 'done' ? color : state === 'missed' ? t.color.border : 'transparent',
        borderWidth: state === 'done' || state === 'missed' ? 0 : StyleSheet.hairlineWidth * 2,
        borderColor: state === 'today' ? color : t.color.border,
        opacity: state === 'none' ? 0.35 : state === 'off' || state === 'skipped' ? 0.6 : 1,
    });

    const cell = width ? Math.floor((width - LETTER_WIDTH - Spacing.xs - GAP * (WEEKS - 1)) / WEEKS) : 14;
    const done = history.filter(day => day.completed && (!startDate || day.date >= startDate) && day.date <= today).length;
    const pickedState = picked ? stateOf(picked) : null;
    const letters = mondayFirst ? ['M', '', 'W', '', 'F', '', ''] : ['', 'M', '', 'W', '', 'F', ''];

    return (
        <View onLayout={event => setWidth(Math.round(event.nativeEvent.layout.width))} style={styles.wrap}>
            <Text style={[styles.readout, { color: t.color.textPrimary }]} accessibilityLiveRegion="polite">
                {picked && pickedState
                    ? <>{at(picked).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}<Text style={{ color: t.color.textMuted }}>{`  ·  ${WORD[pickedState]}`}</Text></>
                    : <>{`${done} ${done === 1 ? 'day' : 'days'} done`}<Text style={{ color: t.color.textMuted }}> in all</Text></>}
            </Text>

            <View style={styles.body}>
                <View style={{ width: LETTER_WIDTH, gap: GAP, marginTop: 16 }}>
                    {letters.map((letter, index) => (
                        <Text key={index} style={[styles.letter, { height: cell, lineHeight: cell, color: t.color.textSubtle }]}>{letter}</Text>
                    ))}
                </View>
                <View style={[styles.grid, { gap: GAP }]}>
                    {weeks.map((week, column) => (
                        <View key={week.key} style={{ width: cell }}>
                            <Text numberOfLines={1} style={[styles.month, { color: t.color.textMuted }]}>{week.month ?? ''}</Text>
                            <PopIn index={column} style={{ gap: GAP }}>
                                {week.days.map(key => {
                                    const state = stateOf(key);
                                    const isPicked = key === picked;
                                    return (
                                        <Pressable key={key} hitSlop={2} disabled={state === 'none'}
                                            onPress={() => { selectionFeedback(); setPicked(isPicked ? null : key); }}
                                            accessibilityRole="button" accessibilityState={{ selected: isPicked }}
                                            accessibilityLabel={`${at(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}: ${WORD[state]}`}
                                            style={[{ width: cell, height: cell, borderRadius: Math.max(2, Math.round(cell * 0.25)) }, look(state),
                                                isPicked && { borderWidth: 1.5, borderColor: t.color.textPrimary, opacity: 1 }]} />
                                    );
                                })}
                            </PopIn>
                        </View>
                    ))}
                </View>
            </View>

            <View style={styles.legend}>
                {(['done', 'missed'] as State[]).map(state => (
                    <View key={state} style={styles.legendItem}>
                        <View style={[styles.swatch, look(state)]} />
                        <Text style={[styles.legendText, { color: t.color.textMuted }]}>{WORD[state]}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.md },
    readout: { fontSize: 15, fontFamily: FontFamily.semibold },
    body: { flexDirection: 'row', gap: Spacing.xs },
    letter: { fontSize: 11, fontFamily: FontFamily.medium },
    grid: { flexDirection: 'row' },
    month: { height: 16, width: 40, fontSize: 11, fontFamily: FontFamily.medium },
    legend: { flexDirection: 'row', gap: Spacing.lg },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatch: { width: 12, height: 12, borderRadius: 3 },
    legendText: { fontSize: 12, fontFamily: FontFamily.medium },
});
