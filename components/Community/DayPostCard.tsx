import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { VoidCard } from '@/components/ui/VoidCard';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { AppIcon } from '@/components/ui/AppIcon';
import { Avatar } from '@/components/ui/Avatar';
import { CountUp } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { cardShare, type DayCardData, type DayCardLine } from '@/lib/dayCard';

const LIMIT = 5;

const postedLabel = (postedAt: string) => {
    const date = new Date(postedAt);
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    if (date.toDateString() === today.toDateString()) return time;
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday · ${time}`;
    return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

/**
 * One person's day, posted to the feed at the time they chose.
 *
 * A face, a ring for how much of the day got done, then what they did — and
 * what they did not — habits and tasks, by name. Friends acknowledge it with
 * one tap; the people who did are shown.
 */
export function DayPostCard({ name, avatarUrl, postedAt, card, mine, ackCount, acked, ackFaces, onAcknowledge, onOpenAuthor }: {
    name: string;
    avatarUrl?: string;
    postedAt: string;
    card: DayCardData;
    mine: boolean;
    ackCount: number;
    acked: boolean;
    ackFaces: { name: string; avatarUrl?: string }[];
    onAcknowledge: () => void;
    onOpenAuthor: () => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary, buttonColors } = useAccentGradient();
    const share = cardShare(card);
    const done = card.habitsDone + card.tasksDone;
    const total = card.habitsTotal + card.tasksTotal;
    const allDone = total > 0 && done === total;

    // The acknowledge button springs when it is pressed.
    const pop = useSharedValue(1);
    useEffect(() => {
        if (acked) pop.value = withSequence(withSpring(1.12, { damping: 9, stiffness: 300, reduceMotion: ReduceMotion.System }), withTiming(1, { duration: 140 }));
    }, [acked, pop]);
    const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

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

    const section = (title: string, lines: DayCardLine[] | undefined, doneCount: number, totalCount: number) => {
        if (totalCount === 0) return null;
        // Done first, so the card leads with what happened.
        const ordered = [...(lines ?? [])].sort((a, b) => Number(b.done) - Number(a.done));
        return (
            <View style={styles.section}>
                <View style={styles.sectionHead}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
                    <Text style={[styles.count, { color: doneCount === totalCount ? colors.success : colors.textSecondary }]}>{doneCount}/{totalCount}</Text>
                </View>
                {ordered.slice(0, LIMIT).map(line)}
                {ordered.length > LIMIT ? (
                    <Text style={[styles.more, { color: colors.textTertiary }]}>+{ordered.length - LIMIT} more</Text>
                ) : null}
            </View>
        );
    };

    return (
        <VoidCard style={styles.card}>
            <View style={styles.body}>
                <View style={styles.head}>
                    <Pressable onPress={onOpenAuthor} accessibilityRole="button" accessibilityLabel={`${name}'s profile`}>
                        <Avatar name={name} uri={avatarUrl} size={42} />
                    </Pressable>
                    <View style={styles.headText}>
                        <Text numberOfLines={1} style={[styles.name, { color: colors.textPrimary }]}>{mine ? 'You' : name}</Text>
                        <Text style={[styles.meta, { color: colors.textTertiary }]}>{postedLabel(postedAt)}</Text>
                    </View>
                    <ProgressRing progress={share} size="sm" tone={allDone ? 'success' : 'accent'} accessibilityLabel={`${done} of ${total} done`} />
                </View>

                <View style={styles.headline}>
                    <CountUp style={[styles.big, { color: allDone ? colors.success : colors.textPrimary }]} value={done} />
                    <Text style={[styles.of, { color: colors.textSecondary }]}>of {total} done</Text>
                    {card.streak > 0 ? (
                        <View style={styles.streak}>
                            <AppIcon name="flame" size={14} color={colors.warning} />
                            <Text style={[styles.streakText, { color: colors.textPrimary }]}>{card.streak}</Text>
                        </View>
                    ) : null}
                </View>

                {section('Habits', card.habits, card.habitsDone, card.habitsTotal)}
                {section('Tasks', card.tasks, card.tasksDone, card.tasksTotal)}

                <View style={[styles.foot, { borderTopColor: colors.border }]}>
                    {ackFaces.length ? (
                        <View style={styles.faces}>
                            {ackFaces.slice(0, 4).map((face, index) => (
                                <Avatar key={`${face.name}-${index}`} name={face.name} uri={face.avatarUrl} size={22}
                                    style={{ marginLeft: index ? -7 : 0 }} />
                            ))}
                        </View>
                    ) : null}
                    <Text style={[styles.ackText, { color: colors.textTertiary }]}>
                        {ackCount === 0 ? (mine ? 'No one yet' : '') : ackCount === 1 ? '1 acknowledged' : `${ackCount} acknowledged`}
                    </Text>
                    {!mine ? (
                        <Animated.View style={popStyle}>
                            <Pressable onPress={onAcknowledge} accessibilityRole="button" accessibilityState={{ selected: acked }}
                                accessibilityLabel={acked ? 'Acknowledged. Tap to undo' : 'Acknowledge'}>
                                {acked ? (
                                    <View style={styles.ackButton}>
                                        <LinearGradient colors={buttonColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                                        <AppIcon name="checkmark-done" size={15} color={colors.background} />
                                        <Text style={[styles.ackLabel, { color: colors.background }]}>Acknowledged</Text>
                                    </View>
                                ) : (
                                    <MatteSurface radius={Radius.pill} level="control" style={styles.ackButton}>
                                        <AppIcon name="checkmark-done" size={15} color={primary} />
                                        <Text style={[styles.ackLabel, { color: colors.textPrimary }]}>Acknowledge</Text>
                                    </MatteSurface>
                                )}
                            </Pressable>
                        </Animated.View>
                    ) : null}
                </View>
            </View>
        </VoidCard>
    );
}

const styles = StyleSheet.create({
    card: { marginBottom: Spacing.md },
    body: { padding: Spacing.lg, gap: Spacing.md },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    headText: { flex: 1 },
    name: { fontFamily: FontFamily.semibold, fontSize: 16, lineHeight: 22 },
    meta: { fontFamily: FontFamily.regular, fontSize: 12, lineHeight: 18 },
    headline: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
    big: { fontFamily: FontFamily.bold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8, fontVariant: ['tabular-nums'] },
    of: { fontFamily: FontFamily.medium, fontSize: 15, flex: 1 },
    streak: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    streakText: { fontFamily: FontFamily.semibold, fontSize: 14, fontVariant: ['tabular-nums'] },
    section: { gap: Spacing.xs },
    sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    sectionTitle: { fontFamily: FontFamily.bold, fontSize: 14 },
    count: { fontFamily: FontFamily.medium, fontSize: 13, fontVariant: ['tabular-nums'] },
    line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm + Spacing.xs, paddingVertical: 2 },
    check: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    skipBar: { width: 8, height: 1.5, borderRadius: 1 },
    lineText: { flex: 1, fontFamily: FontFamily.medium, fontSize: 14 },
    more: { fontFamily: FontFamily.regular, fontSize: 12, marginLeft: 30 },
    foot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.md },
    faces: { flexDirection: 'row' },
    ackText: { flex: 1, fontFamily: FontFamily.regular, fontSize: 12 },
    ackButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, paddingHorizontal: Spacing.md + 2, paddingVertical: Spacing.sm, borderRadius: Radius.pill, overflow: 'hidden' },
    ackLabel: { fontFamily: FontFamily.semibold, fontSize: 13 },
});
