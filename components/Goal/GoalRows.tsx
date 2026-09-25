import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
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
    const isLight = theme === 'light';
    const done = summary.doneToday;
    const canToggle = !!onToggle && (summary.scheduledToday || done);

    return (
        <TouchableOpacity
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Habit: ${summary.habit.name}. ${detail ?? summary.schedule}`}
            onPress={onPress}
            onLongPress={onLongPress}
            style={[styles.card, { backgroundColor: isLight ? '#fff' : 'rgba(255,255,255,0.05)', borderColor: colors.border }]}
        >
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
        </TouchableOpacity>
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

export const SectionLabel: React.FC<{ children: string; tone?: string; right?: React.ReactNode }> = ({ children, tone, right }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    return (
        <View style={styles.sectionRow}>
            <Text style={[styles.section, { color: tone ?? colors.textSecondary }]}>{children.toUpperCase()}</Text>
            {right}
        </View>
    );
};

const styles = StyleSheet.create({
    card: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, marginBottom: 8 },
    ring: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    title: { fontSize: 15, fontFamily: FontFamily.medium },
    meta: { fontSize: 12, fontFamily: FontFamily.regular, marginTop: 3 },
    week: { flexDirection: 'row', gap: 3 },
    dot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1.2 },
    sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 },
    section: { fontSize: 11, letterSpacing: 1.2, fontFamily: FontFamily.semibold },
});
