import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { MatteInput } from '@/components/ui/MatteInput';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { MicButton } from '@/components/ui/MicButton';
import { ThoughtRow } from '@/components/BrainDump/ThoughtRow';
import { Colors } from '@/theme/colors';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useDictation } from '@/hooks/useDictation';
import { emit } from '@/lib/appEvents';
import { addThought, getThoughts, moveItem, removeThought, reorderThoughts, restoreThought, updateThought, type Thought } from '@/lib/brainDump';
import { styles } from '@/styles/screens/brain-dump.styles';

const UNDO_MS = 4000;

/**
 * Somewhere to empty your head, with nothing in the way.
 *
 * Type and press return: it is saved and the cursor waits for the next one.
 * Or tap the mic and say it. Below, just the words. Swipe left to delete
 * (with a moment to undo), swipe right to turn it into a task, habit or goal,
 * tap to reword, hold and drag to move. Private: it stays on this phone.
 */
export default function BrainDumpScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { lightFeedback } = useHaptics();
    const [thoughts, setThoughts] = useState<Thought[]>([]);
    const [draft, setDraft] = useState('');
    const [undo, setUndo] = useState<{ thought: Thought; index: number } | null>(null);
    const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const input = useRef<React.ElementRef<typeof MatteInput>>(null);

    useEffect(() => { void getThoughts().then(setThoughts); }, []);

    // Talking fills the field; return (or the mic again) saves it like typing does.
    const base = useRef('');
    const dictation = useDictation(heard => setDraft(`${base.current}${base.current && heard ? ' ' : ''}${heard}`));
    const talk = () => { base.current = draft.trim(); void dictation.toggle(); };

    const save = async () => {
        const thought = await addThought(draft);
        if (!thought) return;
        lightFeedback();
        setDraft('');
        setThoughts(prev => [thought, ...prev]);
        input.current?.focus();
    };

    const remove = useCallback(async (thought: Thought) => {
        const index = thoughts.findIndex(item => item.id === thought.id);
        setThoughts(prev => prev.filter(item => item.id !== thought.id));
        await removeThought(thought.id);
        setUndo({ thought, index });
        if (undoTimer.current) clearTimeout(undoTimer.current);
        undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
    }, [thoughts]);

    const bringBack = async () => {
        if (!undo) return;
        await restoreThought(undo.thought, undo.index);
        setThoughts(await getThoughts());
        setUndo(null);
    };

    /** The thought becomes the real thing, and leaves the dump (undo brings it back). */
    const turnInto = (thought: Thought, kind: 'task' | 'habit' | 'goal') => {
        void remove(thought);
        router.back();
        setTimeout(() => {
            if (kind === 'habit') emit('show_quick_add', { prefillName: thought.text });
            else if (kind === 'goal') emit('show_goal_quick_add', { prefill: thought.text });
            else emit('show_task_form', { prefill: thought.text });
        }, 400);
    };

    const edit = async (thought: Thought, text: string) => {
        await updateThought(thought.id, text);
        setThoughts(await getThoughts());
    };

    // Hold and drag: rows measure themselves, and the drop lands where the
    // dragged row's middle ends up among the others.
    const heights = useRef<Record<string, number>>({});
    const measure = (id: string) => (event: LayoutChangeEvent) => { heights.current[id] = event.nativeEvent.layout.height; };
    const dropAt = (from: number, dy: number): number => {
        let to = from;
        let travelled = dy;
        if (dy > 0) {
            while (to < thoughts.length - 1 && travelled > (heights.current[thoughts[to + 1].id] ?? 48) / 2) {
                travelled -= heights.current[thoughts[to + 1].id] ?? 48;
                to += 1;
            }
        } else {
            while (to > 0 && -travelled > (heights.current[thoughts[to - 1].id] ?? 48) / 2) {
                travelled += heights.current[thoughts[to - 1].id] ?? 48;
                to -= 1;
            }
        }
        return to;
    };
    const drop = (from: number, dy: number) => {
        const to = dropAt(from, dy);
        if (to === from) return;
        const next = moveItem(thoughts, from, to);
        setThoughts(next);
        void reorderThoughts(next.map(item => item.id));
    };

    return (
        <SheetScreen title="Brain dump" onBack={() => router.back()}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
                    {/* Just a place to write: no box, no button. Return saves. */}
                    <View style={styles.composer}>
                        <MatteInput
                            bare
                            ref={input}
                            autoFocus
                            value={draft}
                            onChangeText={setDraft}
                            placeholder="What’s on your mind?"
                            placeholderTextColor={colors.textTertiary}
                            returnKeyType="done"
                            blurOnSubmit={false}
                            onSubmitEditing={() => void save()}
                            selectionColor={primary}
                            style={[styles.input, { color: colors.textPrimary }]}
                            accessibilityLabel="New thought. Press return to save it"
                        />
                        {dictation.available ? <MicButton listening={dictation.listening} onPress={talk} /> : null}
                    </View>

                    {thoughts.length === 0 ? (
                        <Text style={[styles.empty, { color: colors.textTertiary }]}>Empty head. Nice.</Text>
                    ) : thoughts.map((thought, index) => (
                        <View key={thought.id} style={index > 0 ? [styles.divider, { borderTopColor: colors.border }] : undefined}>
                            <ThoughtRow
                                thought={thought}
                                onDelete={() => void remove(thought)}
                                onTurnInto={kind => turnInto(thought, kind)}
                                onEdit={text => void edit(thought, text)}
                                onLayout={measure(thought.id)}
                                onDragStart={() => undefined}
                                onDragMove={() => undefined}
                                onDragEnd={dy => drop(index, dy)}
                            />
                        </View>
                    ))}
                </ScrollView>

                {undo ? (
                    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[styles.undo, { backgroundColor: colors.surfaceTertiary }]}>
                        <Text numberOfLines={1} style={[styles.undoText, { color: colors.textSecondary }]}>Deleted</Text>
                        <Text onPress={() => void bringBack()} style={[styles.undoAction, { color: primary }]} accessibilityRole="button">Undo</Text>
                    </Animated.View>
                ) : null}
            </KeyboardAvoidingView>
        </SheetScreen>
    );
}
