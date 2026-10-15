import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { IconTile } from '@/components/ui/IconTile';
import { SectionLabel, ValuePill } from '@/components/Goal/GoalRows';
import { CountUp } from '@/components/ui/Motion';
import { useRouter } from 'expo-router';
import Animated, { Easing, FadeIn, LinearTransition } from 'react-native-reanimated';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { VoidCard } from '@/components/ui/VoidCard';
import { VoidModal } from '@/components/ui/VoidModal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Colors } from '@/theme/colors';
import { FontFamily, UIStyles } from '@/theme/designSystem';
import { s, vs, ms } from '@/theme/scale';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import type { Habit } from '@/lib/habitsSQLite';
import type { HistoryDay } from '@/lib/habitDays';
import { recovery } from '@/lib/recovery';

const MORPH = LinearTransition.duration(260).easing(Easing.out(Easing.cubic));

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
    const { primary } = useAccentGradient();
    const { lightFeedback } = useHaptics();

    const result = useMemo(() => recovery(habits, history, completions, 90), [habits, history, completions]);

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
                {/* One number and one short line. */}
                <Animated.View entering={FadeIn.duration(220)}>
                    <CountUp testID="recovery-rate" style={[styles.heroValue, { color: headline }]}
                        value={result.rate === null ? '—' : `${result.rate}%`} />
                    <Text style={[styles.heroLabel, { color: colors.textSecondary }]}>
                        {result.rate === null ? 'Nothing missed twice yet' : 'back on track the very next time'}
                    </Text>
                </Animated.View>

                {result.atRisk.length ? (
                    <Animated.View layout={MORPH} entering={FadeIn.duration(220)}>
                        <SectionLabel tone={colors.warning}>Protect today</SectionLabel>
                        <VoidCard style={styles.card}>
                            {result.atRisk.map(item => (
                                <Pressable
                                    key={item.id}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${item.name}, missed on ${item.lastMiss ? shortDay(item.lastMiss) : 'its last day'}. Open habit.`}
                                    onPress={() => open(item.id)}
                                    style={styles.row}
                                >
                                    <IconTile icon="alert" color={colors.warning} size={38} shape="square" />
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.textPrimary }]}>{item.name}</Text>
                                        <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>
                                            Missed {item.lastMiss ? shortDay(item.lastMiss) : 'last time'}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={s(16)} color={colors.textTertiary} />
                                </Pressable>
                            ))}
                        </VoidCard>
                    </Animated.View>
                ) : (
                    <Text style={[styles.clearText, { color: colors.textSecondary }]}>Nothing to protect today</Text>
                )}

                {result.judged > 0 ? (
                    <>
                        <SectionLabel>Numbers</SectionLabel>
                        <VoidCard style={styles.card}>
                            <View style={styles.row}>
                                <Text style={[styles.rowTitle, { color: colors.textPrimary, flex: 1 }]}>Got back up</Text>
                                <ValuePill value={`${result.recovered}`} />
                            </View>
                            <View style={styles.row}>
                                <Text style={[styles.rowTitle, { color: colors.textPrimary, flex: 1 }]}>Missed twice</Text>
                                <ValuePill value={`${result.doubles}`} />
                            </View>
                        </VoidCard>
                    </>
                ) : null}

                {settled.length ? (
                    <>
                        <SectionLabel>Habits</SectionLabel>
                        <Animated.View layout={MORPH}>
                            <VoidCard style={styles.card}>
                                {settled.map(item => {
                                    const habit = habits.find(each => each.id === item.id);
                                    return (
                                        <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`${item.name}. Open habit.`}
                                            onPress={() => open(item.id)} style={styles.row}>
                                            <IconTile icon={habit?.icon || 'sparkles-outline'} color={habit?.color || primary} size={38} shape="square" />
                                            <Text numberOfLines={1} style={[styles.rowTitle, { color: colors.textPrimary, flex: 1 }]}>{item.name}</Text>
                                            <ValuePill value={item.rate === null ? '—' : `${item.rate}%`} />
                                        </Pressable>
                                    );
                                })}
                            </VoidCard>
                        </Animated.View>
                    </>
                ) : null}
            </ScrollView>
        </VoidModal>
    );
};




const styles = StyleSheet.create({
    card: { paddingHorizontal: s(16), paddingVertical: vs(6) },
    row: { flexDirection: 'row', alignItems: 'center', gap: s(12), paddingVertical: vs(10) },
    rowTitle: { fontSize: ms(15), fontFamily: FontFamily.medium },
    rowMeta: { fontSize: ms(12), fontFamily: FontFamily.regular, marginTop: 2 },
    content: { paddingHorizontal: s(20), paddingBottom: vs(40), gap: vs(12) },
    hero: { padding: s(20), gap: vs(4) },
    heroValue: { fontFamily: FontFamily.bold, fontSize: ms(46), lineHeight: ms(54), letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
    heroLabel: { fontSize: ms(13), lineHeight: ms(19), fontFamily: FontFamily.regular },
    heroSplit: { flexDirection: 'row', marginTop: vs(14), paddingTop: vs(14), borderTopWidth: StyleSheet.hairlineWidth },
    stat: { flex: 1, alignItems: 'center', gap: vs(2) },
    statValue: { fontFamily: FontFamily.bold, fontSize: ms(20), lineHeight: ms(26), fontVariant: ['tabular-nums'] },
    statLabel: { fontSize: ms(10), lineHeight: ms(15), fontFamily: FontFamily.regular, textAlign: 'center' },
    sectionLabel: { ...UIStyles.sectionTitle },
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
