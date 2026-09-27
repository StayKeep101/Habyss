import React, { useEffect, useMemo, useRef, useState } from 'react';
import {ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppIcon as Ionicons, type IconName } from '@/components/Common/AppIcon';
import { ComposerModal } from '@/components/Create/ComposerModal';
import { ModalHeader } from '@/components/Layout/ModalHeader';
import { AIBadge } from '@/components/Common/AIBadge';
import { Choices, DetailBar, type DetailItem } from '@/components/Create/DetailBar';
import { CreationTextInput } from '@/components/Create/CreationTextInput';
import { RepeatPicker } from '@/components/Create/RepeatPicker';
import { TimeRange, endTime } from '@/components/Create/TimeRange';
import { DAILY, describe as describeRule, parseRecurrence, serialiseRecurrence, type Recurrence, type Weekday } from '@/lib/recurrence';
import { GoalLookPicker } from '@/components/Create/GoalLookPicker';
import { LeadTime } from '@/components/Create/LeadTime';
import { GoalUnitPicker } from '@/components/Create/GoalUnitPicker';
import { habitTextSegments } from '@/lib/creationTextHighlight';
import { readableAccent } from '@/lib/colorContrast';
import { goalUnitLabel } from '@/lib/goalUnits';
import { shortLead } from '@/lib/leadTime';
import { Colors } from '@/constants/Colors';
import { FontFamily } from '@/constants/DesignSystem';
import { useTheme } from '@/constants/themeContext';
import { useAccentGradient } from '@/constants/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useSmartParse } from '@/hooks/useSmartParse';
import { smartParseHabit } from '@/lib/smartParse';
import { parseHabitText } from '@/lib/habitParser';
import { addHabit, updateHabit, getGoals, type Habit, type LocationReminder } from '@/lib/habitsSQLite';
import { localDateKey } from '@/lib/habitSchedule';
import { NotificationService } from '@/lib/notificationService';
import { emit, on } from '@/lib/appEvents';

const DAYS: { id: string; label: string }[] = [
    { id: 'mon', label: 'M' }, { id: 'tue', label: 'T' }, { id: 'wed', label: 'W' },
    { id: 'thu', label: 'T' }, { id: 'fri', label: 'F' }, { id: 'sat', label: 'S' }, { id: 'sun', label: 'S' },
];
const EVERY_DAY = DAYS.map(day => day.id);
type Row = 'repeat' | 'time' | 'target' | 'reminder' | 'goal' | 'look' | 'notes' | null;

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
    /** The geofences this habit listens for, arriving or leaving. */
    places: LocationReminder[];
    /** How often it comes round, in the full grammar. */
    rule: Recurrence;
}

const blank = (): Draft => ({ name: '', days: EVERY_DAY, icon: 'ellipse-outline', color: '#6B8AF5', rule: DAILY, places: [] });

const fromHabit = (from: Habit): Draft => ({
    name: from.name,
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
    const { primary: accent, foreground: accentText } = useAccentGradient();
    const { lightFeedback, selectionFeedback, successFeedback } = useHaptics();

    const [eventVisible, setEventVisible] = useState(false);
    const [editing, setEditing] = useState<Habit | null>(null);
    const [prefill, setPrefill] = useState('');
    const [eventGoal, setEventGoal] = useState<string | undefined>(undefined);
    const [text, setText] = useState('');
    const [edits, setEdits] = useState<Partial<Draft>>({});
    const [openRow, setOpenRow] = useState<Row>(null);
    const [unitPicker, setUnitPicker] = useState(false);
    const [amountText, setAmountText] = useState<string | null>(null);
    const [picker, setPicker] = useState<'time' | 'reminder' | null>(null);
    const [findingPlace, setFindingPlace] = useState(false);

    /**
     * Adds where you are standing as an arrival reminder.
     *
     * A map picker would be the fuller answer, but the place people want to be
     * reminded at is almost always the one they are in when they think of it —
     * the gym, the desk, the kitchen — so asking once for permission and
     * taking the current fix covers it without a screen of its own.
     */
    const addHere = async () => {
        if (findingPlace) return;
        setFindingPlace(true);
        try {
            const Location = require('expo-location') as typeof import('expo-location');
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setError('Habyss needs location access to remind you somewhere.');
                return;
            }
            const fix = await Location.getCurrentPositionAsync({});
            const [place] = await Location.reverseGeocodeAsync({
                latitude: fix.coords.latitude, longitude: fix.coords.longitude,
            }).catch(() => []);
            const name = place?.name || place?.street || place?.city || 'Here';
            const already = draft.places.some(item =>
                Math.abs(item.latitude - fix.coords.latitude) < 0.0005
                && Math.abs(item.longitude - fix.coords.longitude) < 0.0005);
            if (already) return;
            change({ places: [...draft.places, { name, latitude: fix.coords.latitude, longitude: fix.coords.longitude, radius: 150, trigger: 'arrive' }] });
        } catch {
            setError('Could not find where you are. Try again.');
        } finally {
            setFindingPlace(false);
        }
    };
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
        setUnitPicker(false);
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
    const smart = useSmartParse(text, smartParseHabit);
    // Opening an existing habit must not rewrite it. "Run everyday" reads as a
    // habit called "Run" that repeats daily, which is right for a sentence
    // someone just typed and wrong for a name they chose and saved. So nothing
    // is read out of the text until they actually change it.
    const untouched = !!current && text.trim() === (current.name ?? '').trim();
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

    const linkedGoal = goalId ?? draft.goalId;
    const close = () => { setEventVisible(false); setEditing(null); onClose?.(); };
    const toggleRow = (id: string | null) => { setOpenRow(id as Row); setUnitPicker(false); setPicker(null); };
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
                locationReminders: draft.places,
                goalPeriod: current?.goalPeriod ?? 'daily',
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
        date.setHours(Number.isFinite(hour) ? hour : 8, Number.isFinite(minute) ? minute : 0, 0, 0);
        return date;
    };
    const asTime = (date: Date) =>
        `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

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
                    <View style={styles.amountRow}>
                        <TextInput accessibilityLabel="Habit target number" value={amountText ?? (draft.amount === undefined ? '' : String(draft.amount))}
                            keyboardType="decimal-pad" placeholder="1" placeholderTextColor={colors.textTertiary}
                            onFocus={() => setUnitPicker(false)}
                            onChangeText={value => {
                                setAmountText(value);
                                const amount = Number(value.replace(',', '.'));
                                change({ amount: value.trim() ? amount : undefined, unit: draft.unit ?? 'times' });
                            }} style={[styles.number, { color: colors.textPrimary, borderColor: colors.border }]} />
                        <Pressable accessibilityRole="button" accessibilityLabel="Choose habit unit" accessibilityState={{ expanded: unitPicker }}
                            onPress={() => { Keyboard.dismiss(); setUnitPicker(!unitPicker); }}
                            style={[styles.unitButton, { borderColor: accent + '44', backgroundColor: accent + '18' }]}>
                            <Text style={[styles.unitLabel, { color: accentText }]}>{goalUnitLabel(draft.unit === 'min' ? 'minutes' : draft.unit === 'times' ? 'sessions' : draft.unit ?? 'sessions')}</Text>
                            <Ionicons name={unitPicker ? 'chevron-up' : 'chevron-down'} size={14} color={accentText} />
                        </Pressable>
                    </View>
                    {unitPicker ? <GoalUnitPicker value={draft.unit === 'min' ? 'minutes' : draft.unit === 'times' ? 'sessions' : draft.unit}
                        accent={accentText} onChange={unit => { change({ unit: unit === 'minutes' ? 'min' : unit === 'sessions' ? 'times' : unit, amount: draft.amount ?? 1 }); setUnitPicker(false); }} />
                        : <Pressable accessibilityRole="button" onPress={() => { change({ amount: undefined, unit: undefined }); setAmountText(null); }} style={styles.link}>
                            <Text style={[styles.unitLabel, { color: colors.textSecondary }]}>Use a simple check-in</Text>
                        </Pressable>}
                </>
            ),
        },
        {
            id: 'reminder', icon: 'notifications-outline', label: 'Reminder', value: describeReminder(draft),
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

                    {/* How far ahead of the habit it should land. */}
                    {draft.reminder ? (
                        <LeadTime
                            value={draft.reminderOffset ?? 0}
                            accent={accent}
                            onChange={minutes => change({ reminderOffset: minutes || undefined })}
                        />
                    ) : null}
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

                    {/* A place, not a time. The geofences were always in the
                        data model and in LocationService; nothing ever asked
                        for one. */}
                    <View style={styles.inline}>
                        {draft.places.map(place => {
                            const leaving = place.trigger === 'leave';
                            return (
                                <View key={`${place.latitude},${place.longitude}`} style={[styles.place, { borderColor: accent + '66', backgroundColor: accent + '18' }]}>
                                    {/* Tapping the chip turns it round. Arriving
                                        and leaving are the same place either way,
                                        so a second chip would only repeat it. */}
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={leaving ? `Remind me when I arrive at ${place.name} instead` : `Remind me when I leave ${place.name} instead`}
                                        onPress={() => { selectionFeedback(); change({ places: draft.places.map(item => item === place ? { ...item, trigger: leaving ? 'arrive' : 'leave' } : item) }); }}
                                        style={styles.placeBody}
                                    >
                                        <Ionicons name={leaving ? 'exit-outline' : 'location'} size={12} color={accent} />
                                        <Text style={{ color: accent, fontSize: 12, fontFamily: FontFamily.medium }}>
                                            {`${leaving ? 'Leaving' : 'Arriving'} · ${place.name}`}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={`Remove the reminder at ${place.name}`}
                                        onPress={() => { lightFeedback(); change({ places: draft.places.filter(item => item !== place) }); }}
                                        hitSlop={8}
                                    >
                                        <Ionicons name="close" size={12} color={accent} />
                                    </Pressable>
                                </View>
                            );
                        })}
                        <Pressable onPress={() => void addHere()} disabled={findingPlace} style={styles.link}>
                            <Text style={{ color: accent, fontSize: 13, fontFamily: FontFamily.medium }}>
                                {findingPlace ? 'Finding you…' : 'Remind me at this place'}
                            </Text>
                        </Pressable>
                    </View>

                    {/* What it says. Left empty, Echo writes it in your voice. */}
                    <TextInput
                        value={draft.reminderMessage ?? ''}
                        onChangeText={reminderMessage => change({ reminderMessage })}
                        placeholder="What it should say — leave empty and Echo writes it"
                        placeholderTextColor={colors.textTertiary}
                        accessibilityLabel="Reminder message"
                        style={[styles.message, {
                            color: colors.textPrimary, borderColor: colors.border,
                            backgroundColor: isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.06)',
                        }]}
                    />
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
            id: 'look', icon: draft.icon, color: readableAccent(draft.color, colors.background), label: 'Look',
            content: <GoalLookPicker subject="Habit" icon={draft.icon} color={draft.color} onChange={change} />,
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
                    <CreationTextInput
                        key={session} text={text} segments={habitTextSegments(text, rules)} accent={accentText} textColor={colors.textPrimary}
                        onChangeText={value => { setText(value); setAmountText(null); }}
                        onFocus={() => { setOpenRow(null); setUnitPicker(false); }}
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
    place: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
    placeBody: { flexDirection: 'row', alignItems: 'center', gap: 5 },
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
