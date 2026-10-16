import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { VoidModal } from '@/components/ui/VoidModal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { VoidCard } from '@/components/ui/VoidCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { AppIcon } from '@/components/ui/AppIcon';
import { CountUp, ListItem } from '@/components/ui/Motion';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useHaptics } from '@/hooks/useHaptics';
import { recovery } from '@/lib/recovery';
import { toggleCompletion, type Habit } from '@/lib/habitsSQLite';
import type { HistoryDay } from '@/lib/habitDays';

/**
 * Bounce back: never miss twice.
 *
 * One missed day is an accident; two in a row is the start of a new habit.
 * So the first thing here is anything you can still save today — a habit you
 * missed last time that is due again — with a tick right beside it. Then how
 * often you get straight back on it after a miss, and each habit's record.
 */
export const RecoveryModal: React.FC<{
    visible: boolean;
    onClose: () => void;
    habits: Habit[];
    history: HistoryDay[];
    completions: Record<string, boolean>;
}> = ({ visible, onClose, habits, history, completions }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { successFeedback } = useHaptics();
    const bounce = useMemo(() => recovery(habits, history, completions, 90), [habits, history, completions]);
    const judged = bounce.perHabit.filter(item => item.judged > 0);

    return (
        <VoidModal visible={visible} onClose={onClose}>
            <ModalHeader title="Bounce back" onBack={onClose} />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <Text style={[styles.rule, { color: colors.textSecondary }]}>
                    Never miss twice. One missed day is an accident; two in a row is the start of a new habit.
                </Text>

                {bounce.atRisk.length ? (
                    <>
                        <SectionTitle>Save today</SectionTitle>
                        <Text style={[styles.hint, { color: colors.textTertiary }]}>You missed these last time. Do them today and it stays a single miss.</Text>
                        <VoidCard style={styles.list}>
                            {bounce.atRisk.map((item, index) => (
                                <ListItem key={item.id} index={index}>
                                    <Pressable onPress={() => { successFeedback(); void toggleCompletion(item.id); }}
                                        style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
                                        accessibilityRole="button" accessibilityLabel={`Mark ${item.name} done`}>
                                        <View style={[styles.circle, { borderColor: colors.warning }]} />
                                        <Text numberOfLines={1} style={[styles.rowName, { color: colors.textPrimary }]}>{item.name}</Text>
                                        <AppIcon name="shield-half" size={16} color={colors.warning} />
                                    </Pressable>
                                </ListItem>
                            ))}
                        </VoidCard>
                    </>
                ) : null}

                <View style={styles.hero}>
                    <CountUp style={[styles.heroValue, { color: colors.textPrimary }]} value={bounce.rate === null ? '—' : `${bounce.rate}%`} replay={visible} />
                    <Text style={[styles.heroText, { color: colors.textSecondary }]}>
                        {bounce.rate === null
                            ? 'No misses in the last 90 days. Keep it that way.'
                            : `of the time, after missing a habit you did it the very next time it was due (${bounce.recovered} of ${bounce.judged}, last 90 days).`}
                    </Text>
                </View>

                {judged.length ? (
                    <>
                        <SectionTitle>Each habit</SectionTitle>
                        <VoidCard style={styles.list}>
                            {judged.map((item, index) => (
                                <ListItem key={item.id} index={index}>
                                    <View style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                                        <View style={styles.flex}>
                                            <Text numberOfLines={1} style={[styles.rowName, { color: colors.textPrimary }]}>{item.name}</Text>
                                            <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>
                                                {item.doubles ? `Missed twice in a row ${item.doubles}×` : 'Never missed twice'}
                                            </Text>
                                        </View>
                                        <Text style={[styles.rowRate, { color: (item.rate ?? 0) >= 70 ? colors.success : colors.textSecondary }]}>
                                            {item.recovered}/{item.judged}
                                        </Text>
                                    </View>
                                </ListItem>
                            ))}
                        </VoidCard>
                    </>
                ) : null}
            </ScrollView>
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    content: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.bottom },
    flex: { flex: 1 },
    rule: { fontFamily: FontFamily.medium, fontSize: 15, lineHeight: 22, textAlign: 'center', paddingVertical: Spacing.md },
    hint: { fontFamily: FontFamily.regular, fontSize: 13, lineHeight: 19, marginBottom: Spacing.sm },
    hero: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xl },
    heroValue: { fontFamily: FontFamily.bold, fontSize: 52, lineHeight: 58, letterSpacing: -2, fontVariant: ['tabular-nums'] },
    heroText: { fontFamily: FontFamily.medium, fontSize: 14, lineHeight: 20, textAlign: 'center' },
    list: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
    circle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2 },
    rowName: { flex: 1, fontFamily: FontFamily.medium, fontSize: 15 },
    rowMeta: { fontFamily: FontFamily.regular, fontSize: 12, marginTop: 2 },
    rowRate: { fontFamily: FontFamily.semibold, fontSize: 14, fontVariant: ['tabular-nums'] },
});
