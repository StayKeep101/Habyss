import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MatteInput } from '@/components/ui/MatteInput';
import { AppIcon as Ionicons, type IconName } from '@/components/ui/AppIcon';
import { ComposerModal } from '@/components/Create/ComposerModal';
import { ShareParticipantsSheet } from '@/components/Social/ShareParticipantsSheet';
import { useShareDraft } from '@/hooks/useShareDraft';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { AIBadge } from '@/components/Common/AIBadge';
import { Choices, DetailBar, type DetailItem } from '@/components/Create/DetailBar';
import { CreationTextInput } from '@/components/Create/CreationTextInput';
import { DictateField } from '@/components/Create/DictateField';
import { TypingPlaceholder } from '@/components/ui/TypingPlaceholder';
import { RepeatPicker } from '@/components/Create/RepeatPicker';
import { TimeRange, endTime } from '@/components/Create/TimeRange';
import { DAILY, describe as describeRule, parseRecurrence, serialiseRecurrence, type Recurrence, type Weekday } from '@/lib/recurrence';
import { GoalLookPicker } from '@/components/Create/GoalLookPicker';
import { LookButton } from '@/components/Create/LookButton';
import { ReminderPicker } from '@/components/Create/ReminderPicker';
import { MeasureField } from '@/components/Create/MeasureField';
import { habitTextSegments } from '@/lib/creationTextHighlight';
import { readableAccent } from '@/lib/colorContrast';
import { healthLabel, metricsForUnit, type HealthMetric } from '@/lib/healthMetrics';
import { shortLead } from '@/lib/leadTime';
import { Colors } from '@/theme/colors';
import { FontFamily } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useSmartParse } from '@/hooks/useSmartParse';
import { smartParseHabit } from '@/lib/smartParse';
import { parseHabitText } from '@/lib/habitParser';
import { addHabit, updateHabit, getGoals, type Habit, type LocationReminder } from '@/lib/habitsSQLite';
import { localDateKey } from '@/lib/habitSchedule';
import { NotificationService } from '@/lib/notificationService';
import { emit, on } from '@/lib/appEvents';


/** Typed out in the empty box, for a little inspiration. */
const HABIT_EXAMPLES = ['Gym Monday, Wednesday, Friday at 6', 'Read 20 pages every night', 'Meditate 10 minutes each morning', 'Walk 8000 steps daily'];

const DAYS: { id: string; label: string }[] = [
    { id: 'mon', label: 'M' }, { id: 'tue', label: 'T' }, { id: 'wed', label: 'W' },
    { id: 'thu', label: 'T' }, { id: 'fri', label: 'F' }, { id: 'sat', label: 'S' }, { id: 'sun', label: 'S' },
];
const EVERY_DAY = DAYS.map(day => day.id);
type Row = 'repeat' | 'time' | 'target' | 'reminder' | 'priority' | 'goal' | 'look' | 'notes' | null;

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
    /** Minutes before the start time, when the reminder should lead it. */
    reminderOffset?: number;
    /** One sentence for this habit; Echo writes it when this is empty. */
    reminderMessage?: string;
    /** Apple Health answers for this habit, when its unit lets it. */
    health?: HealthMetric;
    /** The geofences this habit listens for, arriving or leaving. */
    places: LocationReminder[];
    /** How often it comes round, in the full grammar. */
    rule: Recurrence;
    /** 1 high, 2 normal, 3 low: where the timeline fits it when it has no time. */
    priority?: 1 | 2 | 3;
}

const PRIORITIES: { id: 1 | 2 | 3; label: string }[] = [
    { id: 1, label: 'High' },
    { id: 2, label: 'Normal' },
    { id: 3, label: 'Low' },
];

const blank = (): Draft => ({ name: '', days: EVERY_DAY, icon: 'ellipse-outline', color: '#6B8AF5', rule: DAILY, places: [] });

const fromHabit = (from: Habit): Draft => ({
    name: from.name,
    priority: from.priority,
    days: from.taskDays?.length ? from.taskDays : EVERY_DAY,
    startTime: from.startTime,
    durationMinutes: from.durationMinutes,
    amount: from.goalValue > 0 && (from.trackingMethod === 'numeric' || from.goalValue !== 1 || !!from.unit && !['time', 'times', 'count'].includes(from.unit)) ? from.goalValue : undefined,
    unit: from.unit && from.unit !== 'time' ? from.unit : undefined,
    reminder: from.reminders?.[0],
    goalId: from.goalId,
    icon: (from.icon as IconName) || 'ellipse-outline',
    color: from.color || '#6B8AF5',
    description: from.description,
    // A habit saved before the fuller grammar is read back from the columns
    // it does have, so editing it does not silently change its schedule.
    rule: parseRecurrence(from.recurrence) ?? ruleFromColumns(from),
    reminderOffset: from.reminderOffset,
    reminderMessage: from.reminderMessage,
    health: from.healthKitMetric,
    places: from.locationReminders ?? [],
});

/** The rule a habit saved under the older columns was really describing. */
function ruleFromColumns(from: Habit): Recurrence {
    const every = Math.max(1, Math.floor(from.weekInterval || 1));
    if (from.frequency === 'monthly') return { kind: 'monthly', every: 1, dates: [1] };
    if (from.frequency === 'yearly') return { kind: 'yearly', every: 1, months: [] };
    const weekdays = (from.taskDays?.length ? from.taskDays : EVERY_DAY) as Weekday[];
    return { kind: 'weekly', every, weekdays };
}

/** What the Reminder chip says when it is closed. */
const describeReminder = (draft: Draft): string | undefined => {
    const parts: string[] = [];
    if (draft.reminder) {
        parts.push(draft.reminderOffset ? `${shortLead(draft.reminderOffset)} ${draft.reminder}` : draft.reminder);
    }
    if (draft.places.length) parts.push(draft.places.length === 1 ? draft.places[0].name : `${draft.places.length} places`);
    return parts.length ? parts.join(' · ') : undefined;
};

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
    const { primary: appAccent } = useAccentGradient();
    const { successFeedback } = useHaptics();

    const [eventVisible, setEventVisible] = useState(false);
    const [editing, setEditing] = useState<Habit | null>(null);
    const [prefill, setPrefill] = useState('');
    const [eventGoal, setEventGoal] = useState<string | undefined>(undefined);
    const [text, setText] = useState('');
    const [edits, setEdits] = useState<Partial<Draft>>({});
    const [openRow, setOpenRow] = useState<Row>(null);
    const [amountText, setAmountText] = useState<string | null>(null);

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
        setAmountText(null);
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
    // Opening an existing habit must not rewrite it. "Run everyday" reads as a
    // habit called "Run" that repeats daily, which is right for a sentence
    // someone just typed and wrong for a name they chose and saved. So nothing
    // is read out of the text until they actually change it — and the model is
    // not woken to read it either.
    const untouched = !!current && text.trim() === (current.name ?? '').trim();
    const smart = useSmartParse(text, smartParseHabit, 650, !untouched);
    const parsed = untouched ? null : (smart.result ?? rules);

    const draft = useMemo<Draft>(() => {
        const start = current ? fromHabit(current) : { ...blank(), goalId: eventGoal };
        const days = parsed?.taskDays?.length ? parsed.taskDays : rules?.matched.days ? EVERY_DAY : start.days;
        const read: Draft = parsed ? {
            ...start,
            name: parsed.name || start.name,
            days,
            // Days read out of the sentence have to reach the schedule, and the
            // schedule is the rule now. Naming days is always a weekly rule,
            // whatever the draft started as; a rule the user built by hand
            // still wins, because their edits are applied after this.
            rule: parsed.taskDays?.length
                ? { kind: 'weekly', every: start.rule.kind === 'weekly' ? start.rule.every : 1, weekdays: days as Weekday[] }
                : start.rule,
            startTime: parsed.startTime ?? start.startTime,
            durationMinutes: parsed.durationMinutes ?? start.durationMinutes,
            amount: parsed.targetValue ?? start.amount,
            unit: parsed.targetUnit ?? start.unit,
        } : start;
        return { ...read, ...edits };
    }, [current, eventGoal, parsed, edits, rules]);
    // Everything in the sheet wears the colour chosen for this goal or habit:
    // the chosen chips, the bar's open chip, the calendar — not the app accent.
    const accent = draft.color || appAccent;
    const accentText = readableAccent(accent, colors.background);

    const linkedGoal = goalId ?? draft.goalId;
    // Deciding to do this with somebody happens while writing it, not after —
    // so the choice is held here and sent the moment the habit has an id.
    const share = useShareDraft('habit', current?.id);
    const close = () => { setEventVisible(false); setEditing(null); share.close(); onClose?.(); };
    const toggleRow = (id: string | null) => { setOpenRow(id as Row); };
    const change = (patch: Partial<Draft>) => setEdits(current => ({ ...current, ...patch }));

    const save = async () => {
        const name = draft.name.trim() || text.trim();
        if (!text.trim() || !name || savingRef.current) return;
        if (draft.amount !== undefined && (!Number.isFinite(draft.amount) || draft.amount <= 0 || draft.amount > 100000000)) {
            setError('Choose an amount greater than zero and no more than 100,000,000.'); setOpenRow('target'); return;
        }
        if (draft.days.length === 0) { setError('Choose at least one day for this habit.'); setOpenRow('repeat'); return; }
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
                reminders: current && !Object.prototype.hasOwnProperty.call(edits, 'reminder')
                    ? current.reminders : draft.reminder ? [draft.reminder] : [],
                goalId: linkedGoal,
                icon: draft.icon,
                color: draft.color,
                type: current?.type ?? 'build',
                recurrence: serialiseRecurrence(draft.rule),
                frequency: draft.rule.kind === 'monthly' ? 'monthly' : draft.rule.kind === 'yearly' ? 'yearly' : 'daily',
                weekInterval: draft.rule.kind === 'weekly' ? draft.rule.every : 1,
                reminderOffset: draft.reminderOffset,
                reminderMessage: draft.reminderMessage?.trim() || undefined,
                priority: draft.priority ?? 2,
                locationReminders: draft.places,
                // Dropped when the unit no longer measures what Health does, so
                // an edit cannot leave a step count answering for pages.
                healthKitMetric: draft.health && metricsForUnit(draft.unit === 'min' ? 'minutes' : draft.unit).includes(draft.health)
                    ? draft.health : undefined,
                goalPeriod: current?.goalPeriod ?? 'daily',
                category: current?.category ?? 'personal',
                startDate: current?.startDate ?? localDateKey(new Date()),
            };

            if (current) await updateHabit({ id: current.id, ...fields });
            else {
                const made = await addHabit(fields);
                if (!made?.id) throw new Error('not saved');
                // After it exists, and never blocking: the habit is saved, and
                // an invitation that did not reach a friend is not a lost habit.
                await share.applyTo(made.id);
            }

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

    // 'min' is how the sheet spells minutes; the metrics speak in full words.
    const healthOptions = metricsForUnit(draft.unit === 'min' ? 'minutes' : draft.unit);
    const goalName = goals.find(goal => goal.id === linkedGoal)?.name;
    const canSave = !!text.trim();

    const items: DetailItem[] = [
        {
            id: 'repeat', icon: 'repeat', label: 'Repeat', value: describeRule(draft.rule),
            content: <RepeatPicker value={draft.rule} accent={accent} onChange={rule => change({ rule })} />,
        },
        {
            id: 'time', icon: 'time-outline', label: 'Time',
            value: draft.startTime
                ? (draft.durationMinutes ? `${draft.startTime} → ${endTime(draft.startTime, draft.durationMinutes)}` : draft.startTime)
                : undefined,
            content: (
                <TimeRange
                    start={draft.startTime}
                    minutes={draft.durationMinutes}
                    accent={accent}
                    onChange={next => change({ startTime: next.start, durationMinutes: next.minutes })}
                />
            ),
        },
        {
            id: 'target', icon: 'stats-chart-outline', label: 'Measure',
            value: draft.amount ? `${draft.amount} ${draft.unit ?? 'times'}` : undefined,
            content: (
                <>
                    <MeasureField
                        amountLabel="Habit target number"
                        amount={amountText ?? (draft.amount === undefined ? '' : String(draft.amount))}
                        onAmount={value => {
                            setAmountText(value);
                            const amount = Number(value.replace(',', '.'));
                            change({ amount: value.trim() ? amount : undefined, unit: draft.unit ?? 'times' });
                        }}
                        unit={draft.unit === 'min' ? 'minutes' : draft.unit === 'times' ? 'sessions' : draft.unit}
                        onUnit={unit => change({ unit: unit === 'minutes' ? 'min' : unit === 'sessions' ? 'times' : unit, amount: draft.amount ?? 1 })}
                        accent={accentText}
                        onClear={draft.amount !== undefined ? () => { change({ amount: undefined, unit: undefined }); setAmountText(null); } : undefined}
                    />

                    {/* Who answers for this habit. Only shown when Health
                        measures the same thing the habit does — offering to
                        fill "8 glasses" from a step count would be worse than
                        offering nothing, because the number would look right. */}
                    {healthOptions.length ? (
                        <>
                            <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>Who counts it</Text>
                            <Choices
                                options={[{ id: '', label: 'You do' },
                                    ...healthOptions.map(metric => ({ id: metric, label: healthLabel(metric) }))]}
                                value={draft.health ?? ''}
                                accent={accent}
                                onChange={id => change({ health: (id || undefined) as HealthMetric | undefined })}
                            />
                        </>
                    ) : null}
                </>
            ),
        },
        {
            id: 'reminder', icon: 'notifications-outline', label: 'Reminder', value: describeReminder(draft),
            content: (
                <ReminderPicker
                    startTime={draft.startTime}
                    value={{ reminder: draft.reminder, reminderOffset: draft.reminderOffset, places: draft.places }}
                    accent={accent}
                    onError={setError}
                    onChange={patch => change(patch)}
                />
            ),
        },
        {
            // Where the timeline fits it in when it has no set time.
            id: 'priority', icon: 'flame-outline', label: 'Priority',
            value: !draft.priority || draft.priority === 2 ? undefined : PRIORITIES.find(item => item.id === draft.priority)?.label,
            content: <Choices options={PRIORITIES} value={draft.priority ?? 2} accent={accent} onChange={priority => change({ priority })} />,
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
            id: 'look', icon: draft.icon, color: readableAccent(draft.color, colors.background), label: 'Look', hidden: true,
            content: <GoalLookPicker subject="Habit" icon={draft.icon} color={draft.color} onChange={change} />,
        },
        {
            id: 'notes', icon: 'document-text-outline', label: 'Note',
            value: draft.description ? 'Written' : undefined,
            content: (
                <MatteInput
                    // The row exists to be typed in, so opening it opens the
                    // keyboard. Anything else is a tap to reach the only thing
                    // the row does.
                    autoFocus
                    value={draft.description ?? ''}
                    onChangeText={description => change({ description })}
                    multiline
                    placeholder="Notes"
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
                <ModalHeader
                    title={current ? 'Edit habit' : 'New habit'}
                    onBack={close}
                    backIcon="close"
                    onAction={share.open}
                    actionIcon="person-add-outline"
                    actionLabel={share.pending.length
                        ? `Sharing with ${share.pending.length}` : 'Share with a friend'}
                />

                <ScrollView
                    style={styles.written}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    // Only rubber-bands when there is really more to see.
                    alwaysBounceVertical={false}
                >
                    <DictateField text={text} onText={value => { setText(value); setAmountText(null); }}
                        leading={<LookButton icon={draft.icon} color={draft.color} open={openRow === 'look'} onPress={() => toggleRow(openRow === 'look' ? null : 'look')} />}>
                        <TypingPlaceholder examples={HABIT_EXAMPLES} active={!text}>
                            {placeholder => (
                            <CreationTextInput
                                key={session} text={text} segments={habitTextSegments(text, rules)} accent={accentText} textColor={colors.textPrimary}
                                onChangeText={value => { setText(value); setAmountText(null); }}
                                onFocus={() => { setOpenRow(null); }}
                                // Open ready to type, editing as well as creating: the
                                // caret lands after what is already written, so the first
                                // keystroke adds to it rather than replacing it.
                                autoFocus
                                placeholder={placeholder}
                                placeholderTextColor={colors.textTertiary}
                                accessibilityLabel="Describe the habit"
                                multiline
                                style={[styles.input, {
                                    color: colors.textPrimary, borderColor: colors.border,
                                    backgroundColor: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.05)',
                                }]}
                            />
                            )}
                        </TypingPlaceholder>
                    </DictateField>

                    {(draft.name && draft.name !== text.trim()) || smart.request || smart.thinking || smart.result ? (
                        <View style={styles.readRow}>
                            <Text numberOfLines={1} style={[styles.read, { color: colors.textSecondary }]}>
                                Habit: <Text style={{ color: colors.textPrimary, fontFamily: FontFamily.medium }}>{draft.name}</Text>
                            </Text>
                            <AIBadge thinking={smart.thinking} used={!!smart.result} color={accent} onRequest={smart.request} failed={smart.failed} />
                        </View>
                    ) : null}

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
            <ShareParticipantsSheet
                visible={share.picking}
                title={current ? 'Share habit' : 'Do it together'}
                subtitle={draft.name.trim() || text.trim() || 'This habit'}
                loadShared={share.loadShared}
                applyChanges={share.applyChanges}
                onClose={share.close}
            />
        </ComposerModal>
    );
}

const styles = StyleSheet.create({
    clockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    placeCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, gap: 10 },
    placeHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    placeIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    placeTitle: { fontSize: 14, fontFamily: FontFamily.semibold },
    placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    placeName: { flex: 1, fontSize: 14, fontFamily: FontFamily.medium },
    placeToggle: { flexDirection: 'row', borderRadius: 9, padding: 2 },
    placeOption: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
    placeAdd: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed' },
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
    place: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
    placeBody: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    hint: { fontSize: 12, fontFamily: FontFamily.regular, lineHeight: 17 },
    message: { minHeight: 40, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, fontFamily: FontFamily.regular },
    inline: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    notes: { minHeight: 70, borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20, fontFamily: FontFamily.regular, textAlignVertical: 'top' },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
    number: { width: 110, minHeight: 46, borderWidth: 1, borderRadius: 11, paddingHorizontal: 14, fontSize: 17, fontFamily: FontFamily.semibold },
    unitButton: { minWidth: 118, minHeight: 46, borderWidth: 1, borderRadius: 11, paddingHorizontal: 14, flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'space-between' },
    unitLabel: { fontSize: 13, fontFamily: FontFamily.medium },
    error: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
    errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: FontFamily.regular },
    footer: { paddingHorizontal: 16, paddingBottom: 8, paddingTop: 8 },
    save: { paddingVertical: 15, borderRadius: 999, alignItems: 'center' },
    saveText: { fontSize: 15, fontFamily: FontFamily.semibold },
});
