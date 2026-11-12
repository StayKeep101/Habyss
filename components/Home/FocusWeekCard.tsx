import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { VoidCard } from '@/components/ui/VoidCard';
import { AppIcon } from '@/components/ui/AppIcon';
import { ValuePill } from '@/components/Goal/GoalRows';
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
 * today lit, and the week's total in a pill. Tap it for the Focus page.
 */
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

    return (
        <VoidCard style={styles.card}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => { lightFeedback(); onOpen(); }} accessibilityRole="button"
                accessibilityLabel={`Focus: ${focusDuration(todaySeconds)} today, ${focusDuration(total)} this week. Open focus stats.`}>
                <View style={styles.header}>
                    <View style={styles.titleRow}>
                        <AppIcon name={isRunning ? 'timer' : 'hourglass'} filled size={s(16)} color={t.color.accent} />
                        <Text style={[styles.title, { color: t.color.textPrimary }]}>Focus</Text>
                        <Text style={[styles.today, { color: t.color.textMuted }]}>{`${focusDuration(todaySeconds)} today`}</Text>
                    </View>
                    <ValuePill value={focusDuration(total)} />
                </View>
                <FocusWeekBars days={week.days} today={today} height={vs(96)} replay={weekFrom} />
            </TouchableOpacity>
        </VoidCard>
    );
}

const styles = StyleSheet.create({
    card: { paddingHorizontal: s(18), paddingTop: s(16), paddingBottom: s(14) },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: vs(12) },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
    title: { fontSize: ms(17), fontFamily: FontFamily.bold },
    today: { fontSize: ms(13), fontFamily: FontFamily.medium },
});
