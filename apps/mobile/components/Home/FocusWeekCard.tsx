import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useScrub } from '@/hooks/useScrub';
import { VoidCard } from '@/components/ui/VoidCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { ValuePill } from '@/components/ui/ValuePill';
import { FocusWeekBars } from '@/components/Focus/FocusWeekBars';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { useFocusRecords } from '@/hooks/useFocusRecords';
import { useWeekStart } from '@/hooks/useWeekStart';
import { useFocusSession } from '@/context/FocusTimeContext';
import { focusDuration, focusSummary, shiftDay } from '@/lib/focusStats';
import { localDateKey } from '@/lib/habitSchedule';
import { startOfWeek } from '@/lib/weekStart';
import { todayKey } from '@/lib/tasks';
import { FontFamily } from '@/theme/designSystem';
import { ms, s, vs } from '@/theme/scale';

/**
 * Focus on Home, under Today's 3: this week's focus, a bar per day from the
 * week's first day (the same chart as the Focus page's week, FocusWeekBars),
 * today lit, and the week's total in a pill. Press or drag along the bars to
 * read a day (its name and time take the header's place); let go and it is the
 * week again. Only the header row, with its chevron, opens the Focus page.
 */
const weekdayName = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' });
export function FocusWeekCard({ onOpen }: { onOpen: () => void }) {
    const t = useTokens();
    const { lightFeedback } = useHaptics();
    const records = useFocusRecords();
    const { isRunning } = useFocusSession();
    const weekStart = useWeekStart();
    const today = todayKey();
    const weekFrom = useMemo(() => localDateKey(startOfWeek(new Date(`${today}T12:00:00`), weekStart)), [today, weekStart]);
    const week = useMemo(() => focusSummary(records, shiftDay(weekFrom, 6), 7), [records, weekFrom]);
    const total = week.days.filter(day => day.date <= today).reduce((sum, day) => sum + day.seconds, 0);
    const todaySeconds = week.days.find(day => day.date === today)?.seconds ?? 0;
    // The day under the finger, while it is down (days still ahead are not read).
    const [width, setWidth] = useState(0);
    const [picked, setPicked] = useState<number | null>(null);
    const onIndex = useCallback((index: number | null) => {
        setPicked(index !== null && week.days[index] && week.days[index].date <= today ? index : null);
    }, [week, today]);
    const scrub = useScrub({ count: week.days.length, width, mode: 'slots', gap: s(4), onIndex });
    const pickedDay = picked !== null ? week.days[picked] : undefined;

    return (
        <VoidCard style={styles.card}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightFeedback(); onOpen(); }} accessibilityRole="button" style={styles.header}
                accessibilityLabel={`Focus: ${focusDuration(todaySeconds)} today, ${focusDuration(total)} this week. Open focus stats.`}>
                <View style={styles.titleRow}>
                    <AppIcon name={isRunning ? 'timer' : 'hourglass'} filled size={s(16)} color={t.color.accent} />
                    <Text style={[styles.title, { color: t.color.textPrimary }]}>Focus</Text>
                    <Text style={[styles.today, { color: t.color.textMuted }]}>{pickedDay ? weekdayName(pickedDay.date) : `${focusDuration(todaySeconds)} today`}</Text>
                </View>
                <View style={styles.titleRow}>
                    <ValuePill value={focusDuration(pickedDay ? pickedDay.seconds : total)} />
                    <AppIcon name="chevron-forward" size={s(16)} color={t.color.textMuted} />
                </View>
            </TouchableOpacity>
            <GestureDetector gesture={scrub.gesture}>
                <View onLayout={event => setWidth(event.nativeEvent.layout.width)} accessible accessibilityRole="image"
                    accessibilityLabel={`Focus this week: ${week.days.filter(day => day.date <= today).map(day => `${weekdayName(day.date)} ${focusDuration(day.seconds)}`).join(', ')}`}>
                    <FocusWeekBars days={week.days} today={today} height={vs(96)} replay={weekFrom}
                        lit={pickedDay?.date} dim={!!pickedDay} />
                </View>
            </GestureDetector>
        </VoidCard>
    );
}

const styles = StyleSheet.create({
    card: { paddingHorizontal: s(18), paddingTop: s(8), paddingBottom: s(14) },
    // The one part that opens the Focus page: a full-height row, the chevron saying so.
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 44, marginBottom: vs(8) },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
    title: { fontSize: ms(17), fontFamily: FontFamily.bold },
    today: { fontSize: ms(13), fontFamily: FontFamily.medium },
});
