import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChoiceSheet, type Choice } from '@/components/ui/ChoiceSheet';
import { SwipeRow } from '@/components/ui/SwipeRow';
import { MatteSurface } from '@/components/ui/MatteSurface';
import { MatteInput } from '@/components/ui/MatteInput';
import { AppButton } from '@/components/ui/AppButton';
import { IconButton } from '@/components/ui/IconButton';
import { ListItem } from '@/components/ui/Motion';
import { AppIcon as Ionicons } from '@/components/ui/AppIcon';
import { FontFamily, Radius, Spacing } from '@/theme/designSystem';
import { useTokens } from '@/hooks/useTokens';
import { useHaptics } from '@/hooks/useHaptics';
import { emit } from '@/lib/appEvents';
import { createTask, deleteTask, updateTask, type Task } from '@/lib/tasks';
import { cachedSections, loadSections, saveSections, sectionName, subscribeSections, todoGroups } from '@/lib/goalTodo';

const dayLabel = (key: string, today: string) => {
    if (key === today) return 'Today';
    const date = new Date(`${key}T12:00:00`);
    return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

/** The goal's headings, loaded once and kept in step with any change. */
export function useGoalSections(goalId: string): string[] {
    useEffect(() => { void loadSections(goalId); }, [goalId]);
    return useSyncExternalStore(subscribeSections, () => cachedSections(goalId) ?? EMPTY);
}
const EMPTY: string[] = [];

/** The list on screen, ready to ask for a new heading (from the goal's ⋯ menu). */
let askForSection: ((goalId: string) => void) | null = null;

/** Asks for a heading's name in the list's own sheet and adds it at the end (also from the goal's ⋯ menu). */
export function startNewSection(goalId: string) {
    askForSection?.(goalId);
}

type Sheet =
    | { kind: 'more'; task: Task }
    | { kind: 'move'; task: Task }
    | { kind: 'section'; name: string }
    | { kind: 'name'; from: string | null };

/**
 * A goal's to-do list: everything its plan needs doing, under headings you
 * name. Each heading is a card with its to-dos and a line to add one; a
 * to-do shows the day it is planned on, or a calendar button to plan it.
 * Swipe a to-do either way to delete it; touch and hold it for more (plan,
 * move to another heading, edit). The ⋯ by a heading renames or removes it
 * (its to-dos stay). Every choice is asked in the app's own sheet.
 */
export function GoalTodoList({ goalId, tasks, today, color, readOnly, onOpenTask, onPlan, onToggle }: {
    goalId: string;
    /** The goal's tasks, done ones too. */
    tasks: Task[];
    today: string;
    color: string;
    readOnly?: boolean;
    onOpenTask: (task: Task) => void;
    onPlan: (task: Task) => void;
    onToggle: (task: Task) => void;
}) {
    const t = useTokens();
    const { lightFeedback, mediumFeedback } = useHaptics();
    const sections = useGoalSections(goalId);
    const groups = todoGroups(tasks, sections);
    const [sheet, setSheet] = useState<Sheet | null>(null);
    const [shownSheet, setShownSheet] = useState<Sheet | null>(null);
    if (sheet && sheet !== shownSheet) setShownSheet(sheet);

    const newSection = () => { lightFeedback(); setSheet({ kind: 'name', from: null }); };
    useEffect(() => {
        askForSection = id => { if (id === goalId) setSheet({ kind: 'name', from: null }); };
        return () => { askForSection = null; };
    }, [goalId]);

    const saveName = async (from: string | null, raw: string) => {
        const name = sectionName(raw);
        if (!name) return;
        if (from === null) { await saveSections(goalId, [...sections, name]); return; }
        if (name === from) return;
        await saveSections(goalId, sections.map(section => (section === from ? name : section)));
        await Promise.all(tasks.filter(task => task.section === from).map(task => updateTask(task.id, { section: name }))).catch(() => undefined);
        emit('tasks_changed');
    };
    // Removing a heading keeps its to-dos, under no heading: nothing to confirm.
    const removeSection = async (name: string) => {
        await saveSections(goalId, sections.filter(section => section !== name));
        await Promise.all(tasks.filter(task => task.section === name).map(task => updateTask(task.id, { section: null }))).catch(() => undefined);
        emit('tasks_changed');
    };
    const remove = (task: Task) => {
        mediumFeedback();
        void deleteTask(task.id).then(() => emit('tasks_changed')).catch(() => undefined);
    };
    const moveTo = (task: Task, section: string | null) => { void updateTask(task.id, { section }).then(() => emit('tasks_changed')); };

    const choices = (): Choice[] => {
        if (!shownSheet) return [];
        if (shownSheet.kind === 'more') {
            const task = shownSheet.task;
            return [
                ...(task.status === 'open' ? [{ label: task.dueDate ? 'Move to another day' : 'Plan on a day', icon: 'calendar-outline', onPress: () => onPlan(task) }] : []),
                ...(sections.length ? [{ label: 'Move to a section', icon: 'folder-open-outline', onPress: () => setSheet({ kind: 'move', task }) }] : []),
                { label: 'Edit', icon: 'create-outline', onPress: () => onOpenTask(task) },
                { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => remove(task) },
            ];
        }
        if (shownSheet.kind === 'move') {
            const task = shownSheet.task;
            return [
                ...sections.filter(section => section !== task.section).map(section => ({ label: section, icon: 'folder-outline', onPress: () => moveTo(task, section) })),
                ...(task.section ? [{ label: 'No section', icon: 'remove-circle-outline', onPress: () => moveTo(task, null) }] : []),
            ];
        }
        if (shownSheet.kind === 'section') {
            const name = shownSheet.name;
            return [
                { label: 'Rename', icon: 'create-outline', onPress: () => setSheet({ kind: 'name', from: name }) },
                { label: 'Remove section', icon: 'trash-outline', destructive: true, onPress: () => void removeSection(name) },
            ];
        }
        return [];
    };

    const nothing = groups.every(group => group.tasks.length === 0) && sections.length === 0;
    return (
        <View style={styles.wrap}>
            {nothing ? (
                <View style={styles.intro}>
                    <Text style={[styles.introTitle, { color: t.color.textPrimary }]}>Everything this goal needs</Text>
                    <Text style={[styles.introBody, { color: t.color.textMuted }]}>Write down each thing to do, group them under headings, then plan each one on a day.</Text>
                </View>
            ) : null}
            {groups.map(group => (group.section === null && !group.tasks.length && !nothing ? null : (
                <ListItem key={group.section ?? '·'}>
                    <MatteSurface radius={Radius.card} style={styles.card}>
                        {group.section !== null ? (
                            <View style={styles.head}>
                                <Text style={[styles.heading, { color: t.color.textPrimary }]} accessibilityRole="header" numberOfLines={1}>{group.section}</Text>
                                {group.tasks.length ? (
                                    <Text style={[styles.count, { color: t.color.textMuted }]}>{`${group.tasks.filter(task => task.status === 'done').length} of ${group.tasks.length}`}</Text>
                                ) : null}
                                {!readOnly ? (
                                    <IconButton icon="ellipsis-horizontal" label={`${group.section} options`} diameter={32} size={16}
                                        onPress={() => { lightFeedback(); setSheet({ kind: 'section', name: group.section! }); }} />
                                ) : null}
                            </View>
                        ) : null}
                        {group.tasks.map(task => (
                            <TodoRow key={task.id} task={task} today={today} color={color} readOnly={readOnly}
                                onToggle={() => onToggle(task)} onOpen={() => onOpenTask(task)} onPlan={() => onPlan(task)}
                                onMore={() => { lightFeedback(); setSheet({ kind: 'more', task }); }} onDelete={() => remove(task)} />
                        ))}
                        {!readOnly ? <AddLine goalId={goalId} section={group.section} /> : null}
                    </MatteSurface>
                </ListItem>
            )))}
            {!readOnly ? <AppButton label="New section" icon="add" variant="ghost" onPress={newSection} /> : null}

            <ChoiceSheet
                visible={!!sheet}
                onClose={() => setSheet(null)}
                title={shownSheet?.kind === 'more' || shownSheet?.kind === 'move' ? (shownSheet.kind === 'move' ? 'Move to' : shownSheet.task.title)
                    : shownSheet?.kind === 'section' ? shownSheet.name
                    : shownSheet?.kind === 'name' && shownSheet.from ? 'Rename section' : 'New section'}
                choices={choices()}
                ask={shownSheet?.kind === 'name' ? {
                    placeholder: 'Section name', initial: shownSheet.from ?? '', save: shownSheet.from ? 'Rename' : 'Add section',
                    onSave: text => { const from = shownSheet.kind === 'name' ? shownSheet.from : null; void saveName(from, text); },
                } : undefined}
            />
        </View>
    );
}

function TodoRow({ task, today, color, readOnly, onToggle, onOpen, onPlan, onMore, onDelete }: {
    task: Task; today: string; color: string; readOnly?: boolean; onToggle: () => void; onOpen: () => void; onPlan: () => void; onMore: () => void; onDelete: () => void;
}) {
    const t = useTokens();
    const done = task.status === 'done';
    const late = !done && !!task.dueDate && task.dueDate < today;
    // Swiped either way, it is deleted: one move, the way Reminders does it.
    const del = { icon: 'trash' as const, label: 'Delete', color: '#EF4444', destructive: true, onPress: onDelete };
    return (
        <SwipeRow left={readOnly ? undefined : del} right={readOnly ? undefined : [del]} radius={Radius.small}>
        <View style={[styles.row, { backgroundColor: t.color.surface }]}>
            <Pressable disabled={readOnly} onPress={onToggle} style={styles.markButton}
                accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={task.title}>
                <View style={[styles.mark, { borderColor: t.color.warning, backgroundColor: done ? t.color.warning : 'transparent' }]}>
                    {done ? <Ionicons name="checkmark" size={14} color={t.color.background} /> : null}
                </View>
            </Pressable>
            <Pressable onPress={onOpen} onLongPress={readOnly ? undefined : onMore} delayLongPress={350} style={styles.rowText}
                accessibilityRole="button" accessibilityLabel={`${task.title}${task.dueDate ? `, planned ${dayLabel(task.dueDate, today)}` : ', not planned yet'}. Open`}
                accessibilityHint="Touch and hold for more">
                <Text numberOfLines={2} style={[styles.title, { color: done ? t.color.textMuted : t.color.textPrimary, textDecorationLine: done ? 'line-through' : 'none' }]}>{task.title}</Text>
                {task.dueDate ? (
                    <View style={styles.when}>
                        <Ionicons name="calendar-outline" size={12} color={late ? t.color.danger : done ? t.color.textSubtle : color} />
                        <Text style={[styles.whenText, { color: late ? t.color.danger : done ? t.color.textSubtle : t.color.textMuted }]}>{dayLabel(task.dueDate, today)}</Text>
                    </View>
                ) : null}
            </Pressable>
            {!readOnly && !done ? (
                <IconButton icon={task.dueDate ? 'calendar' : 'calendar-outline'} label={task.dueDate ? `Move ${task.title} to another day` : `Plan ${task.title} on a day`}
                    diameter={36} size={16} color={task.dueDate ? color : t.color.textMuted} onPress={onPlan} />
            ) : null}
        </View>
        </SwipeRow>
    );
}

/**
 * A line to write a to-do straight into a heading, the way a subtask is added:
 * a plus and a line to write on, no box. It stays open for the next one.
 */
function AddLine({ goalId, section }: { goalId: string; section: string | null }) {
    const t = useTokens();
    const [draft, setDraft] = useState('');
    const add = async () => {
        const title = draft.trim();
        if (!title) return;
        setDraft('');
        try {
            await createTask({ title, goalId, section: section ?? undefined });
            emit('tasks_changed');
        // Not saved: the words come back in the line, to try again.
        } catch { setDraft(title); }
    };
    return (
        <View style={styles.row}>
            <View style={styles.markButton}>
                <Ionicons name="add" size={20} color={t.color.textMuted} />
            </View>
            <MatteInput bare value={draft} onChangeText={setDraft} placeholder="Add a to-do" returnKeyType="done" submitBehavior="submit" textContentType="none" autoComplete="off"
                onSubmitEditing={() => { void add(); }} accessibilityLabel={section ? `Add a to-do to ${section}` : 'Add a to-do'}
                style={[styles.title, styles.addInput, { color: t.color.textPrimary }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { gap: Spacing.lg },
    intro: { gap: Spacing.xs, paddingVertical: Spacing.sm },
    introTitle: { fontSize: 17, fontFamily: FontFamily.bold },
    introBody: { fontSize: 15, lineHeight: 21, fontFamily: FontFamily.regular },
    card: { padding: Spacing.lg, gap: Spacing.xs },
    head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
    heading: { flex: 1, fontSize: 17, fontFamily: FontFamily.bold },
    count: { fontSize: 13, fontFamily: FontFamily.semibold, fontVariant: ['tabular-nums'] },
    row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
    markButton: { width: 44, height: 44, marginLeft: -Spacing.md + 2, alignItems: 'center', justifyContent: 'center' },
    mark: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    rowText: { flex: 1, minHeight: 44, justifyContent: 'center', paddingVertical: Spacing.xs },
    title: { fontSize: 15, fontFamily: FontFamily.medium },
    when: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    whenText: { fontSize: 12, fontFamily: FontFamily.medium },
    addInput: { flex: 1, paddingVertical: Spacing.sm },
});
