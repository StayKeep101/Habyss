import React, { useEffect, useMemo, useRef, useState } from 'react';
import {ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppIcon as Ionicons, type IconName } from '@/components/Common/AppIcon';
import { ComposerModal } from '@/components/Create/ComposerModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { AIBadge } from '@/components/Common/AIBadge';
import { Choices, DetailBar, type DetailItem } from '@/components/Create/DetailBar';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useSmartParse } from '@/hooks/useSmartParse';
import { smartParseHabit } from '@/lib/smartParse';
import { parseHabitText } from '@/lib/habitParser';
import { addHabit, updateHabit, getGoals, type Habit } from '@/lib/habitsSQLite';
import { localDateKey } from '@/lib/habitSchedule';
import { NotificationService } from '@/lib/notificationService';
import { emit, on } from '@/lib/appEvents';

const DAYS: { id: string; label: string }[] = [
    { id: 'mon', label: 'M' }, { id: 'tue', label: 'T' }, { id: 'wed', label: 'W' },
    { id: 'thu', label: 'T' }, { id: 'fri', label: 'F' }, { id: 'sat', label: 'S' }, { id: 'sun', label: 'S' },
];
const EVERY_DAY = DAYS.map(day => day.id);
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const ICONS: IconName[] = [
    'ellipse-outline', 'barbell-outline', 'book-outline', 'water-outline', 'walk-outline',
    'moon-outline', 'musical-notes-outline', 'leaf-outline', 'brush-outline', 'code-slash-outline',
];
const COLORS = ['#6B8AF5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];
const UNITS = ['min', 'times', 'pages', 'km', 'glasses', 'reps'];

type Row = 'repeat' | 'time' | 'target' | 'reminder' | 'goal' | 'look' | null;

interface Draft {
    name: string;
    days: string[];
    startTime?: string;
    durationMinutes?: number;
    amount?: number;
    unit?: string;
    reminder?: string;
    goalId?: string;
    icon: IconName;
    color: string;
    description?: string;
}

const blank = (): Draft => ({ name: '', days: EVERY_DAY, icon: 'ellipse-outline', color: COLORS[0] });

const fromHabit = (from: Habit): Draft => ({
    name: from.name,
    days: from.taskDays?.length ? from.taskDays : EVERY_DAY,
    startTime: from.startTime,
    durationMinutes: from.durationMinutes,
    amount: from.goalValue && from.goalValue > 1 ? from.goalValue : undefined,
    unit: from.unit && from.unit !== 'time' ? from.unit : undefined,
    reminder: from.reminders?.[0],
    goalId: from.goalId,
    icon: (from.icon as IconName) || 'ellipse-outline',
    color: from.color || COLORS[0],
    description: from.description,
});

const describeDays = (days: string[]): string => {
    if (days.length === 0 || days.length === 7) return 'Every day';
    if (days.length === 5 && WEEKDAYS.every(day => days.includes(day))) return 'Weekdays';
    if (days.length === 2 && days.includes('sat') && days.includes('sun')) return 'Weekends';
    return DAYS.filter(day => days.includes(day.id))
        .map(day => day.id.charAt(0).toUpperCase() + day.id.slice(1))
        .join(', ');
};

const presetOf = (days: string[]): string =>
    days.length === 7 || days.length === 0 ? 'all'
        : days.length === 5 && WEEKDAYS.every(day => days.includes(day)) ? 'week'
            : days.length === 2 && days.includes('sat') && days.includes('sun') ? 'end' : '';

/**
 * Making a habit, and changing one, in one sheet.
 *
 * You write it the way you would say it and Habyss reads it: the days, the
 * time, how long and how much. Everything else is one line each, opening onto
 * only the control it needs, so the sheet stays short instead of being a page
 * of every field a habit could ever have. The wizard this replaces asked the
 * same questions across five screens.
 *
 * Nothing the parser finds is copied into state: the sheet shows the reading
 * with whatever the user has since changed laid over it, so a later word in
 * the sentence can still move the days without undoing a day they tapped.
 */
export const HabitSheet: React.FC<{
    visible?: boolean;
    onClose?: () => void;
    onSaved?: () => void;
    habit?: Habit | null;
    goalId?: string;
    listenToGlobalEvents?: boolean;
}> = ({ visible, onClose, onSaved, habit, goalId, listenToGlobalEvents }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();

    const [eventVisible, setEventVisible] = useState(false);
    const [editing, setEditing] = useState<Habit | null>(null);
    const [prefill, setPrefill] = useState('');
    const [eventGoal, setEventGoal] = useState<string | undefined>(undefined);
    const [text, setText] = useState('');
    const [edits, setEdits] = useState<Partial<Draft>>({});
    const [openRow, setOpenRow] = useState<Row>(null);
    const [picker, setPicker] = useState<'time' | 'reminder' | null>(null);
    const [goals, setGoals] = useState<Habit[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const savingRef = useRef(false);

    const current = habit ?? editing;
    const isOpen = listenToGlobalEvents ? eventVisible : !!visible;

    // Opening the sheet on something new clears the last one. Done while
    // rendering rather than in an effect, so the first frame is already blank.
    const session = isOpen ? `${current?.id ?? 'new'}:${prefill}` : 'closed';
    const [lastSession, setLastSession] = useState('closed');
    if (session !== lastSession) {
        setLastSession(session);
        // Editing starts from the habit's own words, so clearing the field
        // clears it rather than falling back to the old name.
        setText(prefill || current?.name || '');
        setEdits({});
        setOpenRow(null);
        setPicker(null);
        setError(null);
    }

    useEffect(() => {
        if (!listenToGlobalEvents) return;
        const open = (data: any, withHabit: boolean) => {
            emit('close_creation_modal');
            setEditing(withHabit ? ((data?.initialHabit ?? null) as Habit | null) : null);
            setPrefill(data?.prefillName ?? '');
            setEventGoal(data?.goalId);
            setEventVisible(true);
        };
        const editor = on('show_habit_modal', data => open(data, true));
        // Quick add is the same sheet; the old one was a separate, lesser form.
        const quick = on('show_quick_add', data => open(data, false));
        return () => { editor.remove(); quick.remove(); };
    }, [listenToGlobalEvents]);

    useEffect(() => {
        if (!isOpen) return;
        getGoals().then(all => setGoals(all.filter(goal => !goal.isArchived))).catch(() => setGoals([]));
    }, [isOpen]);

    // What the sentence says, read by rules at once and by the model a moment
    // later. Anything it finds fills the rows in, where it can still be changed.
    const rules = useMemo(() => (text.trim() ? parseHabitText(text) : null), [text]);
    const smart = useSmartParse(text, smartParseHabit);
    // Opening an existing habit must not rewrite it. "Run everyday" reads as a
    // habit called "Run" that repeats daily, which is right for a sentence
    // someone just typed and wrong for a name they chose and saved. So nothing
    // is read out of the text until they actually change it.
    const untouched = !!current && text.trim() === (current.name ?? '').trim();
    const parsed = untouched ? null : (smart.result ?? rules);

    const draft = useMemo<Draft>(() => {
        const start = current ? fromHabit(current) : { ...blank(), goalId: eventGoal };
        const read: Draft = parsed ? {
            ...start,
            name: parsed.name || start.name,
            days: parsed.taskDays?.length ? parsed.taskDays : start.days,
            startTime: parsed.startTime ?? start.startTime,
            durationMinutes: parsed.durationMinutes ?? start.durationMinutes,
            amount: parsed.targetValue ?? start.amount,
            unit: parsed.targetUnit ?? start.unit,
        } : start;
        return { ...read, ...edits };
    }, [current, eventGoal, parsed, edits]);

    const linkedGoal = goalId ?? draft.goalId;
    const close = () => { setEventVisible(false); setEditing(null); onClose?.(); };
    const toggleRow = (row: Row) => setOpenRow(value => (value === row ? null : row));
    const change = (patch: Partial<Draft>) => setEdits(current => ({ ...current, ...patch }));

    const save = async () => {
        const name = draft.name.trim() || text.trim();
        if (!name || savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        setError(null);
        try {
            const fields: Partial<Habit> = {
                name,
                description: draft.description,
                taskDays: draft.days.length === 7 ? [] : draft.days,
                startTime: draft.startTime,
                durationMinutes: draft.durationMinutes,
                goalValue: draft.amount ?? 1,
                unit: draft.unit ?? 'time',
                trackingMethod: draft.amount ? 'numeric' : 'boolean',
                reminders: draft.reminder ? [draft.reminder] : [],
                goalId: linkedGoal,
                icon: draft.icon,
                color: draft.color,
                type: 'build',
                frequency: 'daily',
                goalPeriod: 'daily',
                category: current?.category ?? 'personal',
                startDate: current?.startDate ?? localDateKey(new Date()),
            };

            if (current) await updateHabit({ id: current.id, ...fields });
            else if (!(await addHabit(fields))?.id) throw new Error('not saved');

            successFeedback();
            emit('habit_updated', { habitId: current?.id });
            void NotificationService.refreshReminders().catch(() => undefined);
            onSaved?.();
            close();
        } catch {
            setError('Could not save that habit. Nothing was lost — try again.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const timeValue = (value?: string) => {
        const [hour, minute] = (value ?? '08:00').split(':').map(Number);
        const date = new Date();
        date.setHours(hour || 8, minute || 0, 0, 0);
        return date;
    };
    const asTime = (date: Date) =>
        `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    const goalName = goals.find(goal => goal.id === linkedGoal)?.name;
    const canSave = !!(draft.name.trim() || text.trim());

    const items: DetailItem[] = [
        {
            id: 'repeat', icon: 'repeat', label: 'Repeat', value: describeDays(draft.days),
            content: (
                <>
                    <View style={styles.days}>
                        {DAYS.map(day => {
                            const on = draft.days.includes(day.id);
                            return (
                                <Pressable
                                    key={day.id}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked: on }}
                                    accessibilityLabel={day.id}
                                    onPress={() => {
                                        lightFeedback();
                                        change({ days: on ? draft.days.filter(item => item !== day.id) : [...draft.days, day.id] });
                                    }}
                                    style={[styles.day, {
                                        backgroundColor: on ? accent + '22' : (isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)'),
                                        borderColor: on ? accent + '66' : 'transparent',
                                    }]}
                                >
                                    <Text style={{ color: on ? accent : colors.textSecondary, fontSize: 13, fontFamily: FontFamily.medium }}>{day.label}</Text>
                                </Pressable>
                            );
                        })}
                    </View>
                    <Choices
                        options={[{ id: 'all', label: 'Every day' }, { id: 'week', label: 'Weekdays' }, { id: 'end', label: 'Weekends' }]}
                        value={presetOf(draft.days)}
                        accent={accent}
                        onChange={id => change({ days: id === 'all' ? EVERY_DAY : id === 'week' ? WEEKDAYS : ['sat', 'sun'] })}
                    />
                </>
            ),
        },
        {
            id: 'time', icon: 'time-outline', label: 'Time',
            value: draft.startTime ? `${draft.startTime}${draft.durationMinutes ? ` · ${draft.durationMinutes}m` : ''}` : undefined,
            content: (
                <>
                    <Choices
                        options={[{ id: 0, label: 'No length' }, { id: 15, label: '15 min' }, { id: 30, label: '30 min' }, { id: 45, label: '45 min' }, { id: 60, label: '1 hr' }]}
                        value={draft.durationMinutes ?? 0}
                        accent={accent}
                        onChange={minutes => change({ durationMinutes: minutes || undefined })}
                    />
                    <View style={styles.inline}>
                        <Pressable onPress={() => { lightFeedback(); setPicker(picker === 'time' ? null : 'time'); }} style={styles.link}>
                            <Text style={{ color: accent, fontSize: 13, fontFamily: FontFamily.medium }}>
                                {draft.startTime ? `Starts at ${draft.startTime}` : 'Set a start time'}
                            </Text>
                        </Pressable>
                        {draft.startTime ? (
                            <Pressable onPress={() => change({ startTime: undefined })} style={styles.link}>
                                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Clear</Text>
                            </Pressable>
                        ) : null}
                    </View>
                    {picker === 'time' ? (
                        <DateTimePicker
                            value={timeValue(draft.startTime)}
                            mode="time"
                            display={Platform.OS === 'ios' ? 'compact' : 'default'}
                            style={styles.picker}
                            themeVariant={isLight ? 'light' : 'dark'}
                            onChange={(_event, selected) => {
                                if (Platform.OS !== 'ios') setPicker(null);
                                if (selected) change({ startTime: asTime(selected) });
                            }}
                        />
                    ) : null}
                </>
            ),
        },
        {
            id: 'target', icon: 'stats-chart-outline', label: 'Measure',
            value: draft.amount ? `${draft.amount} ${draft.unit ?? 'times'}` : undefined,
            content: (
                <>
                    <View style={styles.amountRow}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Less"
                            onPress={() => { lightFeedback(); change({ amount: Math.max(0, (draft.amount ?? 0) - 1) || undefined }); }}
                            hitSlop={8}
                        >
                            <Ionicons name="remove-circle-outline" size={26} color={colors.textSecondary} />
                        </Pressable>
                        <Text style={[styles.amount, { color: colors.textPrimary }]}>{draft.amount ?? '—'}</Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="More"
                            onPress={() => { lightFeedback(); change({ amount: (draft.amount ?? 0) + 1, unit: draft.unit ?? 'min' }); }}
                            hitSlop={8}
                        >
                            <Ionicons name="add-circle-outline" size={26} color={accent} />
                        </Pressable>
                        {draft.amount ? (
                            <Pressable onPress={() => change({ amount: undefined, unit: undefined })} style={styles.link}>
                                <Text style={{ color: colors.textTertiary, fontSize: 12 }}>Done or not</Text>
                            </Pressable>
                        ) : null}
                    </View>
                    <Choices
                        options={UNITS.map(unit => ({ id: unit, label: unit }))}
                        value={draft.unit ?? ''}
                        accent={accent}
                        onChange={unit => change({ unit, amount: draft.amount ?? 1 })}
                    />
                </>
            ),
        },
        {
            id: 'reminder', icon: 'notifications-outline', label: 'Reminder', value: draft.reminder,
            content: (
                <>
                    <Choices
                        options={[{ id: 'off', label: 'Off' }, { id: 'start', label: 'At the start time' }, { id: 'pick', label: 'Choose a time' }]}
                        value={draft.reminder ? (draft.reminder === draft.startTime ? 'start' : 'pick') : 'off'}
                        accent={accent}
                        onChange={id => {
                            if (id === 'off') { change({ reminder: undefined }); setPicker(null); return; }
                            if (id === 'start') { change({ reminder: draft.startTime ?? '08:00' }); setPicker(null); return; }
                            setPicker('reminder');
                            change({ reminder: draft.reminder ?? draft.startTime ?? '08:00' });
                        }}
                    />
                    {picker === 'reminder' ? (
                        <DateTimePicker
                            value={timeValue(draft.reminder)}
                            mode="time"
                            display={Platform.OS === 'ios' ? 'compact' : 'default'}
                            style={styles.picker}
                            themeVariant={isLight ? 'light' : 'dark'}
                            onChange={(_event, selected) => {
                                if (Platform.OS !== 'ios') setPicker(null);
                                if (selected) change({ reminder: asTime(selected) });
                            }}
                        />
                    ) : null}
                </>
            ),
        },
        ...(goals.length > 0 ? [{
            id: 'goal', icon: 'flag-outline' as const, label: 'Goal', value: goalName,
            content: (
                <Choices
                    options={[{ id: '', label: 'None' }, ...goals.map(goal => ({ id: goal.id, label: goal.name }))]}
                    value={linkedGoal ?? ''}
                    accent={accent}
                    onChange={id => change({ goalId: id || undefined })}
                />
            ),
        }] : []),
        {
            id: 'look', icon: 'color-palette-outline', label: 'Look',
            content: (
                <>
                    <View style={styles.icons}>
                        {ICONS.map(icon => (
                            <Pressable
                                key={icon}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: draft.icon === icon }}
                                accessibilityLabel={icon}
                                onPress={() => { lightFeedback(); change({ icon }); }}
                                style={[styles.iconChoice, {
                                    backgroundColor: draft.icon === icon ? draft.color + '26' : (isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)'),
                                    borderColor: draft.icon === icon ? draft.color : 'transparent',
                                }]}
                            >
                                <Ionicons name={icon} size={17} color={draft.icon === icon ? draft.color : colors.textSecondary} />
                            </Pressable>
                        ))}
                    </View>
                    <View style={styles.icons}>
                        {COLORS.map(color => (
                            <Pressable
                                key={color}
                                accessibilityRole="radio"
                                accessibilityState={{ selected: draft.color === color }}
                                accessibilityLabel={`Colour ${color}`}
                                onPress={() => { lightFeedback(); change({ color }); }}
                                style={[styles.colour, { backgroundColor: color, borderColor: draft.color === color ? colors.textPrimary : 'transparent' }]}
                            />
                        ))}
                    </View>
                </>
            ),
        },
        {
            id: 'notes', icon: 'document-text-outline', label: 'Note',
            value: draft.description ? 'Written' : undefined,
            content: (
                <TextInput
                    value={draft.description ?? ''}
                    onChangeText={description => change({ description })}
                    multiline
                    placeholder="Why this one matters to you"
                    placeholderTextColor={colors.textTertiary}
                    accessibilityLabel="Note about this habit"
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
            {/* The bar and the save button ride above the keyboard, so the
                sentence, every setting and saving are all in reach at once. */}
            <>
                <ModalHeader title={current ? 'Edit habit' : 'New habit'} onBack={close} backIcon="close" />

                <ScrollView
                    style={styles.written}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    // Only rubber-bands when there is really more to see.
                    alwaysBounceVertical={false}
                >
                    <TextInput
                        value={text}
                        onChangeText={setText}
                        // Open ready to type, editing as well as creating: the
                        // caret lands after what is already written, so the first
                        // keystroke adds to it rather than replacing it.
                        autoFocus
                        placeholder="Gym Monday, Wednesday, Friday at 6 for 45 minutes"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Describe the habit"
                        multiline
                        style={[styles.input, {
                            color: colors.textPrimary, borderColor: colors.border,
                            backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                        }]}
                    />

                    {draft.name && draft.name !== text.trim() ? (
                        <View style={styles.readRow}>
                            <Text numberOfLines={1} style={[styles.read, { color: colors.textSecondary }]}>
                                Habit: <Text style={{ color: colors.textPrimary, fontFamily: FontFamily.medium }}>{draft.name}</Text>
                            </Text>
                            <AIBadge thinking={smart.thinking} used={!!smart.result} color={accent} />
                        </View>
                    ) : null}

                    {error ? (
                        <View style={[styles.error, { backgroundColor: colors.error + '18', borderColor: colors.error + '44' }]}>
                            <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                        </View>
                    ) : null}
                </ScrollView>

                <DetailBar items={items} open={openRow} onToggle={id => setOpenRow(id as Row)} accent={accent} />

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
                                {current ? 'Save changes' : 'Add habit'}
                            </Text>
                        )}
                    </Pressable>
                </View>
            </>
        </ComposerModal>
    );
}

const styles = StyleSheet.create({
    // The card is as tall as what it holds, so the written part grows with the
    // sentence and stops at a height that still leaves the settings and the
    // save button on screen; past that the sentence scrolls.
    written: { flexGrow: 0, flexShrink: 3, maxHeight: 190 },
    content: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
    input: { minHeight: 64, borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 16, lineHeight: 22, fontFamily: FontFamily.regular, textAlignVertical: 'top' },
    readRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    read: { flexShrink: 1, fontSize: 11, fontFamily: FontFamily.regular },
    days: { flexDirection: 'row', gap: 6 },
    day: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
    link: { paddingVertical: 6 },
    picker: { alignSelf: 'flex-start' },
    inline: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    notes: { flex: 1, minHeight: 70, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular, textAlignVertical: 'top' },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    amount: { minWidth: 56, textAlign: 'center', fontSize: 22, fontFamily: FontFamily.bold },
    icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    iconChoice: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    colour: { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
    error: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
    errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: FontFamily.regular },
    footer: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8 },
    save: { paddingVertical: 15, borderRadius: 999, alignItems: 'center' },
    saveText: { fontSize: 15, fontFamily: FontFamily.semibold },
});
