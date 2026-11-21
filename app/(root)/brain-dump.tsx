import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
import { MatteInput } from '@/components/ui/MatteInput';
import { isTablet } from '@/lib/orientation';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useNavigation, useRouter } from 'expo-router';
import { SheetScreen } from '@/components/ui/SheetScreen';
import { MicButton } from '@/components/ui/MicButton';
import { AppIcon } from '@/components/ui/AppIcon';
import { AppButton } from '@/components/ui/AppButton';
import { IconButton } from '@/components/ui/IconButton';
import { ThoughtRow } from '@/components/BrainDump/ThoughtRow';
import { NewThought } from '@/components/BrainDump/NewThought';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { ThoughtActions, type ThoughtAction } from '@/components/BrainDump/ThoughtActions';
import { MorphMenu } from '@/components/ui/MorphMenu';
import { shareThoughts } from '@/lib/thoughtExport';
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
import { SortThoughtSheet } from '@/components/BrainDump/SortThoughtSheet';
import { copyText } from '@/lib/copyText';
import { localDateKey } from '@/lib/habitSchedule';
import { useGoalsInsights } from '@/hooks/useGoalInsights';
import { addThought, getThoughts, removeThought, reorderThoughts, restoreThought, updateThought, type Thought } from '@/lib/brainDump';
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
    const { lightFeedback, selectionFeedback } = useHaptics();
    const [thoughts, setThoughts] = useState<Thought[]>([]);
    const [draft, setDraft] = useState('');
    const [undo, setUndo] = useState<{ thought: Thought; index: number; said: string } | null>(null);
    const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const input = useRef<React.ElementRef<typeof MatteInput>>(null);

    useEffect(() => { void getThoughts().then(setThoughts); }, []);
    const thoughtsRef = useRef<Thought[]>([]);
    useEffect(() => { thoughtsRef.current = thoughts; }, [thoughts]);
    // When this week's thoughts clear: the last evening of the week (Settings).
    const [clearsOn, setClearsOn] = useState('');
    useEffect(() => {
        void getWeekStart().then(start => setClearsOn(reviewTime(new Date(), start).toLocaleDateString(undefined, { weekday: 'long' })));
    }, []);

    // Talking fills the field; return (or the mic again) saves it like typing does.
    const base = useRef('');
    const join = (heard: string) => `${base.current}${base.current && heard ? ' ' : ''}${heard}`;
    // What the mic last wrote, so an edit of your own can be told apart from it.
    const written = useRef<string | null>(null);
    const write = (value: string) => { written.current = value; setDraft(value); };
    // Live while talking; tidied once finished (fillers out, a ramble condensed).
    const dictation = useDictation(heard => write(join(heard)), heard => {
        void tidySpeech(heard).then(clean => { if (written.current !== null) write(join(clean)); written.current = null; });
    });
    // Typed or deleted while it listens: your edit stays, the mic stops.
    useEffect(() => {
        if (written.current !== null && dictation.listening && draft !== written.current) { written.current = null; dictation.cancel(); }
    }, [draft, dictation]);
    const talk = () => { base.current = draft.trim(); written.current = dictation.listening ? written.current : draft; void dictation.toggle(); };

    // The line under the last thought: tapped open, it is where a new one is written.
    const [adding, setAdding] = useState(false);
    const save = async () => {
        const thought = await addThought(draft);
        if (!thought) return;
        lightFeedback();
        setDraft('');
        // It lands where it was written: at the end, under the last one. The line stays open for the next.
        setThoughts(prev => {
            const next = [...prev.filter(item => item.id !== thought.id), thought];
            void reorderThoughts(next.map(item => item.id));
            return next;
        });
        setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
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
        // Read like a typed task: "essay due by Friday, hard, 2 hours" keeps
        // its deadline, difficulty and length, and loses them from the title.
        const { parseTaskText } = require('@/lib/taskParser') as typeof import('@/lib/taskParser');
        for (const item of list) {
            const read = parseTaskText(item.text);
            const made_ = await createTask({
                title: read.title || item.text, dueDate: read.dueDate, dueTime: read.dueTime, estimatedMinutes: read.estimatedMinutes,
                priority: read.priority, deadline: read.deadline, difficulty: read.difficulty,
                flexible: read.dueTime ? read.flexible : undefined, ...(goalId ? { goalId } : {}),
            });
            if (made_) made++;
        }
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

    /**
     * A thought sorted into its pieces (lib/thoughtSplit.ts): tasks and habits
     * made at once, goals opened one after another, notes kept as thoughts.
     */
    const [sorting, setSorting] = useState<Thought | null>(null);
    const createSorted = async (pieces: { text: string; kind: 'task' | 'habit' | 'goal' | 'note' }[]) => {
        const thought = sorting;
        setSorting(null);
        if (!thought) return;
        const asThoughts = (kind: string) => pieces.filter(piece => piece.kind === kind)
            .map((piece, index) => ({ id: `${thought.id}:${kind}:${index}`, text: piece.text, createdAt: thought.createdAt }));
        const notes = pieces.filter(piece => piece.kind === 'note');
        const tasks = asThoughts('task');
        const habits = asThoughts('habit');
        const goals = asThoughts('goal');
        if (tasks.length) await intoTasks(tasks);
        if (habits.length) await intoHabits(habits);
        // The thought itself goes once everything in it has a home; notes stay as thoughts.
        if (tasks.length || habits.length || goals.length) {
            await remove(thought, 'Sorted');
            for (const note of notes) await addThought(note.text);
            setThoughts(await getThoughts());
        }
        if (goals.length) intoGoals(goals);
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

    const insights = useGoalsInsights();
    const goals = insights.habits.filter(habit => habit.isGoal && !habit.isArchived);
    // Tasks a thought can go under as a subtask: the open ones, soonest first.
    const openTasks = insights.tasks.filter(task => task.status === 'open')
        .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'))
        .map(task => ({ id: task.id, title: task.title }));

    /** Each thought a subtask of that task, at the end of its list. */
    const intoSubtasks = async (list: Thought[], taskId: string) => {
        const task = insights.tasks.find(item => item.id === taskId);
        if (!task) return;
        const { updateTask } = require('@/lib/tasks') as typeof import('@/lib/tasks');
        const added = list.map((item, index) => ({ id: `${Date.now().toString(36)}-${index}`, title: item.text.trim(), done: false }));
        await updateTask(taskId, { subtasks: [...(task.subtasks ?? []), ...added] });
        emit('tasks_changed');
        lightFeedback();
        setNotice(list.length === 1 ? `Added to ${task.title}` : `${list.length} added to ${task.title}`);
        await removeMany(list);
        stopSelecting();
    };

    // The sheet a held thought opens (or the selection's "Add to a goal").
    const [acting, setActing] = useState<{ list: Thought[]; goals: boolean } | null>(null);

    /** One of the sheet's tiles, for one thought or for every selected one. */
    const act = (list: Thought[], action: ThoughtAction) => {
        setActing(null);
        const one = list.length === 1 ? list[0] : null;
        if (action === 'copy') { void copy(list); return; }
        if (action === 'share') { void shareThoughts(list); return; }
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
        // An empty dump opens on its line, ready to write; otherwise the list, untouched.
        const ready = () => { if (!done) { done = true; if (!thoughtsRef.current.length) setAdding(true); } };
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
    // Two fingers dragged down the list pick every thought they pass, as in Mail.
    const scrollY = useRef(0);
    const [scrollLocked, setScrollLocked] = useState(false);
    const sweep = useRef<{ base: Set<string>; from: number; last: number } | null>(null);
    const rowAt = (y: number): number => {
        const content = y + scrollY.current;
        let found = -1;
        thoughts.forEach((thought, index) => {
            const top = tops.current[thought.id] ?? 0;
            if (content >= top) found = index;
        });
        return Math.max(0, Math.min(thoughts.length - 1, found));
    };
    const sweepStart = (y: number) => {
        if (!thoughts.length) return;
        input.current?.blur();
        setAdding(false);
        setSelecting(true);
        setScrollLocked(true);
        const from = rowAt(y);
        sweep.current = { base: new Set(picked), from, last: from };
        selectionFeedback();
        setPicked(new Set([...picked, thoughts[from].id]));
    };
    const sweepMove = (y: number) => {
        const state = sweep.current;
        if (!state) return;
        const at = rowAt(y);
        if (at === state.last) return;
        state.last = at;
        selectionFeedback();
        const [lo, hi] = [Math.min(state.from, at), Math.max(state.from, at)];
        setPicked(new Set([...state.base, ...thoughts.slice(lo, hi + 1).map(item => item.id)]));
    };
    const sweepEnd = () => { sweep.current = null; setScrollLocked(false); };
    // Gesture callbacks run on touches, not while drawing (the lint can't tell; no compiler here).
    const twoFingers = Gesture.Pan().minPointers(2).maxPointers(2)
        .onStart(event => { runOnJS(sweepStart)(event.y); })
        .onUpdate(event => { runOnJS(sweepMove)(event.y); })
        .onFinalize(() => { runOnJS(sweepEnd)(); });

    return (
        <SheetScreen title="Brain dump" onBack={() => router.back()}
            rightSlot={thoughts.length ? (
                <View style={styles.headerActions}>
                    {/* Everything, by day, out to Notion, Notes, Obsidian or anywhere. */}
                    {selecting ? null : <IconButton icon="share-outline" label="Export all thoughts" onPress={() => { lightFeedback(); void shareThoughts(thoughts); }} />}
                    {/* Selecting starts with two fingers dragged down the list; this ends it. */}
                    {selecting ? <IconButton icon="close" label="Stop selecting" onPress={() => { lightFeedback(); stopSelecting(); }} /> : null}
                </View>
            ) : undefined}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}>
                <GestureDetector gesture={twoFingers}>
                <ScrollView ref={scroller} scrollEnabled={!scrollLocked} onScroll={event => { scrollY.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}
                    contentContainerStyle={[styles.content, (editingId !== null || adding) && styles.contentEditing]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
                    {selecting ? (
                        <View style={styles.selectBar}>
                            <Text style={[styles.clears, styles.flex, { color: colors.textTertiary }]}>
                                {picked.size ? `${picked.size} selected` : 'Tap or drag two fingers to select'}
                            </Text>
                            <Text onPress={() => { lightFeedback(); setPicked(allPicked ? new Set() : new Set(thoughts.map(item => item.id))); }}
                                style={[styles.selectAll, { color: primary }]} accessibilityRole="button">{allPicked ? 'Deselect all' : 'Select all'}</Text>
                        </View>
                    ) : thoughts.length > 0 && clearsOn ? (
                        <Text style={[styles.clears, { color: colors.textTertiary }]}>Clears {clearsOn} night · hold a thought to turn it into something · two fingers to select</Text>
                    ) : null}
                    {thoughts.map((thought, index) => (
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
                            />
                        </View>
                    ))}
                    {/* The space under the last thought: tap it to write the next one. */}
                    {selecting ? null : (
                        <View style={thoughts.length ? [styles.divider, { borderTopColor: colors.border }] : undefined}>
                            <NewThought open={adding} onOpen={() => { lightFeedback(); setAdding(true); }} value={draft} onChange={setDraft}
                                onSubmit={() => void save()} onClose={() => { setAdding(false); dictation.cancel(); }} inputRef={input} empty={!thoughts.length}
                                placeholder={isTablet() ? 'New thought, or write with Apple Pencil' : 'New thought'}
                                trailing={draft.trim() && !dictation.listening ? (
                                    <Pressable onPress={() => void save()} accessibilityRole="button" accessibilityLabel="Save thought"
                                        style={[styles.send, { backgroundColor: primary }]}>
                                        <AppIcon name="arrow-up" size={16} color={textOn(primary)} />
                                    </Pressable>
                                ) : dictation.available ? <MicButton listening={dictation.listening} onPress={talk} /> : null} />
                        </View>
                    )}
                </ScrollView>
                </GestureDetector>

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
                ) : null}
                <SortThoughtSheet text={sorting?.text ?? null} onClose={() => setSorting(null)} onCreate={pieces => void createSorted(pieces)} />
                <ThoughtActions visible={!!acting} count={acting?.list.length ?? 0}
                    caption={acting?.list.length === 1 ? acting.list[0].text : undefined}
                    goals={goals} startWithGoals={acting?.goals} tasks={openTasks}
                    onClose={() => setActing(null)}
                    onAction={action => acting && act(acting.list, action)}
                    onAddToGoal={goalId => { const list = acting?.list ?? []; setActing(null); void intoTasks(list, goalId); }}
                    onAddSubtask={taskId => { const list = acting?.list ?? []; setActing(null); void intoSubtasks(list, taskId); }} />
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
