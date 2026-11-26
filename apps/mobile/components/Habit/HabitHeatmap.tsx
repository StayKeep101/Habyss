import React, { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PopIn } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { useWeekStart } from '@/hooks/useWeekStart';
import { useHaptics } from '@/hooks/useHaptics';
import { FontFamily, Spacing } from '@/theme/designSystem';
import type { RecordDay } from '@/lib/habitRecord';

/** At least this many weeks, filling the width; an older habit's grid goes on to the left, scrolled. */
const WEEKS = 17;
const GAP = 3;
const LETTER_WIDTH = 14;

const keyOf = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const at = (key: string) => new Date(`${key}T12:00:00`);

type State = 'done' | 'missed' | 'skipped' | 'off' | 'today' | 'none';
const WORD: Record<State, string> = { done: 'Done', missed: 'Missed', skipped: 'Skipped', off: 'Day off', today: 'Not done yet', none: 'Not started' };

/**
 * A habit's weeks as a heat map, from the week it began on the left to this
 * week on the right: a column a week, a row a weekday, a small square a day,
 * seventeen weeks filling the width. Older than that, the grid scrolls
 * sideways and opens on today. With several people (a shared habit, all of
 * you together), a day is shaded by how many of you did it. Done is the habit's
 * colour, missed a quiet grey, a day off or skipped barely there, and days
 * before it began or still to come only a faint outline of the grid. Tap a
 * day to read it.
 */
export function HabitHeatmap({ history, color, startDate, from, today, replay }: {
    history: RecordDay[]; color: string; startDate?: string;
    /** The first week shown, on the left: the week the habit was made. */
    from?: string;
    today: string; replay?: unknown;
}) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const mondayFirst = useWeekStart() === 'monday';
    const [width, setWidth] = useState(0);
    const [picked, setPicked] = useState<string | null>(null);
    const byDate = useMemo(() => new Map(history.map(day => [day.date, day])), [history]);

    const scroll = useRef<ScrollView>(null);
    const weeks = useMemo(() => {
        const now = at(today);
        const lead = mondayFirst ? (now.getDay() + 6) % 7 : now.getDay();
        const thisWeek = new Date(now); thisWeek.setDate(now.getDate() - lead);
        // The week it was made is the first column, on the left; a young habit
        // has the weeks still to come after it, an old one goes on to today.
        const origin = at(from ?? startDate ?? today);
        const originLead = mondayFirst ? (origin.getDay() + 6) % 7 : origin.getDay();
        const first = new Date(origin); first.setDate(origin.getDate() - originLead);
        const lived = Math.round((thisWeek.getTime() - first.getTime()) / (7 * 86_400_000)) + 1;
        const count = Math.max(WEEKS, Math.min(lived, 52 * 10));
        let lastMonth = -1;
        return Array.from({ length: count }, (_, column) => {
            const start = new Date(first); start.setDate(first.getDate() + column * 7);
            const month = start.getMonth() !== lastMonth ? start.toLocaleDateString(undefined, { month: 'short' }) : null;
            lastMonth = start.getMonth();
            const days = Array.from({ length: 7 }, (_, row) => { const day = new Date(start); day.setDate(start.getDate() + row); return keyOf(day); });
            return { key: keyOf(start), month, days };
        });
    }, [today, mondayFirst, startDate, from]);

    const stateOf = (key: string): State => {
        if (key > today || (startDate && key < startDate)) return 'none';
        const day = byDate.get(key);
        if (day?.completed) return 'done';
        if (day?.skipped) return 'skipped';
        if (key === today) return 'today';
        if (day && !day.scheduled) return 'off';
        return 'missed';
    };
    const look = (state: State, share?: number) => ({
        // Together: a day some of you did is the colour at their share.
        backgroundColor: state === 'done' || (share !== undefined && share > 0 && state !== 'none') ? color : state === 'missed' ? t.color.border : 'transparent',
        ...(share !== undefined && share > 0 && share < 1 && state !== 'none' ? { opacity: 0.3 + share * 0.6, borderWidth: 0 } : null),
        borderWidth: state === 'done' || state === 'missed' ? 0 : StyleSheet.hairlineWidth * 2,
        borderColor: state === 'today' ? color : t.color.border,
        opacity: state === 'none' ? 0.35 : state === 'off' || state === 'skipped' ? 0.6 : 1,
    });

    const cell = width ? Math.floor((width - LETTER_WIDTH - Spacing.xs - GAP * (WEEKS - 1)) / WEEKS) : 14;
    const scrolls = weeks.length > WEEKS;
    const done = history.filter(day => day.completed && (!startDate || day.date >= startDate) && day.date <= today).length;
    const pickedState = picked ? stateOf(picked) : null;
    const letters = mondayFirst ? ['M', '', 'W', '', 'F', '', ''] : ['', 'M', '', 'W', '', 'F', ''];

    return (
        <View onLayout={event => setWidth(Math.round(event.nativeEvent.layout.width))} style={styles.wrap}>
            <Text style={[styles.readout, { color: t.color.textPrimary }]} accessibilityLiveRegion="polite">
                {picked && pickedState
                    ? <>{at(picked).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}<Text style={{ color: t.color.textMuted }}>{`  ·  ${(() => { const share = byDate.get(picked)?.share; return share !== undefined && share > 0 && share < 1 ? `${Math.round(share * 100)}% of you` : WORD[pickedState]; })()}`}</Text></>
                    : <>{`${done} ${done === 1 ? 'day' : 'days'} done`}<Text style={{ color: t.color.textMuted }}> in all</Text></>}
            </Text>

            <View style={styles.body}>
                <View style={{ width: LETTER_WIDTH, gap: GAP, marginTop: 16 }}>
                    {letters.map((letter, index) => (
                        <Text key={index} style={[styles.letter, { height: cell, lineHeight: cell, color: t.color.textSubtle }]}>{letter}</Text>
                    ))}
                </View>
                <ScrollView ref={scroll} horizontal scrollEnabled={scrolls} showsHorizontalScrollIndicator={false}>
                <View key={String(replay ?? '')} style={[styles.grid, { gap: GAP }]}>
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
                                            style={[{ width: cell, height: cell, borderRadius: Math.max(2, Math.round(cell * 0.25)) }, look(state, byDate.get(key)?.share),
                                                isPicked && { borderWidth: 1.5, borderColor: t.color.textPrimary, opacity: 1 }]} />
                                    );
                                })}
                            </PopIn>
                        </View>
                    ))}
                </View>
                </ScrollView>
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
