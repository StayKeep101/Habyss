import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { MatteInput } from '@/components/ui/MatteInput';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useNavigation, useRouter } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { MicButton } from '@/components/ui/MicButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppButton } from '@/components/ui/AppButton';
import { IconButton } from '@/components/ui/IconButton';
import { ThoughtRow } from '@/components/BrainDump/ThoughtRow';
import { ThoughtActions, type ThoughtAction } from '@/components/BrainDump/ThoughtActions';
import { MorphMenu } from '@/components/ui/MorphMenu';
import { Colors } from '@/theme/colors';
import { textOn } from '@/theme/tokens';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useDictation } from '@/hooks/useDictation';
import { tidySpeech } from '@/lib/voiceClean';
import { getWeekStart, reviewTime } from '@/lib/weekStart';
import { emit } from '@/lib/appEvents';
import { createTask } from '@/lib/tasks';
import { addHabit } from '@/lib/habitsSQLite';
import { parseHabitText, parsedToHabit } from '@/lib/habitParser';
import { queueGoals } from '@/lib/goalQueue';
import { copyText } from '@/lib/copyText';
import { localDateKey } from '@/lib/habitSchedule';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { addThought, getThoughts, moveItem, removeThought, reorderThoughts, restoreThought, updateThought, type Thought } from '@/lib/brainDump';
import { styles } from '@/styles/screens/brain-dump.styles';

const UNDO_MS = 4000;

/**
 * Somewhere to empty your head, with nothing in the way.
 *
 * The line to write on sits on the keyboard: type and press send (or the
 * arrow), and the cursor waits for the next one. With nothing typed, the mic
 * is there instead — tap it and say it. Below, just the words. Swipe left to delete
 * (with a moment to undo), tap to reword, hold and drag to move. Holding a
 * thought and letting go opens everything that can be done to it: copy, turn
 * it into a task, habit or goal, file it under a goal, delete. Select (top
 * right) picks several, or all, and every one of those works on them together.
 * Private: it stays on this phone.
 */
export default function BrainDumpScreen() {
    const router = useRouter();
    const { theme } = useTheme();
    const colors = Colors[theme];
    const { primary } = useAccentGradient();
    const { lightFeedback } = useHaptics();
    const [thoughts, setThoughts] = useState<Thought[]>([]);
    const [draft, setDraft] = useState('');
    const [undo, setUndo] = useState<{ thought: Thought; index: number; said: string } | null>(null);
    const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const input = useRef<React.ElementRef<typeof MatteInput>>(null);

    useEffect(() => { void getThoughts().then(setThoughts); }, []);
    // When this week's thoughts clear: the last evening of the week (Settings).
    const [clearsOn, setClearsOn] = useState('');
    useEffect(() => {
        void getWeekStart().then(start => setClearsOn(reviewTime(new Date(), start).toLocaleDateString(undefined, { weekday: 'long' })));
    }, []);

    // Talking fills the field; return (or the mic again) saves it like typing does.
    const base = useRef('');
    const join = (heard: string) => `${base.current}${base.current && heard ? ' ' : ''}${heard}`;
    // Live while talking; tidied once finished (fillers out, a ramble condensed).
    const dictation = useDictation(heard => setDraft(join(heard)), heard => { void tidySpeech(heard).then(clean => setDraft(join(clean))); });
    const talk = () => { base.current = draft.trim(); void dictation.toggle(); };

    const save = async () => {
        const thought = await addThought(draft);
        if (!thought) return;
        lightFeedback();
        setDraft('');
        setThoughts(prev => [thought, ...prev]);
        // Sent: the keyboard goes down, so the list can be seen.
        input.current?.blur();
        Keyboard.dismiss();
    };

    const remove = useCallback(async (thought: Thought, said = 'Deleted') => {
        const index = thoughts.findIndex(item => item.id === thought.id);
        setThoughts(prev => prev.filter(item => item.id !== thought.id));
        await removeThought(thought.id);
        setUndo({ thought, index, said });
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

    // Choosing several: tap ticks, Select all, then hold one to act on them all.
    const [selecting, setSelecting] = useState(false);
    const [picked, setPicked] = useState<Set<string>>(new Set());
    const stopSelecting = () => { setSelecting(false); setPicked(new Set()); };
    const togglePicked = (id: string) => setPicked(current => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const allPicked = thoughts.length > 0 && picked.size === thoughts.length;

    /** Several thoughts out of the dump at once, kept in their order. */
    const removeMany = async (list: Thought[]) => {
        const ids = new Set(list.map(item => item.id));
        setThoughts(prev => prev.filter(item => !ids.has(item.id)));
        for (const item of list) await removeThought(item.id);
    };

    /** Each thought a task of its own, under a goal when one is given. */
    const intoTasks = async (list: Thought[], goalId?: string) => {
        let made = 0;
        for (const item of list) if (await createTask({ title: item.text, ...(goalId ? { goalId } : {}) })) made++;
        if (!made) return;
        emit('tasks_changed');
        lightFeedback();
        await removeMany(list.slice(0, made));
        stopSelecting();
    };

    /** Each thought a habit of its own, read the way a typed habit is ("run 3 times a week"). */
    const intoHabits = async (list: Thought[]) => {
        const today = localDateKey(new Date());
        const made: Thought[] = [];
        for (const item of list) {
            try { if (await addHabit(parsedToHabit(parseHabitText(item.text), today))) made.push(item); } catch { /* the rest still go */ }
        }
        if (!made.length) return;
        emit('habit_updated', {});
        lightFeedback();
        await removeMany(made);
        stopSelecting();
    };

    /** Goals need a target and dates, so each opens the goal sheet in turn. */
    const intoGoals = (list: Thought[]) => {
        void removeMany(list);
        stopSelecting();
        router.back();
        queueGoals(list.map(item => item.text));
    };

    /** On the clipboard, one thought per line. */
    const copy = async (list: Thought[]) => {
        const copied = await copyText(list.map(item => item.text).join('\n'));
        if (copied) { lightFeedback(); setNotice(list.length === 1 ? 'Copied' : `Copied ${list.length}`); stopSelecting(); }
        else setNotice('Copying needs the latest app build');
    };
    const [notice, setNotice] = useState<string | null>(null);
    useEffect(() => {
        if (!notice) return;
        const hide = setTimeout(() => setNotice(null), 1600);
        return () => clearTimeout(hide);
    }, [notice]);

    const goals = useGoalsInsights().habits.filter(habit => habit.isGoal && !habit.isArchived);

    // The sheet a held thought opens (or the selection's "Add to a goal").
    const [acting, setActing] = useState<{ list: Thought[]; goals: boolean } | null>(null);

    /** One of the sheet's tiles, for one thought or for every selected one. */
    const act = (list: Thought[], action: ThoughtAction) => {
        setActing(null);
        const one = list.length === 1 ? list[0] : null;
        if (action === 'copy') { void copy(list); return; }
        if (one && !selecting) { setTimeout(() => turnInto(one, action), 250); return; }
        if (action === 'task') void intoTasks(list);
        else if (action === 'habit') void intoHabits(list);
        else intoGoals(list);
    };

    /** Held and let go: that thought, or while selecting, every ticked one with it. */
    const held = (thought: Thought) => {
        const list = selecting
            ? thoughts.filter(item => picked.has(item.id) || item.id === thought.id)
            : [thought];
        if (selecting) setPicked(new Set(list.map(item => item.id)));
        setActing({ list, goals: false });
    };
    const pickedList = thoughts.filter(item => picked.has(item.id));

    const deletePicked = () => {
        const list = thoughts.filter(item => picked.has(item.id));
        if (!list.length) return;
        Alert.alert(`Delete ${list.length} thought${list.length === 1 ? '' : 's'}?`, undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => { void removeMany(list); stopSelecting(); } },
        ]);
    };

    const edit = async (thought: Thought, text: string) => {
        await updateThought(thought.id, text);
        setThoughts(await getThoughts());
    };

    // Hold and drag: rows measure themselves, and the drop lands where the
    // dragged row's middle ends up among the others.
    // One text box at a time: while a thought is reworded in place, the
    // field for a new one steps aside.
    const [editingId, setEditingId] = useState<string | null>(null);
    // The keyboard comes up when the page opens, not again after each edit.
    // (autoFocus is lost while the modal is still sliding up and the + menu
    // folding away), so the field is focused once the page has arrived, with
    // a timer in case that moment is never announced.
    const navigation = useNavigation();
    useEffect(() => {
        let done = false;
        const ready = () => { if (!done) { done = true; input.current?.focus(); } };
        const arrived = navigation.addListener('transitionEnd' as never, (event: { data?: { closing?: boolean } }) => { if (!event.data?.closing) ready(); });
        const fallback = setTimeout(ready, 600);
        return () => { arrived(); clearTimeout(fallback); };
    }, [navigation]);
    const heights = useRef<Record<string, number>>({});
    const measure = (id: string) => (event: LayoutChangeEvent) => { heights.current[id] = event.nativeEvent.layout.height; };
    // Where each row sits in the list, so rewording one brings it up above
    // the keyboard instead of leaving the cursor hidden underneath.
    const scroller = useRef<ScrollView>(null);
    const tops = useRef<Record<string, number>>({});
    useEffect(() => {
        if (!editingId) return;
        const bring = () => scroller.current?.scrollTo({ y: Math.max(0, (tops.current[editingId] ?? 0) - 12), animated: true });
        const shown = Keyboard.addListener('keyboardDidShow', bring);
        const soon = setTimeout(bring, 50);
        return () => { shown.remove(); clearTimeout(soon); };
    }, [editingId]);
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
        <SheetScreen title="Brain dump" onBack={() => router.back()}
            rightSlot={thoughts.length ? (
                <IconButton icon={selecting ? 'close' : 'checkmark-circle-outline'} label={selecting ? 'Stop selecting' : 'Select'}
                    onPress={() => { lightFeedback(); if (selecting) stopSelecting(); else { input.current?.blur(); setSelecting(true); } }} />
            ) : undefined}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
                <ScrollView ref={scroller} contentContainerStyle={[styles.content, editingId !== null && styles.contentEditing]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
                    {selecting ? (
                        <View style={styles.selectBar}>
                            <Text style={[styles.clears, styles.flex, { color: colors.textTertiary }]}>
                                {picked.size ? `${picked.size} selected` : 'Tap thoughts to select them'}
                            </Text>
                            <Text onPress={() => { lightFeedback(); setPicked(allPicked ? new Set() : new Set(thoughts.map(item => item.id))); }}
                                style={[styles.selectAll, { color: primary }]} accessibilityRole="button">{allPicked ? 'Deselect all' : 'Select all'}</Text>
                        </View>
                    ) : thoughts.length > 0 && clearsOn ? (
                        <Text style={[styles.clears, { color: colors.textTertiary }]}>Clears {clearsOn} night · hold a thought to turn it into something</Text>
                    ) : null}
                    {thoughts.length === 0 ? (
                        <Text style={[styles.empty, { color: colors.textTertiary }]}>Empty head. Nice.</Text>
                    ) : thoughts.map((thought, index) => (
                        <View key={thought.id} style={index > 0 ? [styles.divider, { borderTopColor: colors.border }] : undefined}
                            onLayout={event => { tops.current[thought.id] = event.nativeEvent.layout.y; }}>
                            <ThoughtRow
                                thought={thought}
                                selecting={selecting}
                                selected={picked.has(thought.id)}
                                onToggle={() => togglePicked(thought.id)}
                                onHold={() => held(thought)}
                                onDone={() => void remove(thought, 'Done')}
                                onDelete={() => void remove(thought)}
                                onEdit={text => void edit(thought, text)}
                                onEditingChange={editing => setEditingId(current => editing ? thought.id : current === thought.id ? null : current)}
                                onLayout={measure(thought.id)}
                                onDragStart={() => undefined}
                                onDragMove={() => undefined}
                                onDragEnd={dy => drop(index, dy)}
                            />
                        </View>
                    ))}
                </ScrollView>

                {/* Docked on the keyboard: write, then the arrow (or return) saves;
                    with nothing written, the mic is there instead. */}
                {selecting ? (
                    <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
                        <AppButton label="Copy" icon="copy" disabled={!picked.size}
                            onPress={() => void copy(pickedList)} style={styles.flex} />
                        <AppButton label="Delete" icon="trash" variant="danger" disabled={!picked.size}
                            onPress={deletePicked} style={styles.flex} />
                        {/* Everything else, in the app's own menu that grows out of the button. */}
                        {picked.size ? (
                            <MorphMenu label="More actions" title={`${picked.size} selected`} titleIcon="checkmark" diameter={54} items={[
                                { label: picked.size === 1 ? 'Make a task' : `Make ${picked.size} tasks`, icon: 'checkbox-outline', onPress: () => act(pickedList, 'task') },
                                { label: picked.size === 1 ? 'Make a habit' : `Make ${picked.size} habits`, icon: 'repeat', onPress: () => act(pickedList, 'habit') },
                                { label: picked.size === 1 ? 'Make a goal' : `Make ${picked.size} goals`, icon: 'flag-outline', onPress: () => act(pickedList, 'goal') },
                                { label: 'Add to a goal', icon: 'flag', onPress: () => setActing({ list: pickedList, goals: true }) },
                            ]} />
                        ) : null}
                    </View>
                ) : editingId === null ? (
                <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
                    <MatteInput
                        bare
                        ref={input}
                        multiline
                        value={draft}
                        onChangeText={setDraft}
                        placeholder="What’s on your mind?"
                        placeholderTextColor={colors.textTertiary}
                        returnKeyType="send"
                        submitBehavior="submit"
                        onSubmitEditing={() => void save()}
                        selectionColor={primary}
                        style={[styles.input, { color: colors.textPrimary }]}
                        accessibilityLabel="New thought"
                    />
                    {draft.trim() && !dictation.listening ? (
                        <Pressable onPress={() => void save()} accessibilityRole="button" accessibilityLabel="Save thought"
                            style={[styles.send, { backgroundColor: primary }]}>
                            <AppIcon name="arrow-up" size={18} color={textOn(primary)} />
                        </Pressable>
                    ) : dictation.available ? (
                        <MicButton listening={dictation.listening} onPress={talk} />
                    ) : null}
                </View>
                ) : null}
                <ThoughtActions visible={!!acting} count={acting?.list.length ?? 0}
                    caption={acting?.list.length === 1 ? acting.list[0].text : undefined}
                    goals={goals} startWithGoals={acting?.goals}
                    onClose={() => setActing(null)}
                    onAction={action => acting && act(acting.list, action)}
                    onAddToGoal={goalId => { const list = acting?.list ?? []; setActing(null); void intoTasks(list, goalId); }} />
                {notice ? (
                    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[styles.undo, { backgroundColor: colors.surfaceTertiary }]}>
                        <Text numberOfLines={1} style={[styles.undoText, { color: colors.textSecondary }]}>{notice}</Text>
                    </Animated.View>
                ) : null}
                {undo ? (
                    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[styles.undo, { backgroundColor: colors.surfaceTertiary }]}>
                        <Text numberOfLines={1} style={[styles.undoText, { color: colors.textSecondary }]}>{undo.said}</Text>
                        <Text onPress={() => void bringBack()} style={[styles.undoAction, { color: primary }]} accessibilityRole="button">Undo</Text>
                    </Animated.View>
                ) : null}
            </KeyboardAvoidingView>
        </SheetScreen>
    );
}
