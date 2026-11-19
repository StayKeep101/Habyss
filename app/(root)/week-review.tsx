import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { VoidCard } from '@/components/ui/VoidCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { CountUp, ListItem } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { Radius } from '@/theme/designSystem';
import { textOn } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useEchoCoach } from '@/hooks/useEchoCoach';
import { useEchoPatterns } from '@/hooks/useEchoPatterns';
import { PatternList } from '@/components/Echo/PatternList';
import { useWeekStart } from '@/hooks/useWeekStart';
import { buildWeeklyReview, type HabitWeek } from '@/lib/weeklyReview';
import { weekKey } from '@/lib/weekStart';
import { shiftDay } from '@/lib/habitDays';
import { styles } from '@/styles/screens/week-review.styles';

/**
 * The week in a minute: kept rate against last week, what held, what got
 * harder, how often you bounced back, what got in the way, and at most two
 * things to try next week. Counted, not guessed; a week in progress says so.
 */
export default function WeekReview() {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { selectionFeedback } = useHaptics();
    const coach = useEchoCoach();
    const patterns = useEchoPatterns();
    const weekStart = useWeekStart();
    const [which, setWhich] = useState<'this' | 'last'>('this');

    const thisWeek = weekKey(new Date(), weekStart);
    const start = which === 'this' ? thisWeek : shiftDay(thisWeek, -7);
    const review = useMemo(() => buildWeeklyReview({
        habits: coach.habits, tasks: coach.tasks, history: coach.historyDays, completions: coach.completions,
        today: coach.today, weekStart: start, notes: coach.memory.notes,
    }), [coach.habits, coach.tasks, coach.historyDays, coach.completions, coach.today, start, coach.memory.notes]);

    const change = review.rate !== null && review.previousRate !== null ? review.rate - review.previousRate : null;
    const list = (items: HabitWeek[], value: (item: HabitWeek) => string) => (
        <VoidCard style={styles.list}>
            {items.map((item, index) => (
                <ListItem key={item.id} index={index}>
                    <View style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                        <Text numberOfLines={1} style={[styles.rowName, { color: colors.textPrimary }]}>{item.name}</Text>
                        <Text style={[styles.rowValue, { color: colors.textTertiary }]}>{value(item)}</Text>
                    </View>
                </ListItem>
            ))}
        </VoidCard>
    );

    return (
        <SheetScreen title="Your week" onBack={() => router.back()}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.switch}>
                    {(['this', 'last'] as const).map(option => (
                        <Pressable key={option} style={styles.flex} accessibilityRole="button" accessibilityState={{ selected: which === option }}
                            onPress={() => { selectionFeedback(); setWhich(option); }}>
                            <MatteSurface radius={Radius.pill} level="control" tint={which === option ? primary : undefined} style={styles.pill}>
                                <Text style={[styles.pillText, { color: which === option ? textOn(primary) : colors.textSecondary }]}>
                                    {option === 'this' ? 'This week' : 'Last week'}
                                </Text>
                            </MatteSurface>
                        </Pressable>
                    ))}
                </View>

                {review.rate === null ? (
                    <Text style={[styles.quiet, { color: colors.textTertiary }]}>No habits were due in this week yet.</Text>
                ) : (
                    <View style={styles.hero}>
                        <CountUp style={[styles.heroValue, { color: colors.textPrimary }]} value={`${review.rate}%`} replay={start} />
                        <Text style={[styles.heroText, { color: colors.textSecondary }]}>
                            of habits kept{review.soFar ? ' so far' : ''} · {review.kept} of {review.countable}
                        </Text>
                        {change !== null ? (
                            <Text style={[styles.change, { color: change > 0 ? colors.success : change < 0 ? colors.warning : colors.textTertiary }]}>
                                {change === 0 ? 'Same as the week before' : `${change > 0 ? '↑' : '↓'} ${Math.abs(change)} vs the week before`}
                            </Text>
                        ) : null}
                    </View>
                )}

                <View style={styles.stats}>
                    <VoidCard style={styles.stat}>
                        <CountUp style={[styles.statValue, { color: colors.textPrimary }]} value={review.tasksDone} replay={start} />
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Tasks done</Text>
                    </VoidCard>
                    <VoidCard style={styles.stat}>
                        <CountUp style={[styles.statValue, { color: colors.textPrimary }]} value={review.bouncedBack} replay={start} />
                        <Text style={[styles.statLabel, { color: colors.textTertiary }]}>Bounced back</Text>
                    </VoidCard>
                </View>

                {review.held.length ? <><SectionTitle>Held up</SectionTitle>{list(review.held, item => `${item.kept}/${item.countable}`)}</> : null}
                {review.harder.length ? <><SectionTitle>Got harder</SectionTitle>{list(review.harder, item => `${item.before}% → ${item.rate}%`)}</> : null}

                {review.obstacles.length ? (
                    <>
                        <SectionTitle>In the way</SectionTitle>
                        <VoidCard style={styles.list}>
                            {review.obstacles.slice(0, 5).map((text, index) => (
                                <View key={`${text}-${index}`} style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                                    <Text style={[styles.rowName, { color: colors.textSecondary }]}>{text}</Text>
                                </View>
                            ))}
                        </VoidCard>
                    </>
                ) : null}

                <PatternList patterns={patterns} title="Echo found" limit={4} />

                {review.tryNext.length ? (
                    <>
                        <SectionTitle>Try next week</SectionTitle>
                        {review.tryNext.map(text => (
                            <VoidCard key={text} style={styles.tip}>
                                <View style={[styles.dot, { backgroundColor: primary }]} />
                                <Text style={[styles.tipText, { color: colors.textPrimary }]}>{text}</Text>
                            </VoidCard>
                        ))}
                    </>
                ) : null}
            </ScrollView>
        </SheetScreen>
    );
}
