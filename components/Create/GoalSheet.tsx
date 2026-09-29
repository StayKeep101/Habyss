import React, { useEffect, useMemo, useRef, useState } from 'react';
import {ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import { AppIcon as Ionicons, type IconName } from '@/components/Common/AppIcon';
import { ComposerModal } from '@/components/Create/ComposerModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { AIBadge } from '@/components/Common/AIBadge';
import { Choices, DetailBar, type DetailItem } from '@/components/Create/DetailBar';
import { GoalCalendar } from '@/components/Create/GoalCalendar';
import { GoalUnitPicker } from '@/components/Create/GoalUnitPicker';
import { GoalLookPicker } from '@/components/Create/GoalLookPicker';
import { readableAccent } from '@/lib/colorContrast';
import { goalTextSegments } from '@/lib/goalTextHighlight';
import { goalUnitLabel } from '@/lib/goalUnits';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useSmartParse } from '@/hooks/useSmartParse';
import { smartParseGoal } from '@/lib/smartParse';
import { parseGoalText, type Direction, type GoalSpec, type GoalWindow, type HabitRef } from '@/lib/goalParser';
import { addHabit, updateHabit, getHabits, type Habit } from '@/lib/habitsSQLite';
import { localDateKey } from '@/lib/habitSchedule';
import { emit, on } from '@/lib/appEvents';

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

const blank = (): Draft => ({ title: '', direction: 'at_least', linked: [], icon: 'flag-outline', color: '#6B8AF5' });

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
    const window: GoalWindow | undefined = spec.window?.kind === 'fixed' ? spec.window : from.targetDate
        ? { kind: 'fixed', start: from.startDate, end: from.targetDate } : undefined;

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
        color: from.color || '#6B8AF5',
        description: from.description,
    };
};

const describeWindow = (draft: Draft): string => {
    if (draft.window?.kind === 'fixed') return `By ${pretty(draft.window.end)}`;
    return 'Not set';
};

const describeTarget = (draft: Draft): string => {
    if (draft.target === undefined && draft.deltaFromBaseline === undefined) return 'Not set';
    if (draft.target === undefined) return `${draft.deltaFromBaseline} ${draft.unit ?? ''} from now`.trim();
    const amount = draft.unit === 'percent' ? `${Math.round(draft.target * 100)}%` : `${draft.target} ${draft.unit ? goalUnitLabel(draft.unit) : ''}`;
    return amount.trim();
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
    const { primary: accent, foreground: accentText } = useAccentGradient();
    const { lightFeedback, successFeedback } = useHaptics();

    const [eventVisible, setEventVisible] = useState(false);
    const [editing, setEditing] = useState<Habit | null>(null);
    const [text, setText] = useState('');
    const [edits, setEdits] = useState<Partial<Draft>>({});
    const [openRow, setOpenRow] = useState<Row>(null);
    const [unitPicker, setUnitPicker] = useState(false);
    const [targetText, setTargetText] = useState<string | null>(null);
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
        setUnitPicker(false);
        setTargetText(null);
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
    // An existing goal is left exactly as it was saved until the user edits the
    // sentence; re-reading its own title would quietly rewrite its target. The
    // model is not asked either — its answer would only be thrown away.
    const untouched = !!current && text.trim() === (current.name ?? '').trim();
    const smart = useSmartParse(text, value => smartParseGoal(value, { habits }), 650, !untouched);
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
            window: spec.window?.kind === 'fixed' ? spec.window : start.window,
            deadline: spec.window?.kind === 'fixed' ? spec.window.end : start.deadline,
            baseline: spec.baseline ?? start.baseline,
            deltaFromBaseline: spec.delta_from_baseline ?? start.deltaFromBaseline,
            linked: spec.linked_habits.length ? spec.linked_habits : start.linked,
            suggested: spec.suggested_habit ?? start.suggested,
        } : start;
        return { ...read, ...edits };
    }, [current, result, edits]);

    const close = () => { setEventVisible(false); setEditing(null); onClose?.(); };
    const change = (patch: Partial<Draft>) => setEdits(current => ({ ...current, ...patch }));

    // A goal needs a starting point only when the target is relative to it.
    const needsBaseline = draft.deltaFromBaseline !== undefined && draft.target === undefined;
    const missing: { row: Exclude<Row, null>; what: string }[] = [];
    if (draft.target === undefined && draft.deltaFromBaseline === undefined) missing.push({ row: 'target', what: 'a number to hit' });
    else if (!draft.unit) missing.push({ row: 'target', what: 'what it is measured in' });
    if (needsBaseline && draft.baseline === undefined) missing.push({ row: 'baseline', what: 'where you are starting from' });
    if (draft.window?.kind !== 'fixed') missing.push({ row: 'window', what: 'a finish date' });
    const ready = !!text.trim() && missing.length === 0;

    const save = async () => {
        const title = draft.title.trim() || text.trim();
        if (!text.trim() || !title) return;
        if (missing.length > 0) { Keyboard.dismiss(); lightFeedback(); setOpenRow(missing[0].row); return; }
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

    const segments = goalTextSegments(text, rules?.goal);
    const toggleRow = (id: string | null) => { setUnitPicker(false); setOpenRow(id as Row); };

    const items: DetailItem[] = [
        {
            id: 'target', icon: 'flag-outline', label: 'Target',
            value: draft.target === undefined && draft.deltaFromBaseline === undefined ? undefined : describeTarget(draft),
            content: (
                <>
                    <View style={styles.targetRow}>
                        <TextInput
                            value={targetText ?? (draft.target === undefined ? '' : String(draft.unit === 'percent' ? Math.round(draft.target * 100) : draft.target))}
                            onChangeText={value => {
                                setTargetText(value);
                                const amount = Number(value.replace(',', '.'));
                                change({ target: value.trim() && Number.isFinite(amount) ? (draft.unit === 'percent' ? amount / 100 : amount) : undefined });
                            }}
                            onFocus={() => setUnitPicker(false)}
                            keyboardType="decimal-pad"
                            placeholder="0"
                            placeholderTextColor={colors.textTertiary}
                            accessibilityLabel="Target number"
                            style={[styles.number, {
                                color: colors.textPrimary, borderColor: colors.border,
                                backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)',
                            }]}
                        />
                        <Pressable accessibilityRole="button" accessibilityLabel="Choose target unit"
                            accessibilityState={{ expanded: unitPicker }}
                            onPress={() => { Keyboard.dismiss(); lightFeedback(); setUnitPicker(value => !value); }}
                            style={[styles.unitButton, { backgroundColor: accent + '18', borderColor: accent + '44' }]}>
                            <Text style={[styles.unitLabel, { color: accentText }]}>{draft.unit ? goalUnitLabel(draft.unit) : 'Unit'}</Text>
                            <Ionicons name={unitPicker ? 'chevron-up' : 'chevron-down'} size={14} color={accentText} />
                        </Pressable>
                    </View>
                    {unitPicker ? <GoalUnitPicker value={draft.unit} accent={accentText}
                        onChange={unit => {
                            // Keep the displayed amount when moving to or from percent.
                            const amount = draft.target === undefined ? undefined : draft.unit === 'percent' ? draft.target * 100 : draft.target;
                            change({ unit, target: amount === undefined ? undefined : unit === 'percent' ? amount / 100 : amount });
                            setUnitPicker(false);
                        }} />
                        : <Text style={[styles.help, { color: colors.textTertiary }]}>Set an amount, then tap the unit to choose how to measure it.</Text>}

                </>
            ),
        },
        {
            id: 'window', icon: 'calendar-outline', label: 'By when',
            value: draft.window ? describeWindow(draft) : undefined,
            content: (
                    <GoalCalendar key={openRow === 'window' ? 'open-calendar' : 'closed-calendar'}
                        value={draft.window?.kind === 'fixed' ? draft.window.end : undefined} accent={accentText}
                        onChange={end => change({ deadline: end, window: {
                            kind: 'fixed', start: draft.window?.kind === 'fixed' && draft.window.start <= end ? draft.window.start : localDateKey(new Date()), end,
                        } })} />
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
            id: 'look', icon: draft.icon, color: readableAccent(draft.color, colors.background), label: 'Look',
            content: <GoalLookPicker icon={draft.icon} color={draft.color} onChange={change} />,
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
                        key={session}
                        {...(Platform.OS === 'web' ? { value: text } : {})}
                        onChangeText={value => { setText(value); setTargetText(null); }}
                        selectionColor={accent}
                        onFocus={() => { setOpenRow(null); setUnitPicker(false); }}
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
                    >
                        {Platform.OS !== 'web' ? <Text>{segments.map((part, index) =>
                            <Text key={index} style={{ color: part.highlighted ? accentText : colors.textPrimary }}>{part.text}</Text>
                        )}</Text> : null}
                    </TextInput>

                    {draft.title && draft.title !== text.trim() ? (
                        <View style={styles.readRow}>
                            <Text numberOfLines={1} style={[styles.read, { color: colors.textSecondary }]}>
                                Goal: <Text style={{ color: colors.textPrimary, fontFamily: FontFamily.medium }}>{draft.title}</Text>
                            </Text>
                            <AIBadge thinking={smart.thinking} used={!!smart.result} color={accent} />
                        </View>
                    ) : null}


                    {result?.goal.window?.kind === 'recurring' && !draft.window ? <Text style={[styles.help, { color: colors.textSecondary }]}>Goals have one finish date. Choose when you want to complete this goal.</Text> : null}

                    {error ? (
                        <View style={[styles.error, { backgroundColor: colors.error + '18', borderColor: colors.error + '44' }]}>
                            <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
                            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
                        </View>
                    ) : null}
                </ScrollView>

                <DetailBar fitContent items={items} open={openRow} onToggle={toggleRow} accent={accent} />

                <View style={styles.footer}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !text.trim() }}
                        disabled={!text.trim() || saving}
                        onPress={save}
                        style={[styles.save, { backgroundColor: ready ? accent : (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)') }]}
                    >
                        {saving ? <ActivityIndicator color="#000" size="small" /> : (
                            <Text style={[styles.saveText, { color: ready ? '#000' : colors.textSecondary }]}>
                                {ready ? (current ? 'Save changes' : 'Create goal') : (!draft.title.trim() ? 'Describe your goal' : `Add ${missing[0]?.what}`)}
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
    number: { width: 110, borderWidth: 1, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 11, fontSize: 17, fontFamily: FontFamily.semibold },
    unitButton: { minWidth: 118, minHeight: 46, borderWidth: 1, borderRadius: 11, paddingHorizontal: 14, flexDirection: 'row', gap: 14, alignItems: 'center', justifyContent: 'space-between' },
    unitLabel: { fontSize: 13, fontFamily: FontFamily.regular },
    help: { fontSize: 12, lineHeight: 18, fontFamily: FontFamily.regular },
    notes: { minHeight: 70, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular, textAlignVertical: 'top' },
    error: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
    errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: FontFamily.regular },
    footer: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8 },
    save: { paddingVertical: 15, borderRadius: 999, alignItems: 'center' },
    saveText: { fontSize: 15, fontFamily: FontFamily.semibold },
});
