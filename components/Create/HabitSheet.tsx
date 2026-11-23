import { GOALS_ENABLED } from '@/constants/features';
import { goalCompletedOn } from '@/lib/goalInsights';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAutoReschedule } from '@/context/AppSettingsContext';
import { DEFAULT_LENGTH } from '@/lib/dayFlow';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MatteInput } from '@/components/ui/MatteInput';
import { AppIcon as Ionicons, type IconName } from '@/components/ui/AppIcon';
import { ComposerModal } from '@/components/Create/ComposerModal';
import { ShareParticipantsSheet } from '@/components/Social/ShareParticipantsSheet';
import { useShareDraft } from '@/hooks/useShareDraft';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Choices, DetailBar, type DetailItem } from '@/components/Create/DetailBar';
import { type Difficulty } from '@/lib/difficulty';
import { ImportancePicker, importanceLabel } from '@/components/Create/ImportancePicker';
import { CreationTextInput } from '@/components/Create/CreationTextInput';
import { DictateField } from '@/components/Create/DictateField';
import { TypingPlaceholder } from '@/components/ui/TypingPlaceholder';
import { RepeatPicker } from '@/components/Create/RepeatPicker';
import { TimeRange, endTime, nextHour } from '@/components/Create/TimeRange';
import { lengthLabel } from '@/lib/dayFlow';
import { DAILY, describe as describeRule, parseRecurrence, serialiseRecurrence, type Recurrence, type Weekday } from '@/lib/recurrence';
import { GoalLookPicker } from '@/components/Create/GoalLookPicker';
import { LookButton } from '@/components/Create/LookButton';
import { ReminderPicker } from '@/components/Create/ReminderPicker';
import { AnchorPicker } from '@/components/Create/AnchorPicker';
import { useAnchorSuggestions } from '@/hooks/useAnchorSuggestions';
import { anchorLabel, parseAnchor, type HabitAnchor } from '@/lib/habitAnchor';
import { describeAlerts } from '@/lib/itemAlerts';
import { MeasureField } from '@/components/Create/MeasureField';
import { habitTextSegments } from '@/lib/creationTextHighlight';
import { readableAccent } from '@/lib/colorContrast';
import type { HealthMetric } from '@/lib/healthMetrics';
import { shortLead } from '@/lib/leadTime';
import { Colors } from '@/theme/colors';
import { FontFamily, Spacing } from '@/theme/designSystem';
import { useTheme } from '@/context/ThemeContext';
import { useAccentGradient } from '@/context/AccentContext';
import { useHaptics } from '@/hooks/useHaptics';
import { useSmartParse } from '@/hooks/useSmartParse';
import { smartParseHabit } from '@/lib/smartParse';
import { parseHabitText } from '@/lib/habitParser';
import { addHabit, updateHabit, getGoals, withAutoTrack, type Habit, type LocationReminder } from '@/lib/habitsSQLite';
import { allTrackOptions, autoTrackOptions, trackMinutes, type AutoTrackOption } from '@/lib/autoTrackSources';
import { guessHealthMetric } from '@/lib/autoTrackGuess';
import { TrackingPicker } from '@/components/Create/TrackingPicker';
import { appTimeSupported, appsChosen, chooseApps, getAppTime, setAppTime } from '@/lib/appTime';
import { generateId } from '@/lib/database';
import { AutoTrackHint } from '@/components/Create/AutoTrackHint';
import { firstDueDay, localDateKey } from '@/lib/habitSchedule';
import { NotificationService } from '@/lib/notificationService';
import { emit, on } from '@/lib/appEvents';


/** Typed out in the empty box, for a little inspiration. */
const HABIT_EXAMPLES = ['Gym Monday, Wednesday, Friday at 6', 'Read 20 pages every night', 'Meditate 10 minutes each morning', 'Walk 8000 steps daily'];

const DAYS: { id: string; label: string }[] = [
    { id: 'mon', label: 'M' }, { id: 'tue', label: 'T' }, { id: 'wed', label: 'W' },
    { id: 'thu', label: 'T' }, { id: 'fri', label: 'F' }, { id: 'sat', label: 'S' }, { id: 'sun', label: 'S' },
];
const EVERY_DAY = DAYS.map(day => day.id);
type Row = 'repeat' | 'time' | 'anchor' | 'target' | 'tracking' | 'reminder' | 'importance' | 'goal' | 'look' | 'notes' | null;

interface Draft {
    name: string;
    /** 'quit' for something to stay away from. */
    habitType?: 'build' | 'quit';
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
    /** Its own reminders before it begins, in minutes (lib/itemAlerts.ts). */
    alerts?: number[];
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
    /** How hard it is: hard ones get your best hours. */
    difficulty?: Difficulty;
    /** At its time: false keeps it exactly there; otherwise the timeline may move it. */
    flexible?: boolean;
    /** Held before or after a class or meal by name (lib/habitAnchor.ts). */
    anchor?: HabitAnchor | null;
    /** YYYY-MM-DD it stops, when it has an end ("until Dec 1"). */
    endDate?: string;
    /** YYYY-MM-DD it begins; today when not said. */
    startDate?: string;
}

const TIMING: { id: 'exact' | 'flexible'; label: string }[] = [
    { id: 'flexible', label: 'Anytime' },
    { id: 'exact', label: 'Exact time' },
];


const blank = (): Draft => ({ name: '', days: EVERY_DAY, icon: 'ellipse-outline', color: '#6B8AF5', rule: DAILY, places: [], durationMinutes: DEFAULT_LENGTH.habit });

const fromHabit = (from: Habit): Draft => ({
    name: from.name,
    habitType: from.type,
    priority: from.priority,
    difficulty: from.difficulty,
    flexible: from.flexible,
    anchor: from.anchor ?? null,
    endDate: from.endDate,
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
    alerts: from.alerts ?? (from.reminderOffset ? [from.reminderOffset] : undefined),
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
    if (draft.alerts?.length) parts.push(describeAlerts(draft.alerts));
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
    // Off, nothing moves: Exact, Urgency and Difficulty are not asked.
    const autoReschedule = useAutoReschedule();
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
    /** How it tracks itself: an option's key, 'off', or null for the best one. */
    const [trackPick, setTrackPick] = useState<string | null>(null);
    /** For apps and a place: minutes before it counts, when changed here. */
    /** Editing: the minutes it is already linked to apps for, if it is. */
    const [appLinked, setAppLinked] = useState<number | null>(null);
    /** Apps chosen in Apple's picker for this habit (by its id, made up front for a new one). */
    const [appsCount, setAppsCount] = useState(0);
    const [newId, setNewId] = useState(generateId);
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
        setTrackPick(null);
        setAppLinked(null);
        setAppsCount(0);
        setNewId(generateId());
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
        // Goals still being worked on; one already reached is done and not offered (the one linked stays).
        getGoals().then(all => setGoals(all.filter(goal => !goal.isArchived && (!goalCompletedOn(goal) || goal.id === (habit?.goalId ?? goalId))))).catch(() => setGoals([]));
    }, [isOpen]);

    // What the sentence says, read by rules at once and by the model a moment
    // later. Anything it finds fills the rows in, where it can still be changed.
    // What the sentence can point at: goals by name; for a link, the day's events, meals, habits and tasks.
    const anchorNames = useAnchorSuggestions(isOpen);
    const linkNames = useMemo(() => [...anchorNames, ...goals.map(goal => goal.name)], [anchorNames, goals]);
    const rules = useMemo(() => (text.trim() ? parseHabitText(text, new Date(), { known: anchorNames, goals: goals.map(goal => goal.name) }) : null), [text, linkNames]);
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
            // A schedule beyond weekdays read from the words ("4 times a week",
            // "every other day") wins; then named days; then what it had.
            rule: rules?.recurrence ?? (parsed.taskDays?.length
                ? { kind: 'weekly', every: start.rule.kind === 'weekly' ? start.rule.every : 1, weekdays: days as Weekday[] }
                : start.rule),
            // Only ever switches to quit; editing a quit habit's words never makes it a build one.
            habitType: rules?.habitType === 'quit' ? 'quit' : start.habitType,
            // The model may miss "now"; the rules never do.
            startTime: parsed.startTime ?? rules?.startTime ?? start.startTime,
            durationMinutes: parsed.durationMinutes ?? start.durationMinutes,
            amount: parsed.targetValue ?? start.amount,
            unit: parsed.targetUnit ?? start.unit,
            // Read by the rules alone (the model is not asked for these):
            // "until Friday", "high priority", "hard", "at 7 sharp".
            endDate: rules?.endDate ?? start.endDate,
            startDate: rules?.startDate ?? start.startDate,
            priority: rules?.priority ?? start.priority,
            difficulty: rules?.difficulty ?? start.difficulty,
            // A time said in the words ("Gym at 6") is a time to keep, unless the words say it can move.
            flexible: rules?.flexible ?? (parsed.startTime ? false : start.flexible),
            // "right after work", "remind me 10 min before", "for my Marathon goal": read by the rules.
            anchor: rules?.anchor ? { to: rules.anchor.to, side: rules.anchor.side, gap: 0 } : start.anchor,
            alerts: rules?.reminder ? (rules.reminder.alerts ?? []) : start.alerts,
            reminder: rules?.reminder ? rules.reminder.at : start.reminder,
            goalId: (GOALS_ENABLED && rules?.goal && goals.find(goal => goal.name.toLowerCase() === rules.goal!.toLowerCase())?.id) || start.goalId,
        } : start;
        return { ...read, ...edits };
    }, [current, eventGoal, parsed, edits, rules, goals]);
    // Everything in the sheet wears the colour chosen for this goal or habit:
    // the chosen chips, the bar's open chip, the calendar — not the app accent.
    // How it ticks itself (lib/autoTrackSources.ts): suggested from its name as it is
    // written (new habits), every way in the Tracking chip, and what it already uses.
    const said = { amount: draft.amount, unit: draft.unit, durationMinutes: draft.durationMinutes, quit: draft.habitType === 'quit' };
    const canTrack = Platform.OS === 'ios' && !current?.isGoal;
    const appsAvailable = appTimeSupported();
    const suggestions = useMemo(() => (current || !canTrack ? []
        : autoTrackOptions(draft.name || text, said).filter(option => option.kind !== 'app' || appsAvailable)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, canTrack, draft.name, text, draft.amount, draft.unit, draft.durationMinutes, draft.habitType]);
    useEffect(() => {
        if (!isOpen || !current) return;
        void getAppTime().then(all => setAppLinked(all[current.id] ?? null)).catch(() => undefined);
        void appsChosen(current.id).then(setAppsCount);
    }, [isOpen, current]);
    const everyOption: AutoTrackOption[] = (() => {
        const quit = draft.habitType === 'quit';
        const all = allTrackOptions(quit).filter(option => option.kind !== 'app' || appsAvailable);
        return all;
    })();
    // What it uses now, when editing.
    const stayPlace = draft.places.find(place => place.trigger === 'stay');
    const currentKey = current
        ? current.healthKitMetric ? `health:${current.healthKitMetric}` : appLinked ? 'app' : current.locationReminders?.some(place => place.trigger === 'stay') ? 'place' : 'off'
        : suggestions[0]?.key ?? 'off';
    // Said in the sentence: "from Apple Health", "on Libby", "at the gym".
    const saidTracking = rules?.tracking;
    const saidKey = current || !canTrack || !saidTracking || saidTracking.kind === 'auto' ? undefined
        : saidTracking.kind === 'health' ? `health:${guessHealthMetric(draft.name || text, draft.unit) ?? 'workout'}`
        : saidTracking.kind === 'app' ? (appsAvailable ? 'app' : undefined)
        : 'place';
    const trackKey = trackPick ?? saidKey ?? currentKey;
    const tracking: AutoTrackOption | null = trackKey === 'off' ? null
        : suggestions.find(option => option.key === trackKey) ?? everyOption.find(option => option.key === trackKey) ?? null;
    // Apps: the habit's own time (its amount in minutes, else its length), 30 minutes when it says none.
    const habitMinutes = tracking ? trackMinutes(tracking, said) : 30;
    const minutesFromHabit = !!(said.durationMinutes || (said.amount && /^(min|mins|minutes?|h|hr|hrs|hours?)$/i.test(said.unit ?? '')));
    const minutes = tracking?.kind === 'app' ? (minutesFromHabit ? habitMinutes : appLinked ?? 30)
        // A place: the habit's own length there (its amount in minutes, else its length, else 30).
        : habitMinutes;
    const habitId = current?.id ?? newId;
    const addApps = () => { void chooseApps(habitId, 'Apps').then(count => { if (count >= 0) setAppsCount(count); }); };
    const chooseTracking = (key: string, from: 'hint' | 'chip' = 'chip') => {
        setTrackPick(key);
        const option = everyOption.find(item => item.key === key) ?? suggestions.find(item => item.key === key);
        if (option?.kind === 'place') {
            // From the line under the sentence: to the Tracking chip, where the map is a tap away.
            if (from === 'hint' && !stayPlace) setOpenRow('tracking');
        } else if (stayPlace) {
            // Away from a place: its time there no longer counts (a reminder there stays).
            change({ places: draft.places.filter(place => place.trigger !== 'stay') });
        }
    };
    const trackingValue = !tracking ? undefined
        : tracking.kind === 'health' ? `Health · ${everyOption.find(option => option.key === tracking.key)?.label ?? tracking.label}`
        : tracking.kind === 'app' ? `Apps · ${minutes} min`
        : stayPlace ? `${stayPlace.name} · ${minutes} min` : 'A place';
    const accent = draft.color || appAccent;
    const accentText = readableAccent(accent, colors.background);

    const linkedGoal = goalId ?? draft.goalId;
    // Deciding to do this with somebody happens while writing it, not after —
    // so the choice is held here and sent the moment the habit has an id.
    const share = useShareDraft('habit', current?.id);
    const close = () => { setEventVisible(false); setEditing(null); share.close(); onClose?.(); emit('creation_sheet_closed', { kind: 'habit' }); };
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
                // Flexible has no time of day: the timeline places it, so a time it once had is cleared.
                startTime: exact ? draft.startTime : undefined,
                durationMinutes: draft.durationMinutes,
                endDate: draft.endDate,
                goalValue: draft.amount ?? 1,
                unit: draft.unit ?? 'time',
                trackingMethod: draft.amount ? 'numeric' : 'boolean',
                reminders: current && !Object.prototype.hasOwnProperty.call(edits, 'reminder')
                    ? current.reminders : draft.reminder ? [draft.reminder] : [],
                goalId: linkedGoal,
                icon: draft.icon,
                color: draft.color,
                // "Avoid…", "Quit…", "No…": a quit habit, a tick a day kept clean.
                type: draft.habitType ?? current?.type ?? 'build',
                recurrence: serialiseRecurrence(draft.rule),
                frequency: draft.rule.kind === 'monthly' ? 'monthly' : draft.rule.kind === 'yearly' ? 'yearly' : 'daily',
                weekInterval: draft.rule.kind === 'weekly' ? draft.rule.every : 1,
                reminderOffset: draft.reminderOffset,
                alerts: draft.alerts ?? [],
                reminderMessage: draft.reminderMessage?.trim() || undefined,
                priority: draft.priority ?? 2,
                difficulty: draft.difficulty,
                // Only means something with a time of day.
                flexible: draft.startTime ? draft.flexible !== false : undefined,
                // Held to a class or meal; an empty name holds it to nothing.
                anchor: parseAnchor(draft.anchor ?? null) ?? null,
                // A place it counts time at: as long as the habit itself takes.
                locationReminders: draft.places.map(place => (place.trigger === 'stay' ? { ...place, stayMinutes: minutes } : place)),
                // Health: what the Tracking chip says (below); cleared when it says otherwise.
                healthKitMetric: undefined,
                healthKitTarget: undefined,
                goalPeriod: current?.goalPeriod ?? 'daily',
                category: current?.category ?? 'personal',
                startDate: draft.startDate ?? current?.startDate ?? localDateKey(new Date()),
            };

            // Apple Health, as chosen: the same link kept, a new one set up (unit and target), or none.
            const linked = tracking?.kind === 'health'
                ? tracking.metric === current?.healthKitMetric
                    ? { ...fields, healthKitMetric: current.healthKitMetric, healthKitTarget: current.healthKitTarget }
                    : withAutoTrack(fields, tracking.metric)
                : fields;
            // Time in apps: Screen Time's own picker, over the sheet, to choose Libby, Kindle…
            const linkApps = async (id: string) => {
                if (tracking?.kind === 'app') {
                    // None added yet: the picker now, so it is never saved tracking nothing.
                    if (appsCount > 0 || await chooseApps(id, 'Apps') > 0) await setAppTime(id, minutes);
                } else if (appLinked) await setAppTime(id, null);
            };
            if (current) {
                // Not started yet (its first due day is still ahead): it starts on its first due day under the new schedule.
                const today = localDateKey(new Date());
                const first = (current.startDate ?? '') >= today || (firstDueDay(current) ?? '') >= today
                    ? firstDueDay({ ...current, ...linked, startDate: linked.startDate && linked.startDate >= today ? linked.startDate : today })
                    : null;
                await updateHabit({ id: current.id, ...linked, ...(first ? { startDate: first } : null) });
                await linkApps(current.id);
            } else {
                const made = await addHabit({ ...linked, id: newId }, { autoTrack: false });
                if (!made?.id) throw new Error('not saved');
                await linkApps(made.id);
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
    const goalName = goals.find(goal => goal.id === linkedGoal)?.name;
    const canSave = !!text.trim();

    // At an exact time (it stays there), or flexible (the timeline places it; no time of day).
    // With Auto-reschedule off the day is a plain calendar: every time is kept.
    const exact = !autoReschedule || draft.flexible === false;
    const items: DetailItem[] = [
        {
            id: 'repeat', icon: 'repeat', label: 'Repeat',
            value: `${describeRule(draft.rule)}${draft.endDate ? ` · until ${new Date(`${draft.endDate}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}`,
            content: <RepeatPicker value={draft.rule} accent={accent} onChange={rule => change({ rule })} />,
        },
        {
            id: 'time', icon: 'time-outline', label: 'Time',
            value: exact
                ? (draft.startTime ? `${draft.durationMinutes ? `${draft.startTime} → ${endTime(draft.startTime, draft.durationMinutes)}` : draft.startTime}` : undefined)
                : draft.durationMinutes ? `Anytime · ${lengthLabel(draft.durationMinutes)}` : undefined,
            content: (
                <>
                    {/* First: may the timeline move it, or does it stay at its time? Flexible has no time of day,
                        only how long it takes. Not asked when nothing moves (Auto-reschedule off). */}
                    {autoReschedule ? (
                    <Choices options={TIMING} value={exact ? 'exact' : 'flexible'} accent={accent}
                        onChange={id => change(id === 'exact' ? { flexible: false, startTime: draft.startTime ?? nextHour() } : { flexible: true, startTime: undefined })} />
                    ) : null}
                    <TimeRange
                        lengthOnly={!exact}
                        start={draft.startTime}
                        minutes={draft.durationMinutes}
                        accent={accent}
                        onChange={next => change({ startTime: next.start, durationMinutes: next.minutes })}
                    />
                </>
            ),
        },
        // Before or after a class or a meal, wherever it falls that day (lib/habitAnchor.ts).
        ...(autoReschedule ? [{
            id: 'anchor', icon: 'link-outline' as const, label: 'Link',
            value: draft.anchor?.to.trim() ? anchorLabel(draft.anchor) : undefined,
            content: <AnchorPicker value={draft.anchor} accent={accent} onChange={anchor => change({ anchor })} />,
        }] : []),
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

                </>
            ),
        },
        // How it ticks itself: by hand, Apple Health, time in apps, or time at a place.
        ...(canTrack ? [{
            id: 'tracking', icon: 'flash-outline' as const, label: 'Tracking', value: trackingValue,
            content: (
                <TrackingPicker
                    options={everyOption} chosen={tracking ? everyOption.find(option => option.key === tracking.key) ?? tracking : null}
                    onChoose={key => chooseTracking(key)} minutes={minutes} accent={accent}
                    stayPlace={stayPlace ?? null} reminderPlace={draft.places.find(place => place.trigger !== 'stay') ?? null}
                    onStayPlace={place => change({ places: [...draft.places.filter(item => item.trigger !== 'stay'),
                        ...(place ? [{ ...place, trigger: 'stay' as const, stayMinutes: minutes }] : [])] })}
                    onAddApps={addApps} appsCount={appsCount} minutesFromHabit={minutesFromHabit} appsHabitId={habitId}
                    appsAvailable={appsAvailable} healthAvailable={draft.habitType !== 'quit'}
                />
            ),
        }] : []),
        {
            id: 'reminder', icon: 'notifications-outline', label: 'Reminder', value: describeReminder(draft),
            content: (
                <ReminderPicker
                    startTime={draft.startTime}
                    value={{ reminder: draft.reminder, reminderOffset: draft.reminderOffset, places: draft.places, alerts: draft.alerts }}
                    accent={accent}
                    onError={setError}
                    onChange={patch => change(patch)}
                />
            ),
        },
        // Importance: urgency and difficulty, one slider each. They order what the
        // timeline moves, and always show on the card.
        {
            id: 'importance' as const, icon: 'speedometer-outline' as const, label: 'Importance',
            value: importanceLabel(draft.priority, draft.difficulty),
            content: <ImportancePicker priority={draft.priority} difficulty={draft.difficulty} onChange={change} />,
        },
        ...(GOALS_ENABLED && goals.length > 0 ? [{
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

                    {/* The suggestion, while it is one: picked something else in the Tracking chip, the line steps aside. */}
                    {!current && (trackPick === null || trackPick === 'off' || suggestions.some(option => option.key === trackPick)) ? (
                        <AutoTrackHint options={suggestions} chosen={tracking?.key ?? 'off'} onChoose={key => chooseTracking(key, 'hint')} accent={accentText} />
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
    flexSpacer: { flex: 1 },
    read: { flexShrink: 1, fontSize: 11, fontFamily: FontFamily.regular },
    days: { flexDirection: 'row', gap: 6 },
    day: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
    link: { paddingVertical: 6 },
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
