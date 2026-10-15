import React, { useState } from 'react';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MatteInput } from '@/components/ui/MatteInput';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { localDateKey } from '@/lib/habitSchedule';

/** Timed, never sprung: a sprung height overshoots and the grid bounces. */
const MORPH = LinearTransition.duration(220).easing(Easing.out(Easing.cubic));
const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`;

const firstOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1, 12);
const shiftMonth = (date: Date, delta: number) => new Date(date.getFullYear(), date.getMonth() + delta, 1, 12);
const monthRows = (date: Date) => Math.ceil(((date.getDay() + 6) % 7 + new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()) / 7);

export function GoalCalendar({ value, onChange, accent, allowPast = false, showToday = true }: {
    allowPast?: boolean;
    /** Off where the surrounding sheet already has a Today button. */
    showToday?: boolean;
    value?: string; onChange: (date: string) => void; accent: string;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { selectionFeedback } = useHaptics();
    const today = localDateKey(new Date());
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
    const validYear = /^\d{4}$/.test(year) && Number(year) >= minimumMonth.getFullYear() && Number(year) <= 9999;

    const days = (page: Date) => {
        const offset = (page.getDay() + 6) % 7;
        const count = new Date(page.getFullYear(), page.getMonth() + 1, 0).getDate();
        return <View style={styles.grid}>
            {Array.from({ length: monthRows(page) * 7 }, (_, index) => {
                const day = index - offset + 1;
                if (day < 1 || day > count) return <View key={index} style={styles.cell} />;
                const date = localDateKey(new Date(page.getFullYear(), page.getMonth(), day, 12));
                const selected = date === value;
                const disabled = !allowPast && date < today;
                return <Pressable key={index} accessibilityRole="button" accessibilityLabel={`Choose ${date}`}
                    accessibilityState={{ selected, disabled }} disabled={disabled}
                    onPress={() => { selectionFeedback(); onChange(date); }} style={styles.cell}>
                    <View style={[styles.day, { backgroundColor: selected ? accent + '26' : 'transparent',
                        borderColor: selected || date === today ? accent : 'transparent' }]}>
                        <Text style={[styles.dayText, { color: selected ? accent : disabled ? colors.textTertiary : colors.textPrimary }]}>{day}</Text>
                    </View>
                </Pressable>;
            })}
        </View>;
    };

    return <View testID="goal-calendar" style={styles.calendar}>
        <View style={styles.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Choose month and year" accessibilityState={{ expanded: jump }}
                onPress={() => { setYear(String(month.getFullYear())); setJump(!jump); }} style={styles.monthButton}>
                <Text style={[styles.month, { color: colors.textPrimary }]}>
                    {month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                </Text>
                <AppIcon name={jump ? 'chevron-up' : 'chevron-down'} size={14} color={accent} />
            </Pressable>
            {!jump ? <>
                <Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={!canGoBack}
                    accessibilityState={{ disabled: !canGoBack }} onPress={() => showMonth(shiftMonth(month, -1))} style={styles.arrow}>
                    <AppIcon name="chevron-back" size={18} color={canGoBack ? accent : colors.textTertiary} />
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel="Next month" onPress={() => showMonth(shiftMonth(month, 1))} style={styles.arrow}>
                    <AppIcon name="chevron-forward" size={18} color={accent} />
                </Pressable>
            </> : null}
        </View>
        {jump ? <View style={styles.jump}>
            <View style={styles.yearRow}>
                <Pressable accessibilityRole="button" accessibilityLabel="Previous year" disabled={!validYear || Number(year) <= minimumMonth.getFullYear()}
                    onPress={() => setYear(String(Number(year) - 1))} style={styles.arrow}>
                    <AppIcon name="chevron-back" size={18} color={accent} />
                </Pressable>
                <MatteInput accessibilityLabel="Calendar year" value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4}
                    style={[styles.year, { color: colors.textPrimary, borderColor: colors.border }]} />
                <Pressable accessibilityRole="button" accessibilityLabel="Next year" disabled={!validYear || Number(year) >= 9999}
                    onPress={() => setYear(String(Number(year) + 1))} style={styles.arrow}>
                    <AppIcon name="chevron-forward" size={18} color={accent} />
                </Pressable>
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
                        style={[styles.monthChoice, { backgroundColor: selected ? accent + '20' : colors.background }]}>
                        <Text style={[styles.dayText, { color: disabled ? colors.textTertiary : selected ? accent : colors.textPrimary }]}>{label}</Text>
                    </Pressable>;
                })}
            </View>
            {!validYear ? <Text style={[styles.hint, { color: colors.textSecondary }]}>Enter a year from {minimumMonth.getFullYear()} to 9999.</Text> : null}
        </View> : <>
            <View style={styles.grid}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) =>
                    <Text key={index} style={[styles.weekday, { color: colors.textTertiary }]}>{day}</Text>)}
            </View>
            {/* One month, changed by the arrows above. The grid morphs to the
                new month's height so a 5-row month does not jolt into a 6-row
                one, and the days fade in rather than cutting. */}
            <Animated.View
                testID="calendar-viewport"
                layout={MORPH}
                style={{ height: monthRows(month) * 40, overflow: 'hidden' }}
            >
                <Animated.View key={monthKey(month)} entering={FadeIn.duration(180)}>
                    {days(month)}
                </Animated.View>
            </Animated.View>
        </>}
        <View style={styles.footer}>
            {/* Hidden where the sheet offers a Today shortcut of its own, so
                the word does not appear twice a few points apart. */}
            {showToday ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Go to current month" onPress={() => { showMonth(thisMonth); setJump(false); }} style={styles.today}>
                    <Text style={[styles.hint, { color: accent }]}>Today</Text>
                </Pressable>
            ) : <View />}
            <Text style={[styles.hint, { color: colors.textTertiary }]}>{jump ? 'Pick a month' : ''}</Text>
        </View>
    </View>;
}

const styles = StyleSheet.create({
    calendar: { gap: 2 }, header: { flexDirection: 'row', alignItems: 'center' },
    monthButton: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
    month: { fontSize: 16, fontFamily: FontFamily.medium },
    arrow: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    weekday: { width: '14.285714%', textAlign: 'center', fontSize: 11, fontFamily: FontFamily.medium, paddingVertical: 6 },
    cell: { width: '14.285714%', height: 40, alignItems: 'center', justifyContent: 'center' },
    day: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    dayText: { fontSize: 14, fontFamily: FontFamily.medium },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    today: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 8 },
    hint: { fontSize: 12, fontFamily: FontFamily.regular }, jump: { gap: 8 },
    yearRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 },
    year: { minHeight: 44, minWidth: 90, textAlign: 'center', borderWidth: 1, borderRadius: 11, fontSize: 16, fontFamily: FontFamily.medium },
    months: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    monthChoice: { width: '31%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
});
