import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
// The gesture handler's Pressable: the rows these sit in are gesture-handler
// touchables, and a plain Pressable lost the tap to the row, opening the task.
import { Pressable } from 'react-native-gesture-handler';
import { MatteSurface } from '@/components/ui/MatteSurface';
import Animated, { Easing, FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { AppIcon } from '@/components/ui/AppIcon';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { emit } from '@/lib/appEvents';
import { updateTask, type Subtask } from '@/lib/tasks';

/**
 * A task's subtasks, folded away under it: a small "1/3" with a chevron that
 * opens the list, each subtask ticked right there. The same in the lists and
 * on the timeline.
 */
export function SubtaskToggle({ steps, open, onToggle, color }: { steps: Subtask[]; open: boolean; onToggle: () => void; color: string }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const done = steps.filter(step => step.done).length;
    return (
        <Pressable onPress={() => { selectionFeedback(); onToggle(); }} hitSlop={14}
            accessibilityRole="button" accessibilityState={{ expanded: open }}
            accessibilityLabel={`${done} of ${steps.length} subtasks done. ${open ? 'Hide' : 'Show'} them`}>
            {/* A small chip of its own, so it reads as something to tap and is big enough to hit. */}
            <MatteSurface radius={t.radius.full} level="control" style={styles.toggle}>
                <AppIcon name="list" size={11} color={t.color.textMuted} />
                <Text style={[t.type.caption, styles.count, { color: done === steps.length ? color : t.color.textMuted }]}>{`${done}/${steps.length}`}</Text>
                <AppIcon name={open ? 'chevron-up' : 'chevron-down'} size={11} color={t.color.textMuted} />
            </MatteSurface>
        </Pressable>
    );
}

export function SubtaskList({ taskId, steps, color, indent = 0 }: { taskId: string; steps: Subtask[]; color: string; indent?: number }) {
    const t = useTokens();
    const { selectionFeedback } = useHaptics();
    const tick = (id: string) => {
        selectionFeedback();
        void updateTask(taskId, { subtasks: steps.map(step => (step.id === id ? { ...step, done: !step.done } : step)) })
            .then(() => emit('tasks_changed')).catch(() => undefined);
    };
    return (
        <Animated.View entering={FadeIn.duration(180).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System)}
            exiting={FadeOut.duration(120).reduceMotion(ReduceMotion.System)} style={[styles.list, { paddingLeft: indent }]}>
            {steps.map(step => (
                <Pressable key={step.id} onPress={() => tick(step.id)} style={styles.row} hitSlop={{ top: 6, bottom: 6 }}
                    accessibilityRole="checkbox" accessibilityState={{ checked: step.done }} accessibilityLabel={step.title}>
                    <View style={[styles.box, { borderColor: step.done ? color : t.color.textSubtle, backgroundColor: step.done ? color : 'transparent' }]}>
                        {step.done ? <AppIcon name="checkmark" size={10} color={t.color.onAccent} /> : null}
                    </View>
                    {/* The app's small body text, a step quieter than the task above it. */}
                    <Text numberOfLines={2} style={[t.type.bodySmall, styles.title, { color: step.done ? t.color.textSubtle : t.color.textMuted, textDecorationLine: step.done ? 'line-through' : 'none' }]}>{step.title}</Text>
                </Pressable>
            ))}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    toggle: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, minHeight: 24 },
    count: { fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    list: { paddingTop: Spacing.xs },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 32 },
    box: { width: 16, height: 16, borderRadius: 4, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    title: { flex: 1 },
});
