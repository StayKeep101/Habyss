import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, Extrapolation } from 'react-native-reanimated';
import { VoidModal } from '@/components/ui/VoidModal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { VoidCard } from '@/components/ui/VoidCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { ChoicePill } from '@/components/ui/ChoicePill';
import { CountUp, ListItem } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { rescheduleToToday, sinceLabel, type Miss, type Missed } from '@/lib/missed';
import type { Habit } from '@/lib/habitsSQLite';
import { todayKey, updateTask } from '@/lib/tasks';
import { emit } from '@/lib/appEvents';
import { textOn, tint } from '@/theme/tokens';
import { FontFamily, Spacing } from '@/theme/designSystem';

/** How far past the big number the header has fully taken it over. */
const HANDOVER = 24;

/**
 * Only what is missed right now, and why twice is the one that matters.
 *
 * The count, then James Clear's line, then the split that makes the point:
 * missed once (an accident) against missed twice or more (a new habit
 * forming), the second in red. Below, habits and tasks apart, each row just
 * its name: a habit with how many times in a row, a task with since when and
 * a button that puts it on today. Scroll past the count and the header says
 * it instead: "16 missed".
 */
export const MissedModal: React.FC<{ visible: boolean; onClose: () => void; missed: Missed; habits: Habit[] }> = ({ visible, onClose, missed }) => (
    <VoidModal visible={visible} onClose={onClose}>
        <MissedView missed={missed} active={visible} onLeave={onClose} header />
    </VoidModal>
);

/**
 * What is missed, without its sheet: its own page in the Wallet · Streak ·
 * Missed sheet (components/Home/StatsSheet.tsx). `header`: its own title,
 * which takes the count over as it scrolls (the sheet around it has one).
 */
export function MissedView({ missed, active, onLeave, header = false }: { missed: Missed; active: boolean; onLeave: () => void; header?: boolean }) {
    const visible = active;
    const onClose = onLeave;
    // The count as big as the streak's on its page (components/Streak/StreakView.tsx).
    const { height } = useWindowDimensions();
    const heroSize = Math.round(Math.min(112, height * 0.12));
    const t = useTokens();
    const { lightFeedback, successFeedback } = useHaptics();
    const total = missed.items.length;
    const habitRows = missed.items.filter(item => item.kind === 'habit');
    const taskRows = missed.items.filter(item => item.kind === 'task');
    const once = habitRows.filter(item => item.level === 'once').length;
    const today = todayKey();

    // The header takes the count over as the big number scrolls under it.
    const scrollY = useSharedValue(0);
    const [heroEnd, setHeroEnd] = useState(120);
    const onScroll = useAnimatedScrollHandler(event => { scrollY.set(event.contentOffset.y); });
    const titleStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.get(), [heroEnd - HANDOVER, heroEnd], [1, 0], Extrapolation.CLAMP),
        transform: [{ translateY: interpolate(scrollY.get(), [heroEnd - HANDOVER, heroEnd], [0, -HANDOVER / 3], Extrapolation.CLAMP) }],
    }));
    const altStyle = useAnimatedStyle(() => ({
        opacity: interpolate(scrollY.get(), [heroEnd - HANDOVER, heroEnd], [0, 1], Extrapolation.CLAMP),
        transform: [{ translateY: interpolate(scrollY.get(), [heroEnd - HANDOVER, heroEnd], [HANDOVER / 3, 0], Extrapolation.CLAMP) }],
    }));

    const open = (item: Miss) => {
        lightFeedback();
        onClose();
        if (item.kind === 'habit') router.push({ pathname: '/habit-detail', params: { habitId: item.id } });
        else router.push('/(root)/(tabs)/roadmap' as never);
    };
    const toToday = (item: Miss) => {
        successFeedback();
        void updateTask(item.id, rescheduleToToday(item, today)).then(() => emit('tasks_changed'));
    };

    return (
        <View style={styles.flex}>
            {header ? <ModalHeader title="Missed" titleStyle={titleStyle} altTitle={`${total} missed`} altStyle={altStyle} /> : null}
            <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16}
                contentContainerStyle={{ paddingHorizontal: t.space.xl, paddingBottom: Spacing.bottom }} showsVerticalScrollIndicator={false}>
                <View style={[styles.hero, { gap: t.space.sm, paddingTop: t.space.sm, paddingBottom: t.space.xl }]}>
                    <View onLayout={event => setHeroEnd(event.nativeEvent.layout.y + event.nativeEvent.layout.height)}>
                        {/* No tight tracking on one big digit: iOS clips its right edge. */}
                        <CountUp style={[styles.heroValue, styles.heroRoom, { fontSize: heroSize, lineHeight: Math.round(heroSize * 1.08), letterSpacing: 0, color: t.color.textPrimary }]} value={total} replay={visible} />
                    </View>
                    {total ? (
                        <View style={{ gap: t.space.xs }}>
                            {/* One thought a line: the accident, then the turn, then what it becomes. */}
                            <Text style={[t.type.body, styles.quote, { color: t.color.textMuted }]}>
                                {'“Missing once is an accident.\nMissing twice is\nthe start of a new habit.”'}
                            </Text>
                            <Text style={[t.type.caption, styles.center, { color: t.color.textSubtle }]}>— James Clear</Text>
                        </View>
                    ) : (
                        <Text style={[t.type.bodySmall, styles.center, { color: t.color.textMuted }]}>Nothing missed. You're all caught up.</Text>
                    )}
                </View>

                {/* Once against twice: the accident, and the habit forming. */}
                {habitRows.length ? (
                    <View style={[styles.split, { gap: t.space.md, marginBottom: t.space.sm }]}>
                        <VoidCard style={[styles.splitCard, { padding: t.space.lg, gap: t.space.xs / 2, borderColor: 'transparent', borderWidth: 1 }]}>
                            <CountUp style={[styles.splitValue, { color: t.color.warning }]} value={once} replay={visible} />
                            <Text style={[t.type.bodySmall, styles.strong, { color: t.color.textPrimary }]}>Missed once</Text>
                            <Text style={[t.type.caption, { color: t.color.textMuted }]}>An accident</Text>
                        </VoidCard>
                        <VoidCard style={[styles.splitCard, { padding: t.space.lg, gap: t.space.xs / 2, borderColor: 'transparent', borderWidth: 1 }]}>
                            <CountUp style={[styles.splitValue, { color: t.color.danger }]} value={missed.twice} replay={visible} />
                            <Text style={[t.type.bodySmall, styles.strong, { color: t.color.textPrimary }]}>Missed twice+</Text>
                            <Text style={[t.type.caption, { color: missed.twice ? t.color.danger : t.color.textMuted }]}>A new habit forming</Text>
                        </VoidCard>
                    </View>
                ) : null}

                {habitRows.length ? (
                    <View>
                        <SectionTitle>Habits</SectionTitle>
                        <VoidCard style={{ paddingHorizontal: t.space.lg, paddingVertical: t.space.xs }}>
                            {habitRows.map((item, index) => {
                                const twice = item.level === 'twice';
                                return (
                                    <ListItem key={item.key} index={index}>
                                        <Pressable onPress={() => open(item)} accessibilityRole="button"
                                            accessibilityLabel={`${item.title}. Missed ${item.count} ${item.count === 1 ? 'time' : 'times'} in a row`}
                                            style={[styles.row, { gap: t.space.md, paddingVertical: t.space.md }, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.color.border }]}>
                                            <Text numberOfLines={1} style={[t.type.body, styles.strong, styles.flex, { color: t.color.textPrimary }]}>{item.title}</Text>
                                            {/* ×1 amber, ×2 and up solid red: the second miss is the one that counts. */}
                                            <View style={[styles.badge, { paddingHorizontal: t.space.sm, borderRadius: t.radius.full, backgroundColor: twice ? t.color.danger : tint(t.color.warning, 'subtle') }]}>
                                                <Text style={[t.type.bodySmall, styles.count, { color: twice ? textOn(t.color.danger) : t.color.warning }]}>{`×${item.count}`}</Text>
                                            </View>
                                        </Pressable>
                                    </ListItem>
                                );
                            })}
                        </VoidCard>
                    </View>
                ) : null}

                {taskRows.length ? (
                    <View>
                        <SectionTitle>Tasks</SectionTitle>
                        <VoidCard style={{ paddingHorizontal: t.space.lg, paddingVertical: t.space.xs }}>
                            {taskRows.map((item, index) => {
                                const moved = item.level === 'moved';
                                const line = moved ? `Moved from ${sinceLabel(item.since, today)}` : `Overdue since ${sinceLabel(item.since, today)}`;
                                return (
                                    <ListItem key={item.key} index={index}>
                                        <View style={[styles.row, { gap: t.space.md, paddingVertical: t.space.md }, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.color.border }]}>
                                            <Pressable style={styles.flex} onPress={() => open(item)} accessibilityRole="button" accessibilityLabel={`${item.title}. ${line}`}>
                                                <Text numberOfLines={1} style={[t.type.body, styles.strong, { color: t.color.textPrimary }]}>{item.title}</Text>
                                                <Text numberOfLines={1} style={[t.type.caption, { color: moved ? t.color.textMuted : t.color.danger }]}>{line}</Text>
                                            </Pressable>
                                            {moved ? null : (
                                                <ChoicePill label="Today" icon="arrow-forward" on={false} color={t.color.accent} role="button"
                                                    onPress={() => toToday(item)} accessibilityLabel={`Move ${item.title} to today`} />
                                            )}
                                        </View>
                                    </ListItem>
                                );
                            })}
                        </VoidCard>
                    </View>
                ) : null}
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    hero: { alignItems: 'center' },
    heroValue: { fontFamily: FontFamily.bold, fontSize: 52, lineHeight: 58, letterSpacing: -2, fontVariant: ['tabular-nums'] },
    heroRoom: { paddingHorizontal: Spacing.sm },
    quote: { textAlign: 'center' },
    center: { textAlign: 'center' },
    strong: { fontFamily: FontFamily.semibold },
    flex: { flex: 1 },
    row: { flexDirection: 'row', alignItems: 'center' },
    split: { flexDirection: 'row' },
    splitCard: { flex: 1 },
    splitValue: { fontFamily: FontFamily.bold, fontSize: 28, lineHeight: 34, fontVariant: ['tabular-nums'] },
    badge: { minWidth: 36, alignItems: 'center', paddingVertical: 2 },
    count: { fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
});
