import React, { useState } from 'react';
import Animated, { Easing, LinearTransition, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { textOn } from '@/theme/tokens';
import { IconButton } from '@/components/ui/IconButton';
import { MatteInput } from '@/components/ui/MatteInput';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { localDateKey } from '@/lib/habitSchedule';
import { usePanelRoom } from '@/components/Create/DetailBar';

/** Timed, never sprung: a sprung height overshoots and the grid bounces. */
const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));
const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`;
/** A day's row height on a phone with room; smaller phones get a shorter row so six weeks still fit. */
const CELL = 36;
const MIN_CELL = 26;
/** The month title and weekday letters above the grid. */
const CALENDAR_HEAD = 64;

const firstOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1, 12);
const shiftMonth = (date: Date, delta: number) => new Date(date.getFullYear(), date.getMonth() + delta, 1, 12);
const monthRows = (date: Date) => Math.ceil(((date.getDay() + 6) % 7 + new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()) / 7);

export function DateCalendar({ value, onChange, accent, allowPast = false, showToday = true, reserve = 0 }: {
    allowPast?: boolean;
    /** Height other controls take in the same panel, so the grid leaves room for them. */
    reserve?: number;
    /** Off where the surrounding sheet already has a Today button. */
    showToday?: boolean;
    value?: string; onChange: (date: string) => void; accent: string;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();
    const today = localDateKey(new Date());
    // Sized to the panel: six rows always fit, without scrolling, on any phone.
    const room = usePanelRoom();
    const cell = Math.max(MIN_CELL, Math.min(CELL, Math.floor((room - reserve - CALENDAR_HEAD) / 6)));
    const disc = Math.min(32, cell - 4);
    const thisMonth = firstOfMonth(new Date());
    const minimumMonth = allowPast ? new Date(1900, 0, 1, 12) : thisMonth;
    const [month, setMonth] = useState(() => firstOfMonth(new Date(`${value ?? today}T12:00:00`)));
    const [jump, setJump] = useState(false);
    const [year, setYear] = useState(String(month.getFullYear()));
    const canGoBack = month > minimumMonth;
    const showMonth = (next: Date) => {
        selectionFeedback();
        setMonth(next < minimumMonth ? minimumMonth : next);
    };
    // Swipe left for the next month, right for the one before: the grid follows
    // the finger, slides out, and the new month slides in from the other side.
    const [width, setWidth] = useState(0);
    const slide = useSharedValue(0);
    const step = (direction: 1 | -1) => {
        if (direction === -1 && !canGoBack) return;
        showMonth(shiftMonth(month, direction));
        slide.value = direction * (width || 320);
        slide.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    };
    const swipe = Gesture.Pan()
        .activeOffsetX([-14, 14])
        .failOffsetY([-12, 12])
        .onUpdate(event => {
            const blocked = event.translationX > 0 && !canGoBack;
            slide.value = blocked ? event.translationX * 0.2 : event.translationX;
        })
        .onEnd(event => {
            const go = event.translationX < -50 || event.velocityX < -500 ? 1
                : (event.translationX > 50 || event.velocityX > 500) && canGoBack ? -1 : 0;
            if (!go) { slide.value = withSpring(0, { damping: 20, stiffness: 240 }); return; }
            slide.value = withTiming(-go * (width || 320), { duration: 140 }, done => { if (done) runOnJS(step)(go as 1 | -1); });
        });
    const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateX: slide.value }] }));
    const validYear = /^\d{4}$/.test(year) && Number(year) >= minimumMonth.getFullYear() && Number(year) <= 9999;

    const days = (page: Date) => {
        const offset = (page.getDay() + 6) % 7;
        const count = new Date(page.getFullYear(), page.getMonth() + 1, 0).getDate();
        return <View style={styles.grid}>
            {Array.from({ length: monthRows(page) * 7 }, (_, index) => {
                const day = index - offset + 1;
                if (day < 1 || day > count) return <View key={index} style={[styles.cell, { height: cell }]} />;
                const date = localDateKey(new Date(page.getFullYear(), page.getMonth(), day, 12));
                const selected = date === value;
                const disabled = !allowPast && date < today;
                return <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Choose ${date}`}
                    accessibilityState={{ selected, disabled }} disabled={disabled}
                    onPress={() => { selectionFeedback(); onChange(date); }} style={[styles.cell, { height: cell }]}>
                    {/* The chosen day is a solid disc of the colour; today is just
                        a little bolder, with no ring around it. */}
                    <View style={[styles.day, { width: disc, height: disc, borderRadius: disc * 0.375, backgroundColor: selected ? accent : 'transparent', borderColor: 'transparent' }]}>
                        <Text style={[styles.dayText, { color: selected ? textOn(accent) : disabled ? colors.textTertiary : colors.textPrimary },
                            date === today && !selected && { fontFamily: FontFamily.bold }]}>{day}</Text>
                    </View>
                </Pressable>;
            })}
        </View>;
    };

    return <View testID="date-calendar" style={styles.calendar}>
        <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose month and year" accessibilityState={{ expanded: jump }}
                onPress={() => { setYear(String(month.getFullYear())); setJump(!jump); }} style={styles.monthButton}>
                <Text style={[styles.month, { color: colors.textPrimary }]}>
                    {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </Text>
                <AppIcon name={jump ? 'chevron-up' : 'chevron-down'} size={14} color={accent} />
            </Pressable>
            {showToday && !jump && monthKey(month) !== monthKey(thisMonth) ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Go to current month" onPress={() => showMonth(thisMonth)} style={styles.today}>
                    <Text style={[styles.hint, { color: accent }]}>Today</Text>
                </Pressable>
            ) : null}
        </View>
        {jump ? <View style={styles.jump}>
            <View style={styles.yearRow}>
                <IconButton icon="chevron-back" label="Previous year" onPress={() => setYear(String(Number(year) - 1))} diameter={36} size={18} color={accent} disabled={!validYear || Number(year) <= minimumMonth.getFullYear()} />
                <MatteInput accessibilityLabel="Calendar year" value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4}
                    style={[styles.year, { color: colors.textPrimary, borderColor: colors.border }]} />
                <IconButton icon="chevron-forward" label="Next year" onPress={() => setYear(String(Number(year) + 1))} diameter={36} size={18} color={accent} disabled={!validYear || Number(year) >= 9999} />
            </View>
            <View style={styles.months}>
                {Array.from({ length: 12 }, (_, index) => {
                    const date = new Date(Number(year), index, 1, 12);
                    const disabled = !validYear || date < minimumMonth;
                    const selected = Number(year) === month.getFullYear() && index === month.getMonth();
                    const label = new Date(2026, index, 1).toLocaleDateString(undefined, { month: 'short' });
                    return <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Show ${label} ${year}`}
                        accessibilityState={{ selected, disabled }} disabled={disabled}
                        onPress={() => { showMonth(date); setJump(false); }}
                        style={[styles.monthChoice, { backgroundColor: selected ? accent : colors.background }]}>
                        <Text style={[styles.dayText, { color: disabled ? colors.textTertiary : selected ? textOn(accent) : colors.textPrimary }]}>{label}</Text>
                    </Pressable>;
                })}
            </View>
            {!validYear ? <Text style={[styles.hint, { color: colors.textSecondary }]}>Not a valid year</Text> : null}
        </View> : <>
            <View style={styles.grid}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) =>
                    <Text key={index} style={[styles.weekday, { color: colors.textTertiary }]}>{day}</Text>)}
            </View>
            {/* One month at a time, swiped left and right. The grid morphs to
                the new month's height so a 5-row month does not jolt into a
                6-row one. */}
            <GestureDetector gesture={swipe}>
                <Animated.View
                    testID="calendar-viewport"
                    accessible
                    accessibilityLabel={month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                    accessibilityActions={[{ name: 'increment', label: 'Next month' }, { name: 'decrement', label: 'Previous month' }]}
                    onAccessibilityAction={event => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
                    onLayout={event => setWidth(event.nativeEvent.layout.width)}
                    layout={MORPH}
                    style={{ height: monthRows(month) * cell, overflow: 'hidden' }}
                >
                    <Animated.View style={slideStyle}>{days(month)}</Animated.View>
                </Animated.View>
            </GestureDetector>
        </>}
    </View>;
}

const styles = StyleSheet.create({
    calendar: { gap: 2 }, header: { flexDirection: 'row', alignItems: 'center' },
    monthButton: { flex: 1, minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8 },
    month: { fontSize: 16, fontFamily: FontFamily.medium },
    arrow: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    weekday: { width: '14.285714%', textAlign: 'center', fontSize: 11, fontFamily: FontFamily.medium, paddingVertical: 4 },
    cell: { width: '14.285714%', height: CELL, alignItems: 'center', justifyContent: 'center' },
    day: { width: 32, height: 32, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    dayText: { fontSize: 14, fontFamily: FontFamily.medium },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    today: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 8 },
    hint: { fontSize: 12, fontFamily: FontFamily.regular }, jump: { gap: 8 },
    yearRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
    year: { minHeight: 44, minWidth: 90, textAlign: 'center', borderWidth: 1, borderRadius: 11, fontSize: 16, fontFamily: FontFamily.medium },
    months: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 6 },
    // Four to a row: twelve months in three rows, no taller than the grid they stand in for,
    // so choosing a month never needs a scroll, even on an iPhone SE.
    monthChoice: { width: '23%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
});
