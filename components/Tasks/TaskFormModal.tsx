import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, DeviceEventEmitter, Platform, ScrollView, StyleSheet,
    Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { VoidModal } from '@/components/Layout/VoidModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { createTask, updateTask, type Task, type TaskPriority } from '@/lib/tasks';
import { localDateKey } from '@/lib/habitSchedule';

interface Props {
    visible?: boolean;
    onClose?: () => void;
    onSaved?: () => void;
    /** Present when editing. */
    task?: Task | null;
    listenToGlobalEvents?: boolean;
}

const PRIORITIES: { id: TaskPriority; label: string; color: string }[] = [
    { id: 1, label: 'High', color: '#EF4444' },
    { id: 2, label: 'Normal', color: '#F59E0B' },
    { id: 3, label: 'Low', color: '#64748B' },
];

const ESTIMATES = [5, 15, 30, 60, 120];

const formatDue = (date?: string) => {
    if (!date) return 'No date';
    const parsed = new Date(`${date}T12:00:00`);
    return parsed.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

/**
 * Create or edit a task.
 *
 * A task is a one-off with a due date, unlike a habit, so it carries the fields
 * that decide what surfaces today: when it is due, how long it takes and how
 * important it is. Only the title is required; everything else is optional and
 * absent rather than guessed.
 */
export const TaskFormModal: React.FC<Props> = ({ visible, onClose, onSaved, task, listenToGlobalEvents }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();

    const [eventVisible, setEventVisible] = useState(false);
    const [editing, setEditing] = useState<Task | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [dueDate, setDueDate] = useState<string | undefined>(undefined);
    const [dueTime, setDueTime] = useState<string | undefined>(undefined);
    const [estimate, setEstimate] = useState<number | undefined>(undefined);
    const [priority, setPriority] = useState<TaskPriority>(2);
    const [picker, setPicker] = useState<'date' | 'time' | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const savingRef = useRef(false);

    const current = task ?? editing;
    const isOpen = listenToGlobalEvents ? eventVisible : !!visible;

    const reset = (from?: Task | null) => {
        setTitle(from?.title ?? '');
        setDescription(from?.description ?? '');
        setDueDate(from?.dueDate);
        setDueTime(from?.dueTime);
        setEstimate(from?.estimatedMinutes);
        setPriority(from?.priority ?? 2);
        setPicker(null);
        setError(null);
    };

    useEffect(() => {
        if (!listenToGlobalEvents) return;
        const subscription = DeviceEventEmitter.addListener('show_task_form', (data) => {
            DeviceEventEmitter.emit('close_creation_modal');
            const incoming = (data?.task ?? null) as Task | null;
            setEditing(incoming);
            reset(incoming);
            // A task created from the Create button defaults to today, which is
            // what people mean when they add one without thinking about it.
            if (!incoming) setDueDate(localDateKey(new Date()));
            setEventVisible(true);
        });
        return () => subscription.remove();
    }, [listenToGlobalEvents]);

    useEffect(() => {
        if (visible) reset(task ?? null);
    }, [visible, task]);

    const close = () => { setEventVisible(false); setEditing(null); onClose?.(); };

    const save = async () => {
        if (!title.trim() || savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        setError(null);
        try {
            const input = {
                title: title.trim(),
                description: description.trim() || undefined,
                dueDate,
                dueTime,
                estimatedMinutes: estimate,
                priority,
            };
            if (current) {
                await updateTask(current.id, input);
            } else {
                const created = await createTask(input);
                if (!created) throw new Error('not saved');
            }
            successFeedback();
            onSaved?.();
            DeviceEventEmitter.emit('tasks_changed');
            close();
        } catch {
            setError('Could not save that task. Nothing was lost — try again.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const pickerValue = (() => {
        const base = dueDate ? new Date(`${dueDate}T12:00:00`) : new Date();
        if (picker === 'time' && dueTime) {
            const [h, m] = dueTime.split(':').map(Number);
            base.setHours(h || 9, m || 0, 0, 0);
        }
        return base;
    })();

    const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
        <View style={{ gap: 8 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
            {children}
        </View>
    );

    const inputStyle = [styles.input, {
        color: colors.textPrimary, borderColor: colors.border,
        backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
    }];

    return (
        <VoidModal visible={isOpen} onClose={close}>
            <View style={{ flex: 1 }}>
                <ModalHeader title={current ? 'Edit task' : 'New task'} onBack={close} backIcon="close" />

                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                    <Field label="TASK">
                        <TextInput
                            value={title}
                            onChangeText={setTitle}
                            autoFocus={!current}
                            placeholder="Send the proposal"
                            placeholderTextColor={colors.textTertiary}
                            accessibilityLabel="Task title"
                            style={inputStyle}
                        />
                    </Field>

                    <Field label="NOTES">
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            placeholder="Anything you need to remember"
                            placeholderTextColor={colors.textTertiary}
                            accessibilityLabel="Task notes"
                            style={[...inputStyle, { minHeight: 76, textAlignVertical: 'top', paddingTop: 13 }]}
                        />
                    </Field>

                    <Field label="DUE">
                        <View style={styles.row}>
                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel="Due date"
                                onPress={() => { lightFeedback(); setPicker(picker === 'date' ? null : 'date'); }}
                                style={[styles.chip, { flex: 1, borderColor: picker === 'date' ? accent : 'transparent', backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)' }]}
                            >
                                <Ionicons name="calendar-outline" size={16} color={dueDate ? accent : colors.textTertiary} />
                                <Text style={{ color: dueDate ? colors.textPrimary : colors.textTertiary, fontSize: 13, fontFamily: 'Lexend_500Medium' }}>
                                    {formatDue(dueDate)}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                accessibilityRole="button"
                                accessibilityLabel="Due time"
                                onPress={() => { lightFeedback(); setPicker(picker === 'time' ? null : 'time'); }}
                                style={[styles.chip, { flex: 1, borderColor: picker === 'time' ? accent : 'transparent', backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)' }]}
                            >
                                <Ionicons name="time-outline" size={16} color={dueTime ? accent : colors.textTertiary} />
                                <Text style={{ color: dueTime ? colors.textPrimary : colors.textTertiary, fontSize: 13, fontFamily: 'Lexend_500Medium' }}>
                                    {dueTime ?? 'No time'}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {dueDate || dueTime ? (
                            <TouchableOpacity
                                accessibilityRole="button"
                                onPress={() => { lightFeedback(); setDueDate(undefined); setDueTime(undefined); setPicker(null); }}
                            >
                                <Text style={{ color: colors.textTertiary, fontSize: 12, fontFamily: 'Lexend_400Regular' }}>Clear due date</Text>
                            </TouchableOpacity>
                        ) : null}

                        {picker ? (
                            <View style={{ alignItems: 'center' }}>
                                <DateTimePicker
                                    value={pickerValue}
                                    mode={picker}
                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                    themeVariant={isLight ? 'light' : 'dark'}
                                    onChange={(_event, selected) => {
                                        if (Platform.OS !== 'ios') setPicker(null);
                                        if (!selected) return;
                                        if (picker === 'date') setDueDate(localDateKey(selected));
                                        else setDueTime(`${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`);
                                    }}
                                />
                            </View>
                        ) : null}
                    </Field>

                    <Field label="HOW LONG">
                        <View style={styles.row}>
                            {ESTIMATES.map(minutes => (
                                <TouchableOpacity
                                    key={minutes}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: estimate === minutes }}
                                    onPress={() => { lightFeedback(); setEstimate(estimate === minutes ? undefined : minutes); }}
                                    style={[styles.chip, {
                                        borderColor: estimate === minutes ? accent : 'transparent',
                                        backgroundColor: estimate === minutes ? accent + '20' : (isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)'),
                                    }]}
                                >
                                    <Text style={{ color: estimate === minutes ? accent : colors.textSecondary, fontSize: 13, fontFamily: 'Lexend_500Medium' }}>
                                        {minutes < 60 ? `${minutes}m` : `${minutes / 60}h`}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Field>

                    <Field label="PRIORITY">
                        <View style={styles.row}>
                            {PRIORITIES.map(option => (
                                <TouchableOpacity
                                    key={option.id}
                                    accessibilityRole="radio"
                                    accessibilityState={{ selected: priority === option.id }}
                                    onPress={() => { lightFeedback(); setPriority(option.id); }}
                                    style={[styles.chip, {
                                        flex: 1, justifyContent: 'center',
                                        borderColor: priority === option.id ? option.color : 'transparent',
                                        backgroundColor: priority === option.id ? option.color + '22' : (isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)'),
                                    }]}
                                >
                                    <Text style={{ color: priority === option.id ? option.color : colors.textSecondary, fontSize: 13, fontFamily: 'Lexend_500Medium' }}>
                                        {option.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </Field>

                    {error ? (
                        <View style={[styles.error, { backgroundColor: colors.error + '18', borderColor: colors.error + '44' }]}>
                            <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                        </View>
                    ) : null}
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !title.trim() }}
                        disabled={!title.trim() || saving}
                        onPress={save}
                        style={[styles.saveBtn, { backgroundColor: title.trim() ? accent : (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)') }]}
                    >
                        {saving ? <ActivityIndicator color="#000" size="small" /> : (
                            <Text style={[styles.saveText, { color: title.trim() ? '#000' : colors.textTertiary }]}>
                                {current ? 'Save changes' : 'Add task'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </VoidModal>
    );
};

const styles = StyleSheet.create({
    content: { paddingHorizontal: 20, paddingBottom: 24, gap: 18 },
    label: { fontSize: 10, letterSpacing: 1.2, fontFamily: 'Lexend_500Medium' },
    input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: 'Lexend_400Regular' },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, borderWidth: 1 },
    error: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
    errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: 'Lexend_400Regular' },
    footer: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: 4 },
    saveBtn: { paddingVertical: 15, borderRadius: 999, alignItems: 'center' },
    saveText: { fontSize: 15, fontFamily: 'Lexend_600SemiBold' },
});
