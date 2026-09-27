import React, { useEffect, useMemo, useRef, useState } from 'react';
import {ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppIcon as Ionicons } from '@/components/Common/AppIcon';
import { ComposerModal } from '@/components/Create/ComposerModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { AIBadge } from '@/components/Common/AIBadge';
import { Choices, DetailBar, type DetailItem } from '@/components/Create/DetailBar';
import { GoalCalendar } from '@/components/Create/GoalCalendar';
import { CreationTextInput } from '@/components/Create/CreationTextInput';
import { taskTextSegments } from '@/lib/creationTextHighlight';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useSmartParse } from '@/hooks/useSmartParse';
import { smartParseTask } from '@/lib/smartParse';
import { describeParsedTask, parseTaskText } from '@/lib/taskParser';
import { createTask, updateTask, type Task, type TaskPriority } from '@/lib/tasks';
import { localDateKey } from '@/lib/habitSchedule';
import { getGoals, type Habit } from '@/lib/habitsSQLite';
import { emit, on } from '@/lib/appEvents';

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
const ESTIMATES = [5, 15, 30, 60, 120];

interface Draft {
    title: string;
    description?: string;
    dueDate?: string;
    dueTime?: string;
    estimate?: number;
    priority: TaskPriority;
    goalId?: string;
}

const fromTask = (task: Task): Draft => ({
    title: task.title,
    description: task.description,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    estimate: task.estimatedMinutes,
    priority: task.priority,
    goalId: task.goalId,
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
    const { lightFeedback, successFeedback } = useHaptics();

    const [eventVisible, setEventVisible] = useState(false);
    const [editing, setEditing] = useState<Task | null>(null);
    const [eventGoal, setEventGoal] = useState<string | undefined>(undefined);
    const [text, setText] = useState('');
    const [edits, setEdits] = useState<Partial<Draft>>({});
    const [openRow, setOpenRow] = useState<string | null>(null);
    const [picker, setPicker] = useState<'time' | null>(null);
    const [goals, setGoals] = useState<Habit[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const savingRef = useRef(false);

    const current = task ?? editing;
    const isOpen = listenToGlobalEvents ? eventVisible : !!visible;

    // Opening on something new clears the last one, during render so the first
    // frame is already blank.
    const session = isOpen ? (current?.id ?? 'new') : 'closed';
    const [lastSession, setLastSession] = useState('closed');
    if (session !== lastSession) {
        setLastSession(session);
        setText(current?.title ?? '');
        setEdits({});
        setOpenRow(null);
        setPicker(null);
        setError(null);
    }

    useEffect(() => {
        if (!listenToGlobalEvents) return;
        const subscription = on('show_task_form', (data) => {
            emit('close_creation_modal');
            setEditing((data?.task ?? null) as Task | null);
            setEventGoal(typeof data?.goalId === 'string' ? data.goalId : undefined);
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
            : { title: '', priority: 2, dueDate: localDateKey(new Date()), goalId: eventGoal };
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

    const close = () => { setEventVisible(false); setEditing(null); onClose?.(); };
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
                dueTime: draft.dueTime,
                estimatedMinutes: draft.estimate,
                priority: draft.priority,
                goalId: draft.goalId,
            };
            if (current) await updateTask(current.id, input);
            else if (!(await createTask(input))) throw new Error('not saved');

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

    const pickerValue = (() => {
        const base = draft.dueDate ? new Date(`${draft.dueDate}T12:00:00`) : new Date();
        if (picker === 'time' && draft.dueTime) {
            const [hour, minute] = draft.dueTime.split(':').map(Number);
            base.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
        }
        return base;
    })();

    const quickDay = (days: number) => {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return localDateKey(date);
    };
    const goalName = goals.find(goal => goal.id === draft.goalId)?.name;
    const canSave = !!text.trim();

    const items: DetailItem[] = [
        {
            id: 'due', icon: 'calendar-outline', label: 'Date', value: shortDate(draft.dueDate),
            content: (
                <>
                    <Choices
                        options={[
                            { id: quickDay(0), label: 'Today' },
                            { id: quickDay(1), label: 'Tomorrow' },
                            { id: quickDay(7), label: 'Next week' },
                            { id: '', label: 'No date' },
                        ]}
                        value={draft.dueDate ?? ''}
                        accent={accent}
                        onChange={id => { setPicker(null); change({ dueDate: id || undefined }); }}
                    />
                    <GoalCalendar allowPast value={draft.dueDate} accent={accentText} onChange={dueDate => change({ dueDate })} />

                </>
            ),
        },
        {
            id: 'time', icon: 'time-outline', label: 'Time', value: draft.dueTime,
            content: (
                <>
                    <Choices
                        options={[
                            { id: '09:00', label: 'Morning' }, { id: '14:00', label: 'Afternoon' },
                            { id: '19:00', label: 'Evening' }, { id: '', label: 'No time' },
                        ]}
                        value={draft.dueTime ?? ''}
                        accent={accent}
                        onChange={id => { setPicker(null); change({ dueTime: id || undefined }); }}
                    />
                    <Pressable onPress={() => { lightFeedback(); setPicker(picker === 'time' ? null : 'time'); }} style={styles.link}>
                        <Text style={{ color: accent, fontSize: 13, fontFamily: FontFamily.medium }}>Pick a time</Text>
                    </Pressable>
                    {picker === 'time' ? (
                        <DateTimePicker
                            value={pickerValue}
                            mode="time"
                            display={Platform.OS === 'ios' ? 'compact' : 'default'}
                            style={styles.picker}
                            themeVariant={isLight ? 'light' : 'dark'}
                            onChange={(_event, selected) => {
                                if (Platform.OS !== 'ios') setPicker(null);
                                if (!selected) return;
                                change({ dueTime: `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}` });
                            }}
                        />
                    ) : null}
                </>
            ),
        },
        {
            id: 'estimate', icon: 'hourglass-outline', label: 'How long',
            value: draft.estimate ? `${draft.estimate} min` : undefined,
            content: (
                <Choices
                    options={[...ESTIMATES.map(minutes => ({ id: minutes, label: minutes >= 60 ? `${minutes / 60} hr` : `${minutes} min` })), { id: 0, label: 'Not set' }]}
                    value={draft.estimate ?? 0}
                    accent={accent}
                    onChange={minutes => change({ estimate: minutes || undefined })}
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
                <TextInput
                    value={draft.description ?? ''}
                    onChangeText={description => change({ description })}
                    multiline
                    placeholder="Anything you need to remember"
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
                <ModalHeader title={current ? 'Edit task' : 'New task'} onBack={close} backIcon="close" />

                <ScrollView
                    style={styles.written}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    // Only rubber-bands when there is really more to see.
                    alwaysBounceVertical={false}
                >
                    <CreationTextInput
                        key={session} text={text} segments={taskTextSegments(text, rules)} accent={accentText} textColor={colors.textPrimary}
                        onChangeText={setText}
                        onFocus={() => setOpenRow(null)}
                        // Open ready to type, editing as well as creating: the
                        // caret lands after what is already written, so the first
                        // keystroke adds to it rather than replacing it.
                        autoFocus
                        multiline
                        placeholder="Call the bank tomorrow at 2pm for 30 min"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Describe the task"
                        style={[styles.input, {
                            color: colors.textPrimary, borderColor: colors.border,
                            backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                        }]}
                    />

                    <View style={styles.readRow}>
                        <Text numberOfLines={1} style={[styles.read, { color: colors.textSecondary }]}>
                            {parsed ? describeParsedTask({ ...parsed, matched: rules?.matched ?? { date: false, time: false, estimate: false, priority: false } }) : 'It will show up on the day you give it.'}
                        </Text>
                        <AIBadge thinking={smart.thinking} used={!!smart.result} color={accent} />
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
    link: { paddingVertical: 6 },
    picker: { alignSelf: 'flex-start' },
    notes: { minHeight: 70, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular, textAlignVertical: 'top' },
    error: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
    errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: FontFamily.regular },
    footer: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8 },
    save: { paddingVertical: 15, borderRadius: 999, alignItems: 'center' },
    saveText: { fontSize: 15, fontFamily: FontFamily.semibold },
});
