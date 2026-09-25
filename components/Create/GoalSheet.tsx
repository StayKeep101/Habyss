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
import { smartParseGoal } from '@/lib/smartParse';
import { parseGoalText, ALLOWED_UNITS, type Direction, type GoalSpec, type GoalWindow, type HabitRef } from '@/lib/goalParser';
import { addHabit, updateHabit, getHabits, type Habit } from '@/lib/habitsSQLite';
import { localDateKey } from '@/lib/habitSchedule';
import { emit, on } from '@/lib/appEvents';

const ICONS: IconName[] = [
    'flag-outline', 'trophy-outline', 'barbell-outline', 'book-outline', 'wallet-outline',
    'heart-outline', 'briefcase-outline', 'leaf-outline', 'rocket-outline', 'school-outline',
];
const COLORS = ['#6B8AF5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

const DIRECTIONS: { id: Direction; label: string }[] = [
    { id: 'at_least', label: 'At least' },
    { id: 'at_most', label: 'At most' },
    { id: 'reach', label: 'Reach' },
];

type Row = 'target' | 'window' | 'baseline' | 'tracks' | 'look' | 'notes' | null;

interface Draft {
    title: string;
    target?: number;
    unit?: string;
    direction: Direction;
    window?: GoalWindow;
    /** A fixed window's end, kept separate so the date picker has something to show. */
    deadline?: string;
    baseline?: number;
    deltaFromBaseline?: number;
    linked: string[];
    suggested?: { name: string; unit: string } | null;
    icon: IconName;
    color: string;
    description?: string;
}

const blank = (): Draft => ({ title: '', direction: 'at_least', linked: [], icon: 'flag-outline', color: COLORS[0] });

const iso = (date: Date) => localDateKey(date);
const dateFrom = (value?: string) => {
    const date = value ? new Date(`${value}T12:00:00`) : new Date(Date.now() + 30 * 86400000);
    return Number.isNaN(date.getTime()) ? new Date(Date.now() + 30 * 86400000) : date;
};
const pretty = (value?: string) =>
    value ? dateFrom(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** An existing goal read back out: its contract when it has one, its columns otherwise. */
const fromGoal = (from: Habit): Draft => {
    let spec: Partial<GoalSpec> = {};
    try { spec = from.goalSpec ? JSON.parse(from.goalSpec) : {}; } catch { spec = {}; }
    const window: GoalWindow | undefined = spec.window ?? (from.targetDate
        ? { kind: 'fixed', start: from.startDate, end: from.targetDate }
        : { kind: 'recurring', period: from.goalPeriod === 'weekly' ? 'week' : from.goalPeriod === 'monthly' ? 'month' : 'day' });

    return {
        title: from.name,
        target: spec.target ?? (from.unit === 'percent' ? from.goalValue / 100 : from.goalValue),
        unit: spec.metric_unit ?? from.unit,
        direction: spec.direction ?? 'at_least',
        window,
        deadline: window?.kind === 'fixed' ? window.end : undefined,
        baseline: spec.baseline ?? undefined,
        deltaFromBaseline: spec.delta_from_baseline ?? undefined,
        linked: spec.linked_habits ?? [],
        suggested: spec.suggested_habit ?? null,
        icon: (from.icon as IconName) || 'flag-outline',
        color: from.color || COLORS[0],
        description: from.description,
    };
};

const describeWindow = (draft: Draft): string => {
    if (draft.window?.kind === 'recurring') return `Every ${draft.window.period}`;
    if (draft.window?.kind === 'fixed') return `By ${pretty(draft.window.end)}`;
    return 'Not set';
};

const describeTarget = (draft: Draft): string => {
    if (draft.target === undefined && draft.deltaFromBaseline === undefined) return 'Not set';
    const label = DIRECTIONS.find(item => item.id === draft.direction)?.label ?? '';
    if (draft.target === undefined) return `${label} ${draft.deltaFromBaseline} ${draft.unit ?? ''} from now`.trim();
    const amount = draft.unit === 'percent' ? `${Math.round(draft.target * 100)}%` : `${draft.target} ${draft.unit ?? ''}`;
    return `${label} ${amount}`.trim();
};

/**
 * Making a goal, and changing one, in one sheet.
 *
 * A goal only counts for anything if it reduces to a number, a unit and a
 * window, so the sheet reads those out of the sentence and then puts each one
 * on its own row. What the parser could not work out is a row to fill rather
 * than a locked button: the old sheet refused to save and sent the user to a
 * separate step-by-step wizard, which is now gone.
 */
export const GoalSheet: React.FC<{
    visible?: boolean;
    onClose?: () => void;
    onSaved?: () => void;
    goal?: Habit | null;
    listenToGlobalEvents?: boolean;
}> = ({ visible, onClose, onSaved, goal, listenToGlobalEvents }) => {
    const { theme } = useTheme();
    const colors = Colors[theme];
    const isLight = theme === 'light';
    const { primary: accent } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();

    const [eventVisible, setEventVisible] = useState(false);
    const [editing, setEditing] = useState<Habit | null>(null);
    const [text, setText] = useState('');
    const [edits, setEdits] = useState<Partial<Draft>>({});
    const [openRow, setOpenRow] = useState<Row>(null);
    const [picker, setPicker] = useState(false);
    const [habits, setHabits] = useState<HabitRef[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const savingRef = useRef(false);

    const current = goal ?? editing;
    const isOpen = listenToGlobalEvents ? eventVisible : !!visible;

    // Opening the sheet on something new clears the last one. Done while
    // rendering rather than in an effect, so the first frame is already blank.
    const session = isOpen ? (current?.id ?? 'new') : 'closed';
    const [lastSession, setLastSession] = useState('closed');
    if (session !== lastSession) {
        setLastSession(session);
        // Editing starts from the goal's own words, so clearing the field
        // clears it rather than falling back to the old title.
        setText(current?.name ?? '');
        setEdits({});
        setOpenRow(null);
        setPicker(false);
        setError(null);
    }

    useEffect(() => {
        if (!listenToGlobalEvents) return;
        const subscription = on('show_goal_quick_add', (data) => {
            emit('close_creation_modal');
            setEditing((data?.goal ?? null) as Habit | null);
            setEventVisible(true);
        });
        return () => subscription.remove();
    }, [listenToGlobalEvents]);

    useEffect(() => {
        if (!isOpen) return;
        getHabits()
            .then(all => setHabits(all.filter(item => !item.isGoal && !item.isArchived).map(item => ({ id: item.id, name: item.name, unit: item.unit }))))
            .catch(() => setHabits([]));
    }, [isOpen]);

    // Rules answer instantly; the on-device model's reading replaces them once it arrives.
    const rules = useMemo(
        () => (text.trim() ? parseGoalText(text, { today: new Date(), habits }) : null),
        [text, habits],
    );
    const smart = useSmartParse(text, value => smartParseGoal(value, { habits }));
    // An existing goal is left exactly as it was saved until the user edits the
    // sentence; re-reading its own title would quietly rewrite its target.
    const untouched = !!current && text.trim() === (current.name ?? '').trim();
    const result = untouched ? null : (smart.result ?? rules);

    const draft = useMemo<Draft>(() => {
        const start = current ? fromGoal(current) : blank();
        const spec = result?.goal;
        const read: Draft = spec ? {
            ...start,
            title: spec.title || start.title,
            target: spec.target ?? start.target,
            unit: spec.metric_unit ?? start.unit,
            direction: spec.direction ?? start.direction,
            window: spec.window ?? start.window,
            deadline: spec.window?.kind === 'fixed' ? spec.window.end : start.deadline,
            baseline: spec.baseline ?? start.baseline,
            deltaFromBaseline: spec.delta_from_baseline ?? start.deltaFromBaseline,
            linked: spec.linked_habits.length ? spec.linked_habits : start.linked,
            suggested: spec.suggested_habit ?? start.suggested,
        } : start;
        return { ...read, ...edits };
    }, [current, result, edits]);

    const close = () => { setEventVisible(false); setEditing(null); onClose?.(); };
    const toggleRow = (row: Row) => setOpenRow(value => (value === row ? null : row));
    const change = (patch: Partial<Draft>) => setEdits(current => ({ ...current, ...patch }));

    // A goal needs a starting point only when the target is relative to it.
    const needsBaseline = draft.deltaFromBaseline !== undefined && draft.target === undefined;
    const missing: { row: Exclude<Row, null>; what: string }[] = [];
    if (draft.target === undefined && draft.deltaFromBaseline === undefined) missing.push({ row: 'target', what: 'a number to hit' });
    else if (!draft.unit) missing.push({ row: 'target', what: 'what it is measured in' });
    if (needsBaseline && draft.baseline === undefined) missing.push({ row: 'baseline', what: 'where you are starting from' });
    if (!draft.window) missing.push({ row: 'window', what: 'by when' });
    const ready = !!draft.title.trim() && missing.length === 0;

    const save = async () => {
        const title = draft.title.trim() || text.trim();
        if (!title) return;
        if (missing.length > 0) { lightFeedback(); setOpenRow(missing[0].row); return; }
        if (savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        setError(null);
        try {
            // "Lose 5 kg" only becomes a number once we know the starting weight.
            const target = draft.target ?? (draft.baseline !== undefined && draft.deltaFromBaseline !== undefined
                ? draft.baseline - draft.deltaFromBaseline
                : undefined);
            const window = draft.window!;
            const spec: GoalSpec = {
                title,
                type: result?.goal.type ?? (window.kind === 'recurring' ? 'frequency' : 'volume'),
                metric_unit: draft.unit ?? 'sessions',
                aggregation: result?.goal.aggregation ?? (draft.unit === 'percent' ? 'completion_rate' : 'sum'),
                direction: draft.direction,
                target: target ?? null,
                baseline: draft.baseline ?? null,
                delta_from_baseline: draft.deltaFromBaseline ?? null,
                window,
                linked_habits: draft.linked,
                suggested_habit: draft.suggested ?? null,
            };

            const fields: Partial<Habit> = {
                name: title,
                description: draft.description,
                isGoal: true,
                type: 'build',
                category: current?.category ?? 'personal',
                icon: draft.icon,
                color: draft.color,
                // percent targets are stored 0-1 in the spec; goal_value is an integer.
                goalValue: spec.metric_unit === 'percent'
                    ? Math.round((spec.target ?? 0) * 100)
                    : Math.round(spec.target ?? 1),
                unit: spec.metric_unit ?? 'sessions',
                goalPeriod: window.kind === 'recurring'
                    ? (window.period === 'day' ? 'daily' : window.period === 'week' ? 'weekly' : 'monthly')
                    : 'daily',
                startDate: current?.startDate ?? (window.kind === 'fixed' ? window.start : localDateKey(new Date())),
                targetDate: window.kind === 'fixed' ? window.end : undefined,
                // The full contract, so the goal stays calculable.
                goalSpec: JSON.stringify(spec),
            };

            if (current) await updateHabit({ id: current.id, ...fields });
            else if (!(await addHabit(fields))?.id) throw new Error('not saved');

            successFeedback();
            emit('habit_updated', { habitId: current?.id });
            onSaved?.();
            close();
        } catch {
            setError('Could not save that goal. Nothing was lost — try again.');
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    const windowChoice = draft.window?.kind === 'fixed' ? 'date' : draft.window?.period ?? '';

    const items: DetailItem[] = [
        {
            id: 'target', icon: 'flag-outline', label: 'Target',
            value: draft.target === undefined && draft.deltaFromBaseline === undefined ? undefined : describeTarget(draft),
            content: (
                <>
                    <View style={styles.targetRow}>
                        <TextInput
                            value={draft.target === undefined ? '' : String(draft.unit === 'percent' ? Math.round(draft.target * 100) : draft.target)}
                            onChangeText={value => {
                                const amount = Number(value.replace(',', '.'));
                                change({ target: value.trim() && Number.isFinite(amount) ? (draft.unit === 'percent' ? amount / 100 : amount) : undefined });
                            }}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={colors.textTertiary}
                            accessibilityLabel="Target number"
                            style={[styles.number, {
                                color: colors.textPrimary, borderColor: colors.border,
                                backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)',
                            }]}
                        />
                        <Text style={[styles.unitLabel, { color: colors.textTertiary }]}>{draft.unit ?? 'pick a unit'}</Text>
                    </View>
                    <Choices options={DIRECTIONS} value={draft.direction} accent={accent} onChange={direction => change({ direction })} />
                    <Choices
                        options={ALLOWED_UNITS.map(unit => ({ id: unit as string, label: unit }))}
                        value={draft.unit ?? ''}
                        accent={accent}
                        onChange={unit => change({ unit })}
                    />
                </>
            ),
        },
        {
            id: 'window', icon: 'calendar-outline', label: 'By when',
            value: draft.window ? describeWindow(draft) : undefined,
            content: (
                <>
                    <Choices
                        options={[
                            { id: 'day', label: 'Every day' }, { id: 'week', label: 'Every week' },
                            { id: 'month', label: 'Every month' }, { id: 'date', label: 'By a date' },
                        ]}
                        value={windowChoice}
                        accent={accent}
                        onChange={id => {
                            if (id === 'date') {
                                const end = draft.deadline ?? iso(dateFrom(undefined));
                                change({ window: { kind: 'fixed', start: localDateKey(new Date()), end }, deadline: end });
                                setPicker(true);
                                return;
                            }
                            setPicker(false);
                            change({ window: { kind: 'recurring', period: id as 'day' | 'week' | 'month' } });
                        }}
                    />
                    {draft.window?.kind === 'fixed' ? (
                        <>
                            <Pressable onPress={() => { lightFeedback(); setPicker(value => !value); }} style={styles.link}>
                                <Text style={{ color: accent, fontSize: 13, fontFamily: FontFamily.medium }}>{pretty(draft.deadline)}</Text>
                            </Pressable>
                            {picker ? (
                                <DateTimePicker
                                    value={dateFrom(draft.deadline)}
                                    mode="date"
                                    minimumDate={new Date()}
                                    display={Platform.OS === 'ios' ? 'compact' : 'default'}
                            style={styles.picker}
                                    themeVariant={isLight ? 'light' : 'dark'}
                                    onChange={(_event, selected) => {
                                        if (Platform.OS !== 'ios') setPicker(false);
                                        if (!selected) return;
                                        const end = iso(selected);
                                        change({ deadline: end, window: { kind: 'fixed', start: draft.window?.kind === 'fixed' ? draft.window.start : localDateKey(new Date()), end } });
                                    }}
                                />
                            ) : null}
                        </>
                    ) : null}
                </>
            ),
        },
        ...(needsBaseline ? [{
            id: 'baseline', icon: 'locate-outline' as const, label: 'Starting from',
            value: draft.baseline === undefined ? undefined : `${draft.baseline} ${draft.unit ?? ''}`.trim(),
            content: (
                <>
                    <Text style={[styles.help, { color: colors.textSecondary }]}>
                        {result?.clarifying_question ?? `What is your ${draft.unit ?? 'current value'} right now?`}
                    </Text>
                    <TextInput
                        value={draft.baseline === undefined ? '' : String(draft.baseline)}
                        onChangeText={value => {
                            const amount = Number(value.replace(',', '.'));
                            change({ baseline: value.trim() && Number.isFinite(amount) ? amount : undefined });
                        }}
                        keyboardType="decimal-pad"
                        placeholder={`Current ${draft.unit ?? 'value'}`}
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Current value"
                        style={[styles.number, {
                            color: colors.textPrimary, borderColor: colors.border,
                            backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)',
                        }]}
                    />
                </>
            ),
        }] : []),
        ...(habits.length > 0 ? [{
            id: 'tracks', icon: 'link-outline' as const, label: 'Counts from',
            value: draft.linked.length ? `${draft.linked.length} habit${draft.linked.length === 1 ? '' : 's'}` : undefined,
            content: (
                <>
                    <Text style={[styles.help, { color: colors.textSecondary }]}>Which habits move this goal forward.</Text>
                    <Choices
                        options={habits.map(habit => ({ id: habit.id, label: habit.name }))}
                        value={draft.linked}
                        multiple
                        accent={accent}
                        onChange={id => change({
                            linked: draft.linked.includes(id) ? draft.linked.filter(item => item !== id) : [...draft.linked, id],
                        })}
                    />
                </>
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
            id: 'notes', icon: 'document-text-outline', label: 'Why it matters',
            value: draft.description ? 'Written' : undefined,
            content: (
                <TextInput
                    value={draft.description ?? ''}
                    onChangeText={description => change({ description })}
                    multiline
                    placeholder="What changes when you get there?"
                    placeholderTextColor={colors.textTertiary}
                    accessibilityLabel="Why this goal matters"
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
            {/* Every setting rides above the keyboard, so writing the goal and
                pinning down its number and its deadline are one motion. */}
            <>
                <ModalHeader title={current ? 'Edit goal' : 'New goal'} onBack={close} backIcon="close" />

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
                        multiline
                        placeholder="Run 50km this month"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Describe your goal"
                        style={[styles.input, {
                            color: colors.textPrimary, borderColor: colors.border,
                            backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                        }]}
                    />

                    {draft.title && draft.title !== text.trim() ? (
                        <View style={styles.readRow}>
                            <Text numberOfLines={1} style={[styles.read, { color: colors.textSecondary }]}>
                                Goal: <Text style={{ color: colors.textPrimary, fontFamily: FontFamily.medium }}>{draft.title}</Text>
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
                        accessibilityState={{ disabled: !draft.title.trim() }}
                        disabled={!draft.title.trim() || saving}
                        onPress={save}
                        style={[styles.save, { backgroundColor: ready ? accent : (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)') }]}
                    >
                        {saving ? <ActivityIndicator color="#000" size="small" /> : (
                            <Text style={[styles.saveText, { color: ready ? '#000' : colors.textSecondary }]}>
                                {ready ? (current ? 'Save changes' : 'Create goal') : `Add ${missing[0]?.what}`}
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
    targetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    number: { minWidth: 96, borderWidth: 1, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11, fontSize: 17, fontFamily: FontFamily.semibold },
    unitLabel: { fontSize: 13, fontFamily: FontFamily.regular },
    help: { fontSize: 12, lineHeight: 18, fontFamily: FontFamily.regular },
    link: { paddingVertical: 6 },
    picker: { alignSelf: 'flex-start' },
    notes: { flex: 1, minHeight: 70, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular, textAlignVertical: 'top' },
    icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    iconChoice: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    colour: { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
    error: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
    errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: FontFamily.regular },
    footer: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8 },
    save: { paddingVertical: 15, borderRadius: 999, alignItems: 'center' },
    saveText: { fontSize: 15, fontFamily: FontFamily.semibold },
});
