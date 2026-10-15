import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CountUp } from '@/components/ui/Motion';
import { useRouter } from 'expo-router';
import Animated, { Easing, FadeIn, LinearTransition, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { VoidCard } from '@/components/ui/VoidCard';
import { VoidModal } from '@/components/ui/VoidModal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { s, vs, ms } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import type { Habit } from '@/lib/habitsSQLite';
import type { HistoryDay } from '@/lib/habitDays';
import { recovery, type HabitRecovery } from '@/lib/recovery';

const MORPH = LinearTransition.duration(260).easing(Easing.out(Easing.cubic));
const EASE = { duration: 460, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System };

const shortDay = (date: string) =>
    new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/**
 * Getting back up, measured.
 *
 * Everything on this page is arranged around one sentence from Atomic Habits —
 * missing once is an accident, missing twice is the start of a new habit. So
 * what is savable *today* comes first and is the only thing you can act on from
 * here; the history underneath is there to prove the point, not to grade you.
 *
 * The rate is deliberately allowed to be null. A blunt 0% before anyone has
 * missed anything reads as a verdict on someone who has done nothing wrong.
 */
export const RecoveryModal = ({ visible, onClose, habits, history, completions }: {
    visible: boolean;
    onClose: () => void;
    habits: Habit[];
    history: HistoryDay[];
    completions: Record<string, boolean>;
}) => {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const isTrueDark = theme === 'trueDark';
    const { primary } = useAccentGradient();
    const { lightFeedback } = useHaptics();

    const result = useMemo(() => recovery(habits, history, completions, 90), [habits, history, completions]);
    const surface = { glass: !isTrueDark, intensity: isLight ? 20 : 80 };
    // Cards carry their own matte fill; nothing is painted over it.
    const tintStyle = null;

    const settled = result.perHabit.filter(item => !item.atRisk);
    const open = (id: string) => { lightFeedback(); onClose(); router.push({ pathname: '/habit-detail', params: { habitId: id } }); };

    const headline = result.rate === null ? colors.textPrimary
        : result.rate >= 70 ? colors.success : result.rate >= 40 ? primary : colors.warning;

    return (
        <VoidModal visible={visible} onClose={onClose}>
            <ModalHeader
                title="RECOVERY"
                onBack={onClose}
                shareSummary={{
                    title: 'Recovery',
                    value: result.rate === null ? '—' : `${result.rate}%`,
                    subtitle: 'How often a miss stayed a single miss',
                }}
            />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                {/* The headline, and what it is actually counting. */}
                <Animated.View entering={FadeIn.duration(220)}>
                    <VoidCard {...surface} style={[styles.hero, tintStyle]}>
                        <CountUp testID="recovery-rate" style={[styles.heroValue, { color: headline }]}
                            value={result.rate === null ? '—' : `${result.rate}%`} />
                        <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
                            {result.rate === null
                                ? 'Nothing has been missed twice yet. This fills in the first time a habit slips and you pick it back up.'
                                : `of the ${result.judged} time${result.judged === 1 ? '' : 's'} a habit slipped, you did it again the very next day it was due.`}
                        </Text>
                        {result.judged > 0 ? (
                            <View style={[styles.heroSplit, { borderTopColor: colors.border }]}>
                                <Stat label="Got back up" value={`${result.recovered}`} colors={colors} />
                                <Stat label="Missed twice" value={`${result.doubles}`} colors={colors} divider />
                            </View>
                        ) : null}
                    </VoidCard>
                </Animated.View>

                {/* The only part of this page that is about right now. */}
                {result.atRisk.length ? (
                    <Animated.View layout={MORPH} entering={FadeIn.duration(220)} style={styles.list}>
                        <Text style={[styles.sectionLabel, { color: colors.warning }]}>PROTECT TODAY</Text>
                        <Text style={[styles.sectionNote, { color: colors.textTertiary }]}>
                            {result.atRisk.length === 1 ? 'This was missed last time and is due again today.' : 'These were missed last time and are due again today.'}
                        </Text>
                        {result.atRisk.map(item => (
                            <Pressable
                                key={item.id}
                                accessibilityRole="button"
                                accessibilityLabel={`${item.name}, missed on ${item.lastMiss ? shortDay(item.lastMiss) : 'its last day'}. Open habit.`}
                                onPress={() => open(item.id)}
                                style={styles.press}
                            >
                                <VoidCard {...surface} style={[styles.riskRow, tintStyle, { borderColor: colors.warning + '55' }]}>
                                    <View style={[styles.riskIcon, { backgroundColor: colors.warning + '25' }]}>
                                        <Ionicons name="alert" size={s(17)} color={colors.warning} />
                                    </View>
                                    <View style={styles.riskText}>
                                        <Text numberOfLines={1} style={[styles.riskName, { color: colors.textPrimary }]}>{item.name}</Text>
                                        <Text style={[styles.riskFoot, { color: colors.textSecondary }]}>
                                            Missed {item.lastMiss ? shortDay(item.lastMiss) : 'last time'} — do it today and it stays a single miss.
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={s(16)} color={colors.textTertiary} />
                                </VoidCard>
                            </Pressable>
                        ))}
                    </Animated.View>
                ) : (
                    <VoidCard {...surface} style={[styles.clear, tintStyle]}>
                        <Ionicons name="shield-checkmark" size={s(17)} color={colors.success} />
                        <Text style={[styles.clearText, { color: colors.textSecondary }]}>
                            Nothing is about to be missed twice. This is the state worth defending.
                        </Text>
                    </VoidCard>
                )}

                {/* The record behind the number. */}
                {settled.length ? (
                    <>
                        <Text style={[styles.sectionLabel, styles.sectionTop, { color: colors.textTertiary }]}>HOW EACH ONE RECOVERS</Text>
                        <Animated.View layout={MORPH} style={styles.list}>
                            {settled.map(item => (
                                <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.name}. Open habit.`} onPress={() => open(item.id)} style={styles.press}>
                                    <VoidCard {...surface} style={[styles.habitRow, tintStyle]}>
                                        <View style={styles.habitTop}>
                                            <Text numberOfLines={1} style={[styles.habitName, { color: colors.textPrimary }]}>{item.name}</Text>
                                            <Text style={[styles.habitRate, {
                                                color: item.rate === null ? colors.textTertiary
                                                    : item.rate >= 70 ? colors.success : item.rate >= 40 ? primary : colors.warning,
                                            }]}>
                                                <CountUp value={item.rate === null ? '—' : `${item.rate}%`} />
                                            </Text>
                                        </View>
                                        <Beads item={item} colors={colors} success={colors.success} warning={colors.warning} />
                                        <Text style={[styles.habitFoot, { color: colors.textSecondary }]}>
                                            {item.judged === 0
                                                ? 'No slip has needed answering yet.'
                                                : `Got back up ${item.recovered} of ${item.judged} time${item.judged === 1 ? '' : 's'}.`}
                                        </Text>
                                    </VoidCard>
                                </Pressable>
                            ))}
                        </Animated.View>
                    </>
                ) : null}

                <VoidCard {...surface} style={[styles.note, tintStyle]}>
                    <Ionicons name="information-circle-outline" size={s(16)} color={primary} />
                    <Text style={[styles.noteText, { color: colors.textSecondary }]}>
                        Missing once is an accident. Missing twice is the start of a new habit — which is why this counts
                        getting back up, not being perfect. A day you deliberately skipped is never held against you.
                    </Text>
                </VoidCard>
            </ScrollView>
        </VoidModal>
    );
};

const Stat = ({ label, value, colors, divider }: { label: string; value: string; colors: typeof Colors.light; divider?: boolean }) => (
    <View style={[styles.stat, divider && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border }]}>
        <CountUp style={[styles.statValue, { color: colors.textPrimary }]} value={value} />
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
);

/**
 * One bead per slip, green where it was answered the next day.
 *
 * A bar would say the same thing less honestly — six slips and four slips are
 * different situations even at the same percentage, and the beads show that.
 */
const Beads = ({ item, colors, success, warning }: {
    item: HabitRecovery; colors: typeof Colors.light; success: string; warning: string;
}) => {
    const beads = [
        ...Array.from({ length: item.recovered }, () => true),
        ...Array.from({ length: item.doubles }, () => false),
    ].slice(0, 14);
    if (beads.length === 0) return null;
    return (
        <View style={styles.beads} accessibilityRole="image" accessibilityLabel={`${item.recovered} recovered, ${item.doubles} missed twice`}>
            {beads.map((won, index) => (
                <Bead key={index} won={won} index={index} success={success} warning={warning} />
            ))}
        </View>
    );
};

const Bead = ({ won, index, success, warning }: { won: boolean; index: number; success: string; warning: string }) => {
    const shown = useSharedValue(0);
    React.useEffect(() => { shown.value = withTiming(1, { ...EASE, duration: 320 + index * 18 }); }, [shown, index]);
    const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ scale: 0.7 + shown.value * 0.3 }] }));
    return <Animated.View style={[styles.bead, style, { backgroundColor: won ? success : warning }]} />;
};

const styles = StyleSheet.create({
    content: { paddingHorizontal: s(20), paddingBottom: vs(40), gap: vs(12) },
    hero: { padding: s(20), gap: vs(4) },
    heroValue: { fontFamily: FontFamily.bold, fontSize: ms(46), lineHeight: ms(54), letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
    heroLabel: { fontSize: ms(13), lineHeight: ms(19), fontFamily: FontFamily.regular },
    heroSplit: { flexDirection: 'row', marginTop: vs(14), paddingTop: vs(14), borderTopWidth: StyleSheet.hairlineWidth },
    stat: { flex: 1, alignItems: 'center', gap: vs(2) },
    statValue: { fontFamily: FontFamily.bold, fontSize: ms(20), lineHeight: ms(26), fontVariant: ['tabular-nums'] },
    statLabel: { fontSize: ms(10), lineHeight: ms(15), fontFamily: FontFamily.regular, textAlign: 'center' },
    sectionLabel: { fontSize: ms(11), lineHeight: ms(16), letterSpacing: 1.5, fontFamily: FontFamily.bold },
    sectionNote: { fontSize: ms(12), lineHeight: ms(18), fontFamily: FontFamily.regular, marginTop: vs(-4) },
    sectionTop: { marginTop: vs(10) },
    list: { gap: vs(10) },
    press: { borderRadius: s(22) },
    riskRow: { flexDirection: 'row', alignItems: 'center', gap: s(12), padding: s(16) },
    riskIcon: { width: s(34), height: s(34), borderRadius: s(17), alignItems: 'center', justifyContent: 'center' },
    riskText: { flex: 1, gap: vs(2) },
    riskName: { fontSize: ms(14), lineHeight: ms(20), fontFamily: FontFamily.medium },
    riskFoot: { fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular },
    clear: { flexDirection: 'row', alignItems: 'center', gap: s(10), padding: s(16) },
    clearText: { flex: 1, fontSize: ms(13), lineHeight: ms(19), fontFamily: FontFamily.regular },
    habitRow: { padding: s(16), gap: vs(8) },
    habitTop: { flexDirection: 'row', alignItems: 'center', gap: s(8) },
    habitName: { flex: 1, fontSize: ms(14), lineHeight: ms(20), fontFamily: FontFamily.medium },
    habitRate: { fontFamily: FontFamily.bold, fontSize: ms(17), fontVariant: ['tabular-nums'] },
    habitFoot: { fontSize: ms(11), lineHeight: ms(16), fontFamily: FontFamily.regular },
    beads: { flexDirection: 'row', gap: s(4), flexWrap: 'wrap' },
    bead: { width: s(9), height: s(9), borderRadius: s(5) },
    note: { flexDirection: 'row', alignItems: 'flex-start', gap: s(10), padding: s(16), marginTop: vs(4) },
    noteText: { flex: 1, fontSize: ms(12), lineHeight: ms(18), fontFamily: FontFamily.regular },
});
