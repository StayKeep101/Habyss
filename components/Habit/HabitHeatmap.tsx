import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PopIn } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { useWeekStart } from '@/hooks/useWeekStart';
import { useHaptics } from '@/hooks/useHaptics';
import { FontFamily, Spacing } from '@/theme/designSystem';
import type { RecordDay } from '@/lib/habitRecord';

const GAP = 4;
const LETTER_WIDTH = 14;
const LETTERS_MONDAY = ['M', '', 'W', '', 'F', '', 'S'];
const LETTERS_SUNDAY = ['S', '', 'T', '', 'T', '', 'S'];

const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const at = (key: string) => new Date(`${key}T12:00:00`);

type State = 'done' | 'missed' | 'skipped' | 'off' | 'today';
const WORD: Record<State, string> = { done: 'Done', missed: 'Missed', skipped: 'Skipped', off: 'Day off', today: 'Not done yet' };

/**
 * Every day since the habit began, as a heat map: a column a week, a row a
 * weekday, a square a day. Solid in the habit's colour where it was done, a
 * grey square where it was due and missed, faded where skipped, an outline on
 * a day off. The squares fill the width, the grid opens on this week and
 * scrolls back to the first. Tap a day to read it; the key says what each
 * square means.
 */
export function HabitHeatmap({ history, color, startDate, today }: { history: RecordDay[]; color: string; startDate?: string; today: string }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const mondayFirst = useWeekStart() === 'monday';
    const scroll = useRef<ScrollView>(null);
    const [width, setWidth] = useState(0);
    const [picked, setPicked] = useState<string | null>(null);
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

    // Squares sized to fill the width with at least 12 weeks, never tiny, never huge.
    const room = Math.max(0, width - LETTER_WIDTH - Spacing.sm);
    const cell = width ? Math.max(14, Math.min(26, Math.floor((room - GAP * 11) / 12))) : 18;
    const stateOf = (key: string): State => {
        const day = byDate.get(key);
        if (day?.completed) return 'done';
        if (day?.skipped) return 'skipped';
        if (key === today) return 'today';
        if (day && !day.scheduled) return 'off';
        return 'missed';
    };
    const done = history.filter(day => day.completed && (!startDate || day.date >= startDate) && day.date <= today).length;
    const since = startDate && startDate <= today ? at(startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : null;
    const pickedState = picked ? stateOf(picked) : null;

    const look = (state: State) => ({
        backgroundColor: state === 'done' ? color : state === 'missed' ? t.color.border : 'transparent',
        opacity: state === 'skipped' ? 0.45 : 1,
        borderWidth: state === 'done' || state === 'missed' ? 0 : 1.5,
        borderColor: state === 'today' ? color : state === 'skipped' ? color : t.color.border,
        borderStyle: state === 'skipped' ? 'dashed' as const : 'solid' as const,
    });

    return (
        <View onLayout={event => setWidth(Math.round(event.nativeEvent.layout.width))} style={styles.wrap}>
            {/* What the grid adds up to, or the day you tapped. */}
            <View style={styles.readout} accessibilityLiveRegion="polite">
                {picked && pickedState ? (
                    <>
                        <View style={[styles.swatch, look(pickedState)]} />
                        <Text style={[styles.readoutText, { color: t.color.textPrimary }]}>
                            {at(picked).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                            <Text style={{ color: t.color.textMuted }}>{`  ·  ${WORD[pickedState]}`}</Text>
                        </Text>
                    </>
                ) : (
                    <Text style={[styles.readoutText, { color: t.color.textPrimary }]}>
                        {`${done} ${done === 1 ? 'day' : 'days'} done`}
                        {since ? <Text style={{ color: t.color.textMuted }}>{` since ${since}`}</Text> : null}
                    </Text>
                )}
            </View>

            <View style={styles.body}>
                <View style={[styles.letters, { gap: GAP, width: LETTER_WIDTH }]}>
                    <View style={{ height: 18 }} />
                    {(mondayFirst ? LETTERS_MONDAY : LETTERS_SUNDAY).map((letter, index) => (
                        <Text key={index} style={[styles.letter, { height: cell, lineHeight: cell, color: t.color.textSubtle }]}>{letter}</Text>
                    ))}
                </View>
                <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator={false} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
                    <View style={[styles.grid, { gap: GAP }]}>
                        {weeks.map((week, column) => (
                            <View key={week.key} style={{ width: cell, gap: 2 }}>
                                <Text numberOfLines={1} style={[styles.month, { color: t.color.textMuted }]}>{week.month ?? ''}</Text>
                                <PopIn index={Math.min(column, 30)} style={{ gap: GAP }}>
                                    {week.days.map((key, row) => {
                                        if (!key) return <View key={row} style={{ width: cell, height: cell }} />;
                                        const state = stateOf(key);
                                        const isPicked = key === picked;
                                        return (
                                            <Pressable key={key} hitSlop={2}
                                                onPress={() => { selectionFeedback(); setPicked(isPicked ? null : key); }}
                                                accessibilityRole="button" accessibilityState={{ selected: isPicked }}
                                                accessibilityLabel={`${at(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}: ${WORD[state]}`}
                                                style={[{ width: cell, height: cell, borderRadius: Math.round(cell * 0.28) }, look(state),
                                                    isPicked && { transform: [{ scale: 1.18 }], borderWidth: 2, borderColor: t.color.textPrimary, borderStyle: 'solid' }]} />
                                        );
                                    })}
                                </PopIn>
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>

            {/* The key: what each square means, in words, not colour alone. */}
            <View style={styles.legend}>
                {(['done', 'missed', 'skipped', 'off'] as State[]).map(state => (
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
    readout: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 22 },
    readoutText: { fontSize: 15, fontFamily: FontFamily.semibold },
    body: { flexDirection: 'row', gap: Spacing.sm },
    letters: {},
    letter: { fontSize: 11, fontFamily: FontFamily.medium },
    grid: { flexDirection: 'row', paddingVertical: 2, paddingRight: 2 },
    month: { height: 16, width: 40, fontSize: 11, fontFamily: FontFamily.medium },
    legend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    swatch: { width: 12, height: 12, borderRadius: 3 },
    legendText: { fontSize: 12, fontFamily: FontFamily.medium },
});
