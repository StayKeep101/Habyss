import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { VoidModal } from '@/components/ui/VoidModal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { VoidCard } from '@/components/ui/VoidCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { AppIcon } from '@/components/ui/AppIcon';
import { CountUp, ListItem } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { missedDayLabel, type Miss, type Missed, type MissTone } from '@/lib/missed';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { TASK_COLOR } from '@/components/Roadmap/TaskItem';

const TONE_ICON: Record<MissTone, string> = {
    recovered: 'checkmark-circle', again: 'close-circle', pending: 'time', moved: 'arrow-forward-circle', late: 'checkmark-circle',
};

/**
 * Missed, day by day: on Monday you did not do this, and what happened next —
 * done the next time, missed again, moved to the next day for you, still
 * waiting. The line at the top says whether you are falling behind or
 * catching up.
 */
export const MissedModal: React.FC<{ visible: boolean; onClose: () => void; missed: Missed; today: string }> = ({ visible, onClose, missed, today }) => {
    const t = useTokens();
    const { lightFeedback } = useHaptics();
    const { thisWeek, lastWeek, behind } = missed;
    const verdict = useMemo(() => {
        if (thisWeek === 0) return lastWeek ? `Nothing missed this week, after ${lastWeek} the week before. Well caught up.` : 'Nothing missed in the last two weeks.';
        const compare = thisWeek > lastWeek ? `up from ${lastWeek} the week before. You're falling behind.`
            : thisWeek < lastWeek ? `down from ${lastWeek} the week before. You're catching up.`
            : 'the same as the week before.';
        return `${thisWeek} missed in the last 7 days, ${compare}`;
    }, [thisWeek, lastWeek]);
    const toneColor = (tone: MissTone) => tone === 'recovered' ? t.color.success : tone === 'again' ? t.color.danger : tone === 'pending' ? t.color.warning : t.color.textMuted;
    const open = (item: Miss) => {
        lightFeedback();
        onClose();
        if (item.kind === 'habit') router.push({ pathname: '/habit-detail', params: { habitId: item.id } });
        else router.push('/(root)/(tabs)/roadmap' as never);
    };

    return (
        <VoidModal visible={visible} onClose={onClose}>
            <ModalHeader title="Missed" onBack={onClose} />
            <ScrollView contentContainerStyle={{ paddingHorizontal: t.space.xl, paddingBottom: Spacing.bottom }} showsVerticalScrollIndicator={false}>
                <View style={[styles.hero, { gap: t.space.xs, paddingVertical: t.space.lg }]}>
                    <CountUp style={[styles.heroValue, { color: t.color.textPrimary }]} value={thisWeek} replay={visible} />
                    <Text style={[t.type.bodySmall, styles.center, { color: t.color.textMuted }]}>{verdict}</Text>
                    {behind ? (
                        <Text style={[t.type.caption, styles.center, styles.strong, { color: t.color.warning }]}>
                            {`${behind} still not caught up`}
                        </Text>
                    ) : null}
                </View>

                {missed.days.map((day, dayIndex) => (
                    <View key={day.day}>
                        <SectionTitle first={dayIndex === 0}>{missedDayLabel(day.day, today)}</SectionTitle>
                        <VoidCard style={{ paddingHorizontal: t.space.lg, paddingVertical: t.space.xs }}>
                            {day.items.map((item, index) => (
                                <ListItem key={item.key} index={index}>
                                    <Pressable onPress={() => open(item)} accessibilityRole="button"
                                        accessibilityLabel={`${item.title}, missed. ${item.outcome}`}
                                        style={[styles.row, { gap: t.space.md, paddingVertical: t.space.md }, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.color.border }]}>
                                        {/* Round for a habit, squarer for a task, as on the timeline. */}
                                        <View style={[styles.mark, { borderRadius: item.kind === 'habit' ? t.radius.full : t.space.xs, borderColor: item.kind === 'task' ? TASK_COLOR : item.color || t.color.accent }]} />
                                        <View style={styles.flex}>
                                            <Text numberOfLines={1} style={[t.type.body, styles.strong, { color: t.color.textPrimary }]}>{item.title}</Text>
                                            <View style={[styles.outcome, { gap: t.space.xs }]}>
                                                <AppIcon name={TONE_ICON[item.tone]} size={13} color={toneColor(item.tone)} />
                                                <Text numberOfLines={2} style={[t.type.caption, styles.flex, { color: toneColor(item.tone) }]}>{item.outcome}</Text>
                                            </View>
                                        </View>
                                    </Pressable>
                                </ListItem>
                            ))}
                        </VoidCard>
                    </View>
                ))}
            </ScrollView>
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    hero: { alignItems: 'center' },
    heroValue: { fontFamily: FontFamily.bold, fontSize: 52, lineHeight: 58, letterSpacing: -2, fontVariant: ['tabular-nums'] },
    center: { textAlign: 'center' },
    strong: { fontFamily: FontFamily.semibold },
    flex: { flex: 1 },
    row: { flexDirection: 'row', alignItems: 'center' },
    mark: { width: 18, height: 18, borderWidth: 2 },
    outcome: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
});
