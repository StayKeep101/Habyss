import React, { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { MatteInput } from '@/components/ui/MatteInput';
// The gesture handler's Pressable, so a swipe that starts on the words
// cancels the tap instead of also opening the thought for editing.
import { Gesture, GestureDetector, Pressable } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, LinearTransition, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SwipeRow } from '@/components/ui/SwipeRow';
import { AppIcon } from '@/components/ui/AppIcon';
import { CheckPop } from '@/components/ui/CheckPop';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { textOn } from '@/theme/tokens';
import { useHaptics } from '@/hooks/useHaptics';
import type { Thought } from '@/lib/brainDump';

const timeOf = (iso: string) => {
    const date = new Date(iso);
    const today = new Date().toDateString() === date.toDateString();
    return today
        ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
        : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** A hold is a finger kept still: any more movement than this is a swipe or a drag. */
const STILL = 6;
/** Long enough that a slow swipe never counts as a hold. */
const HOLD_MS = 420;

/**
 * One thought: just its words. Swipe left to delete it, tap to reword it.
 * Hold it and let go to turn it into a task, habit or goal (the only way
 * to); hold and drag to move it. While selecting, a tap ticks it instead.
 */
export function ThoughtRow({ thought, selecting, selected, onToggle, onHold, onDone, onDelete, onEdit, onEditingChange, onLayout, onDragStart, onDragMove, onDragEnd }: {
    thought: Thought;
    /** Choosing several thoughts: a tap ticks this one. */
    selecting: boolean;
    selected: boolean;
    onToggle: () => void;
    /** Held and let go without moving: the menu for turning it into something. */
    onHold: () => void;
    /** The circle beside it, tapped: dealt with, so it goes. */
    onDone: () => void;
    onDelete: () => void;
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

    // Hold, then drag: the row lifts and follows the finger.
    const lift = useSharedValue(0);
    const dragY = useSharedValue(0);
    // Whether this hold turned into a drag; if not, letting go opens the menu.
    const moved = useSharedValue(false);
    const drag = Gesture.Pan()
        .activateAfterLongPress(HOLD_MS)
        .onStart(() => { moved.value = true; lift.value = withSpring(1); runOnJS(onDragStart)(); })
        .onUpdate(event => { dragY.value = event.translationY; runOnJS(onDragMove)(event.translationY); })
        .onEnd(event => { runOnJS(onDragEnd)(event.translationY); })
        .onFinalize(() => { dragY.value = 0; lift.value = withSpring(0); });
    const hold = Gesture.LongPress()
        .minDuration(HOLD_MS)
        .maxDistance(STILL)
        .onBegin(() => { moved.value = false; })
        .onStart(() => { runOnJS(mediumFeedback)(); })
        .onEnd((_event, success) => { if (success && !moved.value) runOnJS(onHold)(); });
    const gesture = Gesture.Simultaneous(drag, hold);
    const lifted = useAnimatedStyle(() => ({
        transform: [{ translateY: dragY.value }, { scale: 1 + lift.value * 0.02 }],
        zIndex: lift.value > 0 ? 10 : 0,
        shadowOpacity: lift.value * 0.25,
    }));

    // Tapped circle: it fills, a beat, then the thought fades out and the
    // ones under it slide up into its place.
    const [ticked, setTicked] = useState(false);
    const tick = () => {
        if (ticked) return;
        selectionFeedback();
        setTicked(true);
        setTimeout(onDone, 380);
    };
    const on = selecting ? selected : ticked;

    const finish = () => {
        setEditing(false);
        onEditingChange?.(false);
        if (draft.trim() !== thought.text) onEdit(draft);
    };

    return (
        <Animated.View layout={LinearTransition.duration(240)} entering={FadeIn.duration(180)} exiting={FadeOut.duration(260)}
            onLayout={onLayout} style={[styles.shadow, lifted]}>
            <GestureDetector gesture={gesture}>
                <View>
                    <SwipeRow right={selecting ? undefined : [{ icon: 'trash', label: 'Delete', color: colors.error, onPress: onDelete, destructive: true }]}>
                        <View style={[styles.row, { backgroundColor: colors.background }]}>
                            {/* The circle: tap it and the thought is done and goes; while
                                selecting, it is the tick that picks it. */}
                            <Pressable onPress={selecting ? () => { selectionFeedback(); onToggle(); } : tick} hitSlop={10}
                                accessibilityRole="checkbox" accessibilityState={{ checked: on }}
                                accessibilityLabel={selecting ? 'Select thought' : 'Done, remove thought'}>
                                <CheckPop active={on} color={primary} size={22}>
                                    <View style={[styles.tick, { borderColor: on ? primary : colors.textTertiary, backgroundColor: on ? primary : undefined }]}>
                                        {on ? <AppIcon name="checkmark" size={14} color={textOn(primary)} /> : null}
                                    </View>
                                </CheckPop>
                            </Pressable>
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
                                <Pressable
                                    onPress={() => {
                                        if (selecting) { selectionFeedback(); onToggle(); return; }
                                        setDraft(thought.text); setEditing(true); onEditingChange?.(true);
                                    }}
                                    // Held, the menu opens instead: never a reword as well.
                                    onLongPress={() => undefined}
                                    delayLongPress={HOLD_MS}
                                    style={styles.flex}
                                    accessibilityRole={selecting ? 'checkbox' : undefined}
                                    accessibilityState={selecting ? { checked: selected } : undefined}
                                    accessibilityHint={selecting ? 'Tap to select. Hold to turn the selected thoughts into something' : 'Hold to turn it into a task, habit or goal, or hold and drag to move. Swipe left to delete'}>
                                    <Text style={[styles.text, { color: ticked ? colors.textTertiary : colors.textPrimary }, ticked && styles.struck]}>{thought.text}</Text>
                                </Pressable>
                            )}
                            <Text style={[styles.time, { color: colors.textTertiary }]}>{timeOf(thought.createdAt)}</Text>
                        </View>
                    </SwipeRow>
                </View>
            </GestureDetector>
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
    struck: { textDecorationLine: 'line-through' },
    tick: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
