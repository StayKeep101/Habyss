import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MatteInput } from '@/components/ui/MatteInput';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { ComposerModal } from '@/components/Create/ComposerModal';
import { TimeRange, endTime } from '@/components/Create/TimeRange';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { ShareButton } from '@/components/Common/ShareButton';
import { ShareParticipantsSheet } from '@/components/Social/ShareParticipantsSheet';
import { useShareDraft } from '@/hooks/useShareDraft';
import { AIBadge } from '@/components/Common/AIBadge';
import { Choices, DetailBar, type DetailItem } from '@/components/Create/DetailBar';
import { GoalCalendar } from '@/components/Create/GoalCalendar';
import { CreationTextInput } from '@/components/Create/CreationTextInput';
import { DictateField } from '@/components/Create/DictateField';
import { TypingPlaceholder } from '@/components/ui/TypingPlaceholder';
import { taskTextSegments } from '@/lib/creationTextHighlight';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useSmartParse } from '@/hooks/useSmartParse';
import { smartParseTask } from '@/lib/smartParse';
import { describeParsedTask, parseTaskText } from '@/lib/taskParser';
import { DIFFICULTIES, difficultyLabel, type Difficulty } from '@/lib/difficulty';
import { createTask, updateTask, type Task, type TaskMeasure, type TaskPriority } from '@/lib/tasks';
import { localDateKey } from '@/lib/habitSchedule';
import { getGoals, type Habit } from '@/lib/habitsSQLite';
import { emit, on } from '@/lib/appEvents';


/** Typed out in the empty box, for a little inspiration. */
const TASK_EXAMPLES = ['Call the bank tomorrow at 2pm', 'Send the invoice Friday', 'Book the dentist next week', 'Groceries tonight at 6'];

interface Props {
    visible?: boolean;
    onClose?: () => void;
    onSaved?: () => void;
    /** Present when editing. */
    task?: Task | null;
    listenToGlobalEvents?: boolean;
}

const PRIORITIES: { id: TaskPriority; label: string }[] = [
    { id: 1, label: 'High' },
    { id: 2, label: 'Normal' },
    { id: 3, label: 'Low' },
];

interface Draft {
    title: string;
    description?: string;
    /** The day you plan to do it: it is on that day's timeline. */
    dueDate?: string;
    /** When it must be done by, if later: not done on its day, it moves on until then. */
    deadline?: string;
    dueTime?: string;
    estimate?: number;
    priority: TaskPriority;
    /** How hard it is: the timeline puts hard things in your best hours. */
    difficulty?: Difficulty;
    goalId?: string;
    measure: TaskMeasure;
    /** A count, or minutes for time. */
    target?: number;
    unit?: string;
}


const fromTask = (task: Task): Draft => ({
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    deadline: task.deadline,
    dueTime: task.dueTime,
    estimate: task.estimatedMinutes,
    priority: task.priority,
    difficulty: task.difficulty,
    goalId: task.goalId,
    measure: task.measure ?? 'done',
    target: task.target,
    unit: task.unit,
});

const shortDate = (date?: string) => {
    if (!date) return undefined;
    const today = localDateKey(new Date());
    if (date === today) return 'Today';
    const parsed = new Date(`${date}T12:00:00`);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date === localDateKey(tomorrow)) return 'Tomorrow';
    return parsed.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

/**
 * Making a task, and changing one.
 *
 * You write it the way you would say it — "Call the bank tomorrow at 2pm for
 * 30 min" — and the day, the time and the length are taken out of the sentence
 * and put on the chips above the keyboard, where they can still be changed.
 * The day matters more here than anywhere else in the app: a task shows up on
 * the day it was given and on no other, so giving it the wrong day hides it.
 */
export const TaskFormModal: React.FC<Props> = ({ visible, onClose, onSaved, task, listenToGlobalEvents }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent, foreground: accentText } = useAccentGradient();
    const { selectionFeedback, successFeedback } = useHaptics();

    const [eventVisible, setEventVisible] = useState(false);
    const [editing, setEditing] = useState<Task | null>(null);
    const [eventGoal, setEventGoal] = useState<string | undefined>(undefined);
    const [text, setText] = useState('');
    const [edits, setEdits] = useState<Partial<Draft>>({});
    const [openRow, setOpenRow] = useState<string | null>(null);
    const [goals, setGoals] = useState<Habit[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** A row the opener asked for, and the one this session actually opened on. */
    const [requestedRow, setRequestedRow] = useState<string | null>(null);
    const [openedWith, setOpenedWith] = useState<string | null>(null);
    const savingRef = useRef(false);

    const current = task ?? editing;
    // Held until the task has an id, so a task can be shared while it is still
    // being written rather than only from a detail page afterwards.
    const share = useShareDraft('task', current?.id);
    const isOpen = listenToGlobalEvents ? eventVisible : !!visible;

    // Opening on something new clears the last one, during render so the first
    // frame is already blank.
    const session = isOpen ? (current?.id ?? 'new') : 'closed';
    const [lastSession, setLastSession] = useState('closed');
    const [prefill, setPrefill] = useState('');
    if (session !== lastSession) {
        setLastSession(session);
        setText(current?.title ?? prefill);
        setPrefill('');
        setEdits({});
        // Whatever the opener asked to land on, or nothing.
        setOpenRow(requestedRow);
        setOpenedWith(requestedRow);
        setRequestedRow(null);
        setError(null);
    }

    useEffect(() => {
        if (!listenToGlobalEvents) return;
        const subscription = on('show_task_form', (data) => {
            emit('close_creation_modal');
            setEditing((data?.task ?? null) as Task | null);
            setEventGoal(typeof data?.goalId === 'string' ? data.goalId : undefined);
            // Opened from somewhere that already knows which question is being
            // asked — the goal roadmap only ever asks about the date.
            setRequestedRow(data?.focus ?? null);
            setPrefill(data?.prefill ?? '');
            setEventVisible(true);
        });
        return () => subscription.remove();
    }, [listenToGlobalEvents]);

    useEffect(() => {
        if (!isOpen) return;
        getGoals().then(list => setGoals(list.filter(goal => !goal.isArchived))).catch(() => setGoals([]));
    }, [isOpen]);

    // Rules read the sentence instantly; the model's reading replaces theirs
    // once it arrives. Neither overwrites anything already tapped.
    const rules = useMemo(() => (text.trim() ? parseTaskText(text) : null), [text]);
    const smart = useSmartParse(text, smartParseTask);
    // An existing task keeps the title and the day it was saved with until the
    // sentence is actually changed. Re-reading it would move its date.
    const untouched = !!current && text.trim() === (current.title ?? '').trim();
    const parsed = untouched ? null : (smart.result ?? rules);

    const draft = useMemo<Draft>(() => {
        // A task added without thinking about it is for today, the way it is
        // in Reminders — but only a brand new one.
        const start: Draft = current
            ? fromTask(current)
            : { title: '', priority: 2, dueDate: localDateKey(new Date()), goalId: eventGoal, measure: 'done' };
        const read: Draft = parsed ? {
            ...start,
            title: parsed.title || start.title,
            dueDate: parsed.dueDate ?? start.dueDate,
            dueTime: parsed.dueTime ?? start.dueTime,
            estimate: parsed.estimatedMinutes ?? start.estimate,
            priority: parsed.priority ?? start.priority,
        } : start;
        return { ...read, ...edits };
    }, [current, eventGoal, parsed, edits]);

    const close = () => { setEventVisible(false); setEditing(null); share.close(); onClose?.(); };
    const change = (patch: Partial<Draft>) => setEdits(current => ({ ...current, ...patch }));

    const save = async () => {
        const title = draft.title.trim() || text.trim();
        if (!text.trim() || !title || savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        setError(null);
        try {
            const input = {
                title,
                description: draft.description?.trim() || undefined,
                dueDate: draft.dueDate,
                // A deadline before the planned day means nothing: the day is the deadline.
                deadline: draft.deadline && draft.dueDate && draft.deadline > draft.dueDate ? draft.deadline : undefined,
                dueTime: draft.dueTime,
                estimatedMinutes: draft.estimate,
                priority: draft.priority,
                difficulty: draft.difficulty,
                goalId: draft.goalId,
            };
            if (current) await updateTask(current.id, input);
            else {
                const made = await createTask(input);
                if (!made) throw new Error('not saved');
                await share.applyTo(made.id);
            }

            successFeedback();
            onSaved?.();
            emit('tasks_changed');
            close();
        } catch {
            setError('Could not save that task. Nothing was lost — try again.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };
    const quickDay = (days: number) => {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return localDateKey(date);
    };
    /** Days until Saturday. */
    const toWeekend = (6 - new Date().getDay() + 7) % 7;
    /** Days until Friday. */
    const toFriday = (5 - new Date().getDay() + 7) % 7;
    const chosenGoal = goals.find(goal => goal.id === draft.goalId);
    const goalName = chosenGoal?.name;
    // A task is done or it is not: no counts or timers to fill in first.
    const canSave = !!text.trim();
    const items: DetailItem[] = [
        {
            id: 'due', icon: 'calendar-outline', label: 'Do on', value: shortDate(draft.dueDate),
            content: (
                <>
                    {/* The shortcuts first, so they are in view without
                        scrolling; the month underneath for anything else. */}
                    <Choices
                        options={[
                            { id: quickDay(0), label: 'Today' },
                            { id: quickDay(1), label: 'Tomorrow' },
                            ...(toWeekend > 1 ? [{ id: quickDay(toWeekend), label: 'Weekend' }] : []),
                            { id: quickDay(7), label: 'Next week' },
                        ]}
                        value={draft.dueDate ?? ''}
                        accent={accent}
                        oneLine
                        onChange={id => change({ dueDate: id || undefined })}
                    />
                    <GoalCalendar allowPast showToday={false} reserve={50} value={draft.dueDate} accent={accentText} onChange={dueDate => change({ dueDate })} />
                </>
            ),
        },
        {
            // A deadline apart from the day: planned for today, due Friday.
            id: 'deadline', icon: 'flag-outline', label: 'Due by',
            value: draft.deadline && draft.dueDate && draft.deadline > draft.dueDate ? shortDate(draft.deadline) : undefined,
            content: (
                <>
                    <Text style={[styles.hint, { color: colors.textTertiary }]}>
                        Not done on its day? It moves to the next day until this date, and only counts as late after it.
                    </Text>
                    <Choices
                        options={[
                            { id: '', label: 'Same day' },
                            { id: quickDay(1), label: 'Tomorrow' },
                            ...(toFriday > 1 ? [{ id: quickDay(toFriday), label: 'Friday' }] : []),
                            { id: quickDay(7), label: 'In a week' },
                        ]}
                        value={draft.deadline ?? ''}
                        accent={accent}
                        oneLine
                        onChange={id => change({ deadline: id || undefined })}
                    />
                    <GoalCalendar showToday={false} reserve={50} value={draft.deadline} accent={accentText} onChange={deadline => change({ deadline })} />
                </>
            ),
        },
        {
            id: 'time', icon: 'time-outline', label: 'Time',
            value: draft.dueTime
                ? (draft.estimate ? `${draft.dueTime} → ${endTime(draft.dueTime, draft.estimate)}` : draft.dueTime)
                : undefined,
            content: (
                <TimeRange
                    start={draft.dueTime}
                    minutes={draft.estimate}
                    accent={accent}
                    startLabel="Due at"
                    onChange={next => change({ dueTime: next.start, estimate: next.minutes })}
                />
            ),
        },
        {
            id: 'priority', icon: 'flag-outline', label: 'Priority',
            value: draft.priority === 2 ? undefined : PRIORITIES.find(item => item.id === draft.priority)?.label,
            content: (
                <Choices options={PRIORITIES} value={draft.priority} accent={accent} onChange={priority => change({ priority })} />
            ),
        },
        {
            id: 'difficulty', icon: 'barbell-outline', label: 'Difficulty', value: difficultyLabel(draft.difficulty),
            content: <Choices options={DIFFICULTIES} value={draft.difficulty ?? 2} accent={accent} onChange={difficulty => change({ difficulty })} />,
        },
        ...(goals.length > 0 ? [{
            id: 'goal', icon: 'trophy-outline' as const, label: 'Goal', value: goalName,
            content: (
                <Choices
                    options={[{ id: '', label: 'None' }, ...goals.map(goal => ({ id: goal.id, label: goal.name }))]}
                    value={draft.goalId ?? ''}
                    accent={accent}
                    onChange={id => change({ goalId: id || undefined })}
                />
            ),
        }] : []),
        {
            id: 'notes', icon: 'document-text-outline', label: 'Notes',
            value: draft.description ? 'Written' : undefined,
            content: (
                <MatteInput
                    // Opening the row opens the keyboard: it exists to be
                    // typed in, and a tap to reach that is a tap too many.
                    autoFocus
                    value={draft.description ?? ''}
                    onChangeText={description => change({ description })}
                    multiline
                    placeholder="Notes"
                    placeholderTextColor={colors.textTertiary}
                    accessibilityLabel="Task notes"
                    style={[styles.notes, {
                        color: colors.textPrimary, borderColor: colors.border,
                        backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)',
                    }]}
                />
            ),
        },
    ];

    return (
        <ComposerModal visible={isOpen} onClose={close}>
            {/* The chips and the save button ride above the keyboard, so the
                day and the time are one tap away while you are still typing. */}
            <>
                <ModalHeader
                    title={current ? 'Edit task' : 'New task'} onBack={close} backIcon="close"
                    // On a new task too. There is no id yet to write a share row
                    // against, so the choice is held and sent on save — deciding
                    // to do something with somebody happens while writing it.
                    rightSlot={
                        <ShareButton variant="friend" onPress={() => { selectionFeedback(); share.open(); }} />
                    }
                />

                <ScrollView
                    style={styles.written}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    // Only rubber-bands when there is really more to see.
                    alwaysBounceVertical={false}
                >
                    <DictateField text={text} onText={setText}>
                        <TypingPlaceholder examples={TASK_EXAMPLES} active={!text}>
                            {placeholder => (
                            <CreationTextInput
                                key={session} text={text} segments={taskTextSegments(text, rules)} accent={accentText} textColor={colors.textPrimary}
                                onChangeText={setText}
                                onFocus={() => setOpenRow(null)}
                                // Open ready to type, editing as well as creating: the
                                // caret lands after what is already written, so the first
                                // keystroke adds to it rather than replacing it. Unless
                                // the sheet was opened on a row, in which case the
                                // keyboard would take the screen the row needs.
                                autoFocus={!openedWith}
                                multiline
                                placeholder={placeholder}
                                placeholderTextColor={colors.textTertiary}
                                accessibilityLabel="Describe the task"
                                style={[styles.input, {
                                    color: colors.textPrimary, borderColor: colors.border,
                                    backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                                }]}
                            />
                            )}
                        </TypingPlaceholder>
                    </DictateField>

                    <View style={styles.readRow}>
                        <Text numberOfLines={1} style={[styles.read, { color: colors.textSecondary }]}>
                            {parsed ? describeParsedTask({ ...parsed, matched: rules?.matched ?? { date: false, time: false, estimate: false, priority: false } }) : ''}
                        </Text>
                        <AIBadge thinking={smart.thinking} used={!!smart.result} color={accent} onRequest={smart.request} failed={smart.failed} />
                    </View>

                    {draft.title && draft.title !== text.trim() ? (
                        <Text numberOfLines={1} style={[styles.read, { color: colors.textTertiary }]}>
                            Task: <Text style={{ color: colors.textPrimary, fontFamily: FontFamily.medium }}>{draft.title}</Text>
                        </Text>
                    ) : null}

                    {error ? (
                        <View style={[styles.error, { backgroundColor: colors.error + '18', borderColor: colors.error + '44' }]}>
                            <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                        </View>
                    ) : null}
                </ScrollView>

                <DetailBar fitContent items={items} open={openRow} onToggle={setOpenRow} accent={accent} />

                <View style={styles.footer}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !canSave }}
                        disabled={!canSave || saving}
                        onPress={save}
                        style={[styles.save, { backgroundColor: canSave ? accent : (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)') }]}
                    >
                        {saving ? <ActivityIndicator color="#000" size="small" /> : (
                            <Text style={[styles.saveText, { color: canSave ? '#000' : colors.textTertiary }]}>
                                {current ? 'Save changes' : 'Add task'}
                            </Text>
                        )}
                    </Pressable>
                </View>

                <ShareParticipantsSheet
                    visible={share.picking}
                    title={current ? 'Share task' : 'Do it together'}
                    subtitle={draft.title.trim() || text.trim() || 'This task'}
                    loadShared={share.loadShared}
                    applyChanges={share.applyChanges}
                    onClose={share.close}
                />
            </>
        </ComposerModal>
    );
};

const styles = StyleSheet.create({
    // The card is as tall as what it holds, so the written part grows with the
    // sentence and stops at a height that still leaves the settings and the
    // save button on screen; past that the sentence scrolls.
    written: { flexGrow: 0, flexShrink: 3, maxHeight: 190 },
    content: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
    input: { minHeight: 64, borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 16, lineHeight: 22, fontFamily: FontFamily.regular, textAlignVertical: 'top' },
    readRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    read: { flexShrink: 1, fontSize: 11, fontFamily: FontFamily.regular },
    hint: { fontSize: 12, lineHeight: 17, fontFamily: FontFamily.regular, marginBottom: 8 },
    link: { paddingVertical: 6 },
    picker: { alignSelf: 'flex-start' },
    notes: { minHeight: 70, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular, textAlignVertical: 'top' },
    error: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
    errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: FontFamily.regular },
    footer: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8 },
    save: { paddingVertical: 15, borderRadius: 999, alignItems: 'center' },
    saveText: { fontSize: 15, fontFamily: FontFamily.semibold },
});
