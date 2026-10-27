import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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

/** Asks with the system's own sheet (a menu of choices on iOS, an alert elsewhere). */
function choose(title: string, options: { label: string; destructive?: boolean; onPress: () => void }[]) {
    if (Platform.OS === 'ios') {
        ActionSheetIOS.showActionSheetWithOptions({
            title, options: [...options.map(option => option.label), 'Cancel'], cancelButtonIndex: options.length,
            destructiveButtonIndex: options.findIndex(option => option.destructive),
        }, index => { if (index < options.length) options[index].onPress(); });
    } else {
        Alert.alert(title, undefined, [...options.map(option => ({ text: option.label, style: option.destructive ? 'destructive' as const : 'default' as const, onPress: option.onPress })), { text: 'Cancel', style: 'cancel' }]);
    }
}

/** A name, typed (a prompt on iOS). */
function askName(title: string, initial: string, onName: (name: string) => void) {
    if (Platform.OS === 'ios') {
        Alert.prompt(title, undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Save', onPress: (value?: string) => { const name = sectionName(value ?? ''); if (name) onName(name); } }], 'plain-text', initial);
    } else onName(sectionName(initial || 'New section'));
}

/** Asks for a heading's name and adds it at the end of the goal's list (also from the goal's ⋯ menu). */
export function startNewSection(goalId: string) {
    askName('New section', '', name => {
        void loadSections(goalId).then(sections => saveSections(goalId, [...sections, name]));
    });
}

/**
 * A goal's to-do list: everything its plan needs doing, under headings you
 * name. Each heading is a card with its to-dos and a line to add one; a
 * to-do shows the day it is planned on, or a calendar button to plan it.
 * Touch and hold a to-do for more (plan, move to another heading, edit,
 * delete); the ⋯ by a heading renames or removes it (its to-dos stay).
 * Planning happens here or on the plan, by dragging a to-do onto a day.
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
    const { lightFeedback } = useHaptics();
    const sections = useGoalSections(goalId);
    const groups = todoGroups(tasks, sections);

    const newSection = () => { lightFeedback(); startNewSection(goalId); };

    const rename = (from: string) => askName('Rename section', from, async name => {
        if (name === from) return;
        await saveSections(goalId, sections.map(section => (section === from ? name : section)));
        await Promise.all(tasks.filter(task => task.section === from).map(task => updateTask(task.id, { section: name }))).catch(() => undefined);
        emit('tasks_changed');
    });
    const removeSection = (name: string) => {
        const count = tasks.filter(task => task.section === name && task.status !== 'cancelled').length;
        Alert.alert(`Remove “${name}”?`, count ? `Its ${count === 1 ? 'to-do stays' : `${count} to-dos stay`} in the list, under no heading.` : undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: async () => {
                await saveSections(goalId, sections.filter(section => section !== name));
                await Promise.all(tasks.filter(task => task.section === name).map(task => updateTask(task.id, { section: null }))).catch(() => undefined);
                emit('tasks_changed');
            } },
        ]);
    };
    const more = (task: Task) => {
        lightFeedback();
        choose(task.title, [
            ...(task.status === 'open' ? [{ label: task.dueDate ? 'Move to another day' : 'Plan on a day', onPress: () => onPlan(task) }] : []),
            ...(sections.length ? [{ label: 'Move to a section', onPress: () => choose('Move to', [
                ...sections.filter(section => section !== task.section).map(section => ({ label: section, onPress: () => { void updateTask(task.id, { section }).then(() => emit('tasks_changed')); } })),
                ...(task.section ? [{ label: 'No section', onPress: () => { void updateTask(task.id, { section: null }).then(() => emit('tasks_changed')); } }] : []),
            ]) }] : []),
            { label: 'Edit', onPress: () => onOpenTask(task) },
            { label: 'Delete', destructive: true, onPress: () => Alert.alert('Delete to-do', `Delete “${task.title}”?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => { void deleteTask(task.id).then(() => emit('tasks_changed')).catch(() => Alert.alert('Not deleted', 'Your to-do is still saved. Try again.')); } },
            ]) },
        ]);
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
                                        onPress={() => { const name = group.section!; lightFeedback(); choose(name, [
                                            { label: 'Rename', onPress: () => rename(name) },
                                            { label: 'Remove section', destructive: true, onPress: () => removeSection(name) },
                                        ]); }} />
                                ) : null}
                            </View>
                        ) : null}
                        {group.tasks.map(task => (
                            <TodoRow key={task.id} task={task} today={today} color={color} readOnly={readOnly}
                                onToggle={() => onToggle(task)} onOpen={() => onOpenTask(task)} onPlan={() => onPlan(task)} onMore={() => more(task)} />
                        ))}
                        {!readOnly ? <AddLine goalId={goalId} section={group.section} /> : null}
                    </MatteSurface>
                </ListItem>
            )))}
            {!readOnly ? <AppButton label="New section" icon="add" variant="ghost" onPress={newSection} /> : null}
        </View>
    );
}

function TodoRow({ task, today, color, readOnly, onToggle, onOpen, onPlan, onMore }: {
    task: Task; today: string; color: string; readOnly?: boolean; onToggle: () => void; onOpen: () => void; onPlan: () => void; onMore: () => void;
}) {
    const t = useTokens();
    const done = task.status === 'done';
    const late = !done && !!task.dueDate && task.dueDate < today;
    return (
        <View style={styles.row}>
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
        } catch { setDraft(title); Alert.alert('Not saved', 'That to-do could not be saved. Try again.'); }
    };
    return (
        <View style={styles.row}>
            <View style={styles.markButton}>
                <Ionicons name="add" size={20} color={t.color.textMuted} />
            </View>
            <MatteInput bare value={draft} onChangeText={setDraft} placeholder="Add a to-do" returnKeyType="done" submitBehavior="submit"
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
