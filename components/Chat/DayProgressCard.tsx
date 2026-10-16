import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { cardShare, type DayCardData, type DayCardLine } from '@/lib/dayCard';

const dayLabel = (day: string, today: string) => {
    if (day === today) return 'Today';
    return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
};

/**
 * Somebody's day, as it appears in a chat: a ring for how far they got, then
 * every habit and task with a tick or an empty circle. Sent by the app, not
 * typed, so it is the same card style as the rest of the app rather than a bubble.
 */
export function DayProgressCard({ card, day, today, mine, name }: {
    card: DayCardData; day: string; today: string; mine: boolean; name: string;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const share = cardShare(card);
    const done = card.habitsDone + card.tasksDone;
    const total = card.habitsTotal + card.tasksTotal;

    const line = (item: DayCardLine, index: number) => (
        <View key={`${item.name}-${index}`} style={styles.line}>
            <View style={[styles.check, item.done
                ? { backgroundColor: colors.success, borderColor: colors.success }
                : { borderColor: colors.textTertiary }]}>
                {item.done ? <AppIcon name="checkmark" size={11} color={colors.background} /> : null}
                {item.skipped ? <View style={[styles.skipBar, { backgroundColor: colors.textTertiary }]} /> : null}
            </View>
            <Text numberOfLines={1} style={[styles.lineText, {
                color: item.done ? colors.textPrimary : colors.textTertiary,
                textDecorationLine: item.skipped ? 'line-through' : 'none',
            }]}>{item.name}</Text>
        </View>
    );

    const section = (title: string, lines: DayCardLine[] | undefined, doneCount: number, totalCount: number) =>
        totalCount > 0 ? (
            <View style={styles.section}>
                <View style={styles.sectionHead}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
                    <Text style={[styles.count, { color: doneCount === totalCount ? colors.success : colors.textSecondary }]}>
                        {doneCount}/{totalCount}
                    </Text>
                </View>
                {lines?.map(line)}
            </View>
        ) : null;

    return (
        <MatteSurface radius={Radius.card} style={[styles.card, mine ? styles.mine : styles.theirs]}>
            <View style={styles.body}>
                <View style={styles.head}>
                    <ProgressRing progress={share} size="sm" tone={share >= 1 ? 'success' : 'accent'}
                        accessibilityLabel={`${done} of ${total} done`} />
                    <View style={styles.headText}>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>{mine ? 'Your day' : `${name}'s day`}</Text>
                        <Text style={[styles.meta, { color: colors.textTertiary }]}>{dayLabel(day, today)} · {done}/{total}</Text>
                    </View>
                    {card.streak > 0 ? (
                        <View style={styles.streak}>
                            <AppIcon name="flame" size={14} color={colors.warning} />
                            <Text style={[styles.streakText, { color: colors.textPrimary }]}>{card.streak}</Text>
                        </View>
                    ) : null}
                </View>
                {section('Habits', card.habits, card.habitsDone, card.habitsTotal)}
                {section('Tasks', card.tasks, card.tasksDone, card.tasksTotal)}
            </View>
        </MatteSurface>
    );
}

const styles = StyleSheet.create({
    card: { width: '82%', marginVertical: Spacing.xs },
    mine: { alignSelf: 'flex-end' },
    theirs: { alignSelf: 'flex-start' },
    body: { padding: Spacing.lg, gap: Spacing.sm },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    headText: { flex: 1 },
    title: { fontFamily: FontFamily.bold, fontSize: 16, lineHeight: 22 },
    meta: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 18 },
    streak: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    streakText: { fontFamily: FontFamily.semibold, fontSize: 14, fontVariant: ['tabular-nums'] },
    section: { gap: Spacing.xs },
    sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: Spacing.xs },
    sectionTitle: { fontFamily: FontFamily.bold, fontSize: 14 },
    count: { fontFamily: FontFamily.medium, fontSize: 13, fontVariant: ['tabular-nums'] },
    line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + Spacing.xs, paddingVertical: 2 },
    check: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    skipBar: { width: 8, height: 1.5, borderRadius: 1 },
    lineText: { flex: 1, fontFamily: FontFamily.medium, fontSize: 14 },
});
