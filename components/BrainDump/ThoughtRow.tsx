import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { MatteInput } from '@/components/ui/MatteInput';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, LinearTransition, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SwipeRow } from '@/components/ui/SwipeRow';
import { AppIcon } from '@/components/ui/AppIcon';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import type { Thought } from '@/lib/brainDump';

const timeOf = (iso: string) => {
    const date = new Date(iso);
    const today = new Date().toDateString() === date.toDateString();
    return today
        ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
        : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/**
 * One thought: just its words. Swipe left to delete it, swipe right to turn
 * it into a task, habit or goal, tap to reword it, hold and drag to move it.
 */
export function ThoughtRow({ thought, onDelete, onTurnInto, onEdit, onEditingChange, onLayout, onDragStart, onDragMove, onDragEnd }: {
    thought: Thought;
    onDelete: () => void;
    onTurnInto: (kind: 'task' | 'habit' | 'goal') => void;
    onEdit: (text: string) => void;
    /** Rewording in place starts or ends, so the page can hide its own field. */
    onEditingChange?: (editing: boolean) => void;
    onLayout: (event: LayoutChangeEvent) => void;
    onDragStart: () => void;
    onDragMove: (dy: number) => void;
    onDragEnd: (dy: number) => void;
}) {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { selectionFeedback, mediumFeedback } = useHaptics();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(thought.text);
    const [choosing, setChoosing] = useState(false);

    // Hold, then drag: the row lifts and follows the finger.
    const lift = useSharedValue(0);
    const dragY = useSharedValue(0);
    const drag = Gesture.Pan()
        .activateAfterLongPress(280)
        .onStart(() => { lift.value = withSpring(1); runOnJS(mediumFeedback)(); runOnJS(onDragStart)(); })
        .onUpdate(event => { dragY.value = event.translationY; runOnJS(onDragMove)(event.translationY); })
        .onEnd(event => { runOnJS(onDragEnd)(event.translationY); })
        .onFinalize(() => { dragY.value = 0; lift.value = withSpring(0); });
    const lifted = useAnimatedStyle(() => ({
        transform: [{ translateY: dragY.value }, { scale: 1 + lift.value * 0.02 }],
        zIndex: lift.value > 0 ? 10 : 0,
        shadowOpacity: lift.value * 0.25,
    }));

    const finish = () => {
        setEditing(false);
        onEditingChange?.(false);
        if (draft.trim() !== thought.text) onEdit(draft);
    };

    return (
        <Animated.View layout={LinearTransition.duration(200)} entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)}
            onLayout={onLayout} style={[styles.shadow, lifted]}>
            <GestureDetector gesture={drag}>
                <View>
                    <SwipeRow
                        left={{ icon: 'arrow-redo', label: 'Turn into', color: primary, onPress: () => { selectionFeedback(); setChoosing(value => !value); } }}
                        right={[{ icon: 'trash', label: 'Delete', color: colors.error, onPress: onDelete, destructive: true }]}
                    >
                        <View style={[styles.row, { backgroundColor: colors.background }]}>
                            {editing ? (
                                <MatteInput
                                    bare
                                    autoFocus
                                    multiline
                                    value={draft}
                                    onChangeText={setDraft}
                                    onBlur={finish}
                                    blurOnSubmit
                                    returnKeyType="done"
                                    onSubmitEditing={finish}
                                    style={[styles.text, styles.input, { color: colors.textPrimary }]}
                                    accessibilityLabel="Edit thought"
                                />
                            ) : (
                                <Pressable onPress={() => { setDraft(thought.text); setEditing(true); onEditingChange?.(true); }} style={styles.flex}
                                    accessibilityHint="Swipe left to delete, right to turn it into something, hold to move">
                                    <Text style={[styles.text, { color: colors.textPrimary }]}>{thought.text}</Text>
                                </Pressable>
                            )}
                            <Text style={[styles.time, { color: colors.textTertiary }]}>{timeOf(thought.createdAt)}</Text>
                        </View>
                    </SwipeRow>
                </View>
            </GestureDetector>
            {choosing ? (
                <Animated.View entering={FadeIn.duration(150)} style={styles.choices}>
                    {([['task', 'checkbox-outline', 'Task'], ['habit', 'repeat', 'Habit'], ['goal', 'flag-outline', 'Goal']] as const).map(([kind, icon, label]) => (
                        <Pressable key={kind} onPress={() => { selectionFeedback(); setChoosing(false); onTurnInto(kind); }}
                            style={[styles.choice, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel={`Turn into a ${label.toLowerCase()}`}>
                            <AppIcon name={icon} size={14} color={primary} />
                            <Text style={[styles.choiceText, { color: colors.textPrimary }]}>{label}</Text>
                        </Pressable>
                    ))}
                </Animated.View>
            ) : null}
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    shadow: { shadowColor: '#000', shadowRadius: 12, shadowOffset: { width: 0, height: 6 } }, // ui-allow: drag lift
    flex: { flex: 1 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.md },
    text: { flex: 1, fontFamily: FontFamily.regular, fontSize: 17, lineHeight: 24 },
    input: { padding: 0 },
    time: { fontFamily: FontFamily.regular, fontSize: 11, paddingTop: 4 },
    choices: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.md },
    choice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 2, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
    choiceText: { fontFamily: FontFamily.medium, fontSize: 13 },
});
