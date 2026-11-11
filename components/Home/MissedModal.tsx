import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { VoidModal } from '@/components/ui/VoidModal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { VoidCard } from '@/components/ui/VoidCard';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { CountUp, ListItem } from '@/components/ui/Motion';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import type { Miss, Missed, MissLevel } from '@/lib/missed';
import { toggleCompletion, type Habit } from '@/lib/habitsSQLite';
import { setTaskStatus } from '@/lib/tasks';
import { emit } from '@/lib/appEvents';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { TASK_COLOR } from '@/components/Roadmap/TaskItem';

// Headings only: the list says enough without a line of advice under each.
const SECTIONS: { level: MissLevel[]; title: string }[] = [
    { level: ['twice'], title: 'Missed twice or more' },
    { level: ['once'], title: 'Missed once' },
    { level: ['late', 'moved'], title: 'Tasks' },
];

/**
 * Only what is missed right now. Habits missed twice or more in a row first
 * (the ones to rescue), then those missed once, then late tasks. Tick one off
 * here and it leaves the list.
 */
export const MissedModal: React.FC<{ visible: boolean; onClose: () => void; missed: Missed; habits: Habit[] }> = ({ visible, onClose, missed, habits }) => {
    const t = useTokens();
    const { lightFeedback, successFeedback } = useHaptics();
    const total = missed.items.length;
    const verdict = missed.twice
        ? `${missed.twice} ${missed.twice === 1 ? 'habit' : 'habits'} missed twice or more in a row. That's where to start.`
        : total ? 'Nothing missed twice in a row.' : "Nothing missed. You're all caught up.";
    const tone = (level: MissLevel) => level === 'twice' ? t.color.danger : level === 'once' ? t.color.warning : t.color.textMuted;

    const open = (item: Miss) => {
        lightFeedback();
        onClose();
        if (item.kind === 'habit') router.push({ pathname: '/habit-detail', params: { habitId: item.id } });
        else router.push('/(root)/(tabs)/roadmap' as never);
    };
    // Done from here: it leaves the list, timed or not.
    const finish = (item: Miss) => {
        successFeedback();
        if (item.kind === 'habit') void toggleCompletion(item.id);
        else void setTaskStatus(item.id, 'done').then(() => emit('tasks_changed'));
    };

    return (
        <VoidModal visible={visible} onClose={onClose}>
            <ModalHeader title="Missed" />
            <ScrollView contentContainerStyle={{ paddingHorizontal: t.space.xl, paddingBottom: Spacing.bottom }} showsVerticalScrollIndicator={false}>
                <View style={[styles.hero, { gap: t.space.xs, paddingVertical: t.space.lg }]}>
                    <CountUp style={[styles.heroValue, { color: t.color.textPrimary }]} value={total} replay={visible} />
                    <Text style={[t.type.bodySmall, styles.center, { color: t.color.textMuted }]}>{verdict}</Text>
                </View>

                {SECTIONS.map(section => {
                    const rows = missed.items.filter(item => section.level.includes(item.level));
                    if (!rows.length) return null;
                    return (
                        <View key={section.title}>
                            <SectionTitle>{section.title}</SectionTitle>
                            <VoidCard style={{ paddingHorizontal: t.space.lg, paddingVertical: t.space.xs }}>
                                {rows.map((item, index) => (
                                    <ListItem key={item.key} index={index}>
                                        <View style={[styles.row, { gap: t.space.md, paddingVertical: t.space.md }, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.color.border }]}>
                                            {/* Round for a habit, squarer for a task, as everywhere; tap it to do it now. */}
                                            <Pressable onPress={() => finish(item)} hitSlop={t.space.sm} accessibilityRole="button" accessibilityLabel={`Mark ${item.title} done`}>
                                                <View style={[styles.mark, { borderRadius: item.kind === 'habit' ? t.radius.full : t.space.xs, borderColor: item.kind === 'task' ? TASK_COLOR : item.color || t.color.accent }]} />
                                            </Pressable>
                                            <Pressable style={styles.flex} onPress={() => open(item)} accessibilityRole="button" accessibilityLabel={`${item.title}. ${item.line}`}>
                                                <Text numberOfLines={1} style={[t.type.body, styles.strong, { color: t.color.textPrimary }]}>{item.title}</Text>
                                                <Text numberOfLines={2} style={[t.type.caption, { color: tone(item.level) }]}>{item.line}</Text>
                                            </Pressable>
                                            {item.level === 'twice' ? (
                                                <Text style={[t.type.bodySmall, styles.count, { color: t.color.danger }]}>{`${item.count}×`}</Text>
                                            ) : null}
                                        </View>
                                    </ListItem>
                                ))}
                            </VoidCard>
                        </View>
                    );
                })}
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
    mark: { width: 22, height: 22, borderWidth: 2 },
    count: { fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
});
