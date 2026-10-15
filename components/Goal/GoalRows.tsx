import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { CountUp } from '@/components/ui/Motion';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import type { DayMark, HabitSummary } from '@/lib/goalInsights';

/**
 * A habit on a goal. Round check, like habits everywhere in Habyss, so it is
 * never mistaken for a task (square, amber edge).
 */
export const GoalHabitRow: React.FC<{
    summary: HabitSummary;
    color: string;
    /** What the second line says; defaults to the schedule. */
    detail?: string;
    showWeek?: boolean;
    onToggle?: () => void;
    onPress: () => void;
    onLongPress?: () => void;
}> = ({ summary, color, detail, showWeek, onToggle, onPress, onLongPress }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const done = summary.doneToday;
    const canToggle = !!onToggle && (summary.scheduledToday || done);

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Habit: ${summary.habit.name}. ${detail ?? summary.schedule}`}
            onPress={onPress}
            onLongPress={onLongPress}
        >
        <MatteSurface radius={18} style={styles.card}>
            {canToggle ? (
                <TouchableOpacity
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: done }}
                    accessibilityLabel={done ? `Undo ${summary.habit.name}` : `Mark ${summary.habit.name} done`}
                    onPress={onToggle}
                    hitSlop={12}
                    style={[styles.ring, { borderColor: done ? color : colors.textTertiary, backgroundColor: done ? color : 'transparent' }]}
                >
                    {done ? <Ionicons name="checkmark" size={16} color="#fff" /> : null}
                </TouchableOpacity>
            ) : (
                <View style={[styles.ring, { borderColor: color + '66', borderStyle: 'dashed' }]} />
            )}

            <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[styles.title, { color: done && canToggle ? colors.textTertiary : colors.textPrimary }]}>
                    {summary.habit.name}
                </Text>
                <Text numberOfLines={1} style={[styles.meta, { color: colors.textTertiary }]}>{detail ?? summary.schedule}</Text>
            </View>

            {showWeek ? <WeekDots marks={summary.last7} color={color} /> : null}
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
        </MatteSurface>
        </TouchableOpacity>
    );
};

/** A number on the right of a row, in a small matte pill — Phantom's "46%". */
export const ValuePill: React.FC<{ value: string; tone?: string }> = ({ value, tone }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <MatteSurface radius={999} level="control" elevation="none" style={styles.pill}>
            <CountUp style={[styles.pillText, { color: tone ?? colors.textPrimary }]} value={value} />
        </MatteSurface>
    );
};

/** The last seven days, oldest first: filled done, hollow missed, faint off. */
export const WeekDots: React.FC<{ marks: DayMark[]; color: string }> = ({ marks, color }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <View style={styles.week} accessibilityLabel={`Last 7 days: ${marks.filter(mark => mark === 'done').length} done`}>
            {marks.map((mark, index) => (
                <View
                    key={index}
                    style={[styles.dot, {
                        backgroundColor: mark === 'done' ? color : 'transparent',
                        borderColor: mark === 'missed' ? colors.error : mark === 'off' ? colors.border : color,
                        opacity: mark === 'off' ? 0.5 : 1,
                    }]}
                />
            ))}
        </View>
    );
};

/** The section heading — the shared one from the UI kit. */
export const SectionLabel = SectionTitle;

const styles = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 10 },
    pill: { minWidth: 58, paddingHorizontal: 12, paddingVertical: 7, alignItems: 'center' },
    pillText: { fontSize: 14, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    ring: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 15, fontFamily: FontFamily.medium },
    meta: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 3 },
    week: { flexDirection: 'row', gap: 3 },
    dot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.2 },
});
