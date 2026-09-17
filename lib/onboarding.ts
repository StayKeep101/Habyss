import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Habit, HabitCategory, TimeOfDay } from './habitsSQLite';
import { isHabitScheduledForDate, localDateKey } from './habitSchedule';
import type { PersonalityModeId } from '@/constants/AIPersonalities';
import type { ParsedHabit } from './habitParser';

/**
 * Onboarding data model.
 *
 * Every answer here changes something the user can see afterwards:
 * - name         personalises the questions and is saved to the profile
 * - areas        filter which habits are suggested
 * - obstacle     decides the recommended target, the routine cue and whether a
 *                reminder is offered
 * - support      sets the default coach, and for two of the options changes the
 *                reminder offer or how the habit is tracked
 *
 * Nothing is collected for its own sake. If an option cannot be given a real
 * effect it does not belong on the list.
 */

export const DRAFT_KEY = 'habyss_onboarding_draft';

export type AreaId = 'body' | 'focus' | 'learning' | 'calm' | 'routine' | 'other';

export type ObstacleId =
    | 'putting_off' | 'momentum' | 'forgetting'
    | 'overwhelmed' | 'accountability' | 'restarting';

export type SupportId = 'clear_plan' | 'consistency' | 'accountability' | 'progress' | 'fresh_start';

/** Areas the user can pick. At most two, so suggestions stay focused. */
export const MAX_AREAS = 2;

export interface Area {
    id: AreaId;
    label: string;
    icon: string;
    category: HabitCategory;
}

export const AREAS: Area[] = [
    { id: 'body', label: 'Moving my body and feeling healthier.', icon: 'walk-outline', category: 'body' },
    { id: 'focus', label: 'Focusing on work or personal projects.', icon: 'timer-outline', category: 'productivity' },
    { id: 'learning', label: 'Learning and building new skills.', icon: 'book-outline', category: 'learning' },
    { id: 'calm', label: 'Taking care of myself and feeling calmer.', icon: 'leaf-outline', category: 'soul' },
    { id: 'routine', label: 'Sleeping better and building a daily routine.', icon: 'moon-outline', category: 'health' },
    { id: 'other', label: 'Something else.', icon: 'ellipsis-horizontal-outline', category: 'personal' },
];

export interface Obstacle {
    id: ObstacleId;
    label: string;
    /** Shown once selected, so the user sees how Habyss will respond. */
    response: string;
}

export const OBSTACLES: Obstacle[] = [
    { id: 'putting_off', label: 'I keep saying, “I’ll start tomorrow.”', response: 'Let’s find a first step that feels easy to start.' },
    { id: 'momentum', label: 'I start strong, but lose momentum.', response: 'Let’s build a routine that also fits your low-motivation days.' },
    { id: 'forgetting', label: 'I forget when life gets busy.', response: 'Let’s connect your habit to something you already do.' },
    { id: 'overwhelmed', label: 'I set big goals and feel overwhelmed.', response: 'Let’s start with one manageable habit.' },
    { id: 'accountability', label: 'I struggle without someone checking in.', response: 'Let’s find a way to check in that works for you.' },
    { id: 'restarting', label: 'I miss a day, then find it hard to restart.', response: 'Let’s make returning part of the plan.' },
];

export interface Support {
    id: SupportId;
    label: string;
    blurb: string;
}

export const SUPPORTS: Support[] = [
    { id: 'clear_plan', label: 'A clear plan', blurb: 'Help me know what to do each day.' },
    { id: 'consistency', label: 'More consistency', blurb: 'Help me follow through when motivation fades.' },
    { id: 'accountability', label: 'Accountability', blurb: 'Help me check in on what I committed to.' },
    { id: 'progress', label: 'Visible progress', blurb: 'Help me see how my small efforts add up.' },
    { id: 'fresh_start', label: 'A fresh start', blurb: 'Help me return after missing a few days.' },
];

export interface HabitSuggestion {
    id: string;
    name: string;
    icon: string;
    /** A habit can belong to more than one area. */
    areas: AreaId[];
    category: HabitCategory;
    /** Minutes the activity takes, used to put the easiest starts first. */
    minutes: number;
    /** Deliberate per-activity targets rather than a blanket reduction. */
    standard: { value: number; unit: string };
    small: { value: number; unit: string };
    trackingMethod: 'boolean' | 'numeric';
    suggestedCue: string;
}

/**
 * Targets are chosen per activity. A "smaller" reading target is fewer pages,
 * not half a walk, so the small option always stays a sensible unit of work.
 */
export const SUGGESTIONS: HabitSuggestion[] = [
    // Moving my body
    { id: 'walk', name: 'Walk', icon: 'walk-outline', areas: ['body'], category: 'body', minutes: 15, standard: { value: 15, unit: 'min' }, small: { value: 5, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'After lunch' },
    { id: 'strength', name: 'Strength training', icon: 'barbell-outline', areas: ['body'], category: 'body', minutes: 30, standard: { value: 30, unit: 'min' }, small: { value: 10, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'After work' },
    { id: 'stretch', name: 'Stretch', icon: 'body-outline', areas: ['body', 'routine'], category: 'body', minutes: 5, standard: { value: 10, unit: 'min' }, small: { value: 3, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'Before bed' },
    // Work and personal projects
    { id: 'deep_work', name: 'Deep work', icon: 'timer-outline', areas: ['focus'], category: 'work', minutes: 25, standard: { value: 25, unit: 'min' }, small: { value: 10, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'First thing at my desk' },
    { id: 'plan_day', name: 'Plan tomorrow', icon: 'list-outline', areas: ['focus', 'routine'], category: 'productivity', minutes: 5, standard: { value: 5, unit: 'min' }, small: { value: 2, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'End of the workday' },
    { id: 'inbox', name: 'Clear inbox', icon: 'mail-outline', areas: ['focus'], category: 'work', minutes: 15, standard: { value: 15, unit: 'min' }, small: { value: 5, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'Before lunch' },
    // Learning and skills
    { id: 'read', name: 'Read', icon: 'book-outline', areas: ['learning'], category: 'mind', minutes: 20, standard: { value: 10, unit: 'pages' }, small: { value: 2, unit: 'pages' }, trackingMethod: 'numeric', suggestedCue: 'With morning coffee' },
    { id: 'study', name: 'Study', icon: 'school-outline', areas: ['learning'], category: 'learning', minutes: 20, standard: { value: 20, unit: 'min' }, small: { value: 5, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'After dinner' },
    { id: 'practice', name: 'Practise a skill', icon: 'musical-notes-outline', areas: ['learning'], category: 'creativity', minutes: 15, standard: { value: 15, unit: 'min' }, small: { value: 5, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'After dinner' },
    // Taking care of myself
    { id: 'meditate', name: 'Meditate', icon: 'leaf-outline', areas: ['calm'], category: 'soul', minutes: 10, standard: { value: 10, unit: 'min' }, small: { value: 3, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'After waking up' },
    { id: 'journal', name: 'Journal', icon: 'create-outline', areas: ['calm', 'routine'], category: 'soul', minutes: 10, standard: { value: 1, unit: 'entry' }, small: { value: 1, unit: 'entry' }, trackingMethod: 'boolean', suggestedCue: 'Before bed' },
    { id: 'breathe', name: 'Breathing break', icon: 'cloud-outline', areas: ['calm'], category: 'mindfulness', minutes: 3, standard: { value: 3, unit: 'min' }, small: { value: 1, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'Mid-afternoon' },
    // Sleep and daily routine
    { id: 'wind_down', name: 'Wind down', icon: 'moon-outline', areas: ['routine'], category: 'health', minutes: 15, standard: { value: 15, unit: 'min' }, small: { value: 5, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'An hour before bed' },
    { id: 'lights_out', name: 'Lights out on time', icon: 'bed-outline', areas: ['routine'], category: 'health', minutes: 1, standard: { value: 1, unit: 'night' }, small: { value: 1, unit: 'night' }, trackingMethod: 'boolean', suggestedCue: 'After winding down' },
    { id: 'morning', name: 'Morning routine', icon: 'sunny-outline', areas: ['routine'], category: 'health', minutes: 10, standard: { value: 10, unit: 'min' }, small: { value: 3, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'Right after waking up' },
    // Something else
    { id: 'reach_out', name: 'Message someone', icon: 'chatbubble-outline', areas: ['other'], category: 'social', minutes: 5, standard: { value: 1, unit: 'person' }, small: { value: 1, unit: 'person' }, trackingMethod: 'boolean', suggestedCue: 'On my commute' },
    { id: 'gratitude', name: 'Note one good thing', icon: 'sparkles-outline', areas: ['other', 'calm'], category: 'heart', minutes: 3, standard: { value: 1, unit: 'note' }, small: { value: 1, unit: 'note' }, trackingMethod: 'boolean', suggestedCue: 'Before bed' },
    { id: 'water', name: 'Drink water', icon: 'water-outline', areas: ['other', 'body'], category: 'health', minutes: 1, standard: { value: 6, unit: 'glasses' }, small: { value: 3, unit: 'glasses' }, trackingMethod: 'numeric', suggestedCue: 'With every meal' },
];

export type RecurrenceId = 'daily' | 'weekdays' | 'custom';

export interface OnboardingDraft {
    step: number;
    /** Empty or absent means the user skipped it. */
    name?: string;
    areaIds?: AreaId[];
    obstacleId?: ObstacleId;
    supportId?: SupportId;
    /** Suggestion id, or 'custom'. */
    suggestionId?: string;
    /** The sentence the user typed, kept so the step resumes as they left it. */
    habitText?: string;
    habitName?: string;
    targetValue?: number;
    targetUnit?: string;
    trackingMethod?: 'boolean' | 'numeric';
    icon?: string;
    category?: HabitCategory;
    /** True once the user edits the target, so recommendations stop overwriting it. */
    targetEdited?: boolean;
    recurrence?: RecurrenceId;
    taskDays?: string[];
    startDate?: string;
    cue?: string;
    /** "HH:MM" when the user said a time, e.g. "gym at 6". */
    startTime?: string;
    timeOfDay?: TimeOfDay;
    coachId?: PersonalityModeId;
    reminderTime?: string;
    /** Set once the habit row exists, so a retry cannot create a second one. */
    createdHabitId?: string;
}

export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/* -------------------------------------------------------------------------- */
/*  What each answer does                                                      */
/* -------------------------------------------------------------------------- */

/** Obstacles where the user's problem is scale, so the smaller target is right. */
const SMALL_TARGET_OBSTACLES: ObstacleId[] = ['putting_off', 'momentum', 'overwhelmed', 'restarting'];

/** Obstacles where an easy start matters most, so the quickest habits come first. */
const EASIEST_FIRST_OBSTACLES: ObstacleId[] = ['putting_off', 'overwhelmed'];

/** Suggestions for the chosen areas, ordered by what the obstacle calls for. */
export function rankSuggestions(areaIds: AreaId[] | undefined, obstacleId?: ObstacleId): HabitSuggestion[] {
    if (!areaIds || areaIds.length === 0) return [];
    const chosen = SUGGESTIONS.filter(item => item.areas.some(area => areaIds.includes(area)));

    if (obstacleId && EASIEST_FIRST_OBSTACLES.includes(obstacleId)) {
        return [...chosen].sort((a, b) => a.minutes - b.minutes);
    }

    // With two areas, alternate so the second choice is not buried underneath the first.
    if (areaIds.length > 1) {
        const buckets = areaIds.map(area => chosen.filter(item => item.areas.includes(area)));
        const interleaved: HabitSuggestion[] = [];
        for (let i = 0; i < Math.max(...buckets.map(bucket => bucket.length)); i += 1) {
            for (const bucket of buckets) {
                const item = bucket[i];
                if (item && !interleaved.includes(item)) interleaved.push(item);
            }
        }
        return interleaved;
    }
    return chosen;
}

/** The obstacle decides which of the two prepared targets is recommended. */
export function recommendedTarget(suggestion: HabitSuggestion, obstacleId?: ObstacleId) {
    if (obstacleId && SMALL_TARGET_OBSTACLES.includes(obstacleId)) return suggestion.small;
    return suggestion.standard;
}

/** Only forgetting is solved by anchoring the habit to something already done. */
export const shouldSuggestCue = (obstacleId?: ObstacleId): boolean => obstacleId === 'forgetting';

/** A reminder is offered when the user said they forget, or asked to be checked in on. */
export const shouldOfferReminder = (obstacleId?: ObstacleId, supportId?: SupportId): boolean =>
    obstacleId === 'forgetting' || obstacleId === 'accountability' || supportId === 'accountability';

/**
 * Wanting visible progress means a tick is not enough; an amount is what adds up.
 * Only applied when the activity has a real amount to count.
 */
export const prefersNumericTracking = (supportId?: SupportId): boolean => supportId === 'progress';

/** The kind of support asked for picks the coach that behaves that way. */
export const coachForSupport = (supportId?: SupportId): PersonalityModeId => {
    switch (supportId) {
        case 'consistency': return 'dad_mode';
        case 'accountability': return 'dad_mode';
        case 'fresh_start': return 'friendly';
        case 'clear_plan':
        case 'progress':
        default: return 'normal';
    }
};

export const obstacleResponse = (obstacleId?: ObstacleId): string | null =>
    OBSTACLES.find(item => item.id === obstacleId)?.response ?? null;

/* -------------------------------------------------------------------------- */
/*  Schedule                                                                   */
/* -------------------------------------------------------------------------- */

/** Which recurrence control matches a parsed day list. */
export function recurrenceFromTaskDays(days: string[]): { recurrence: RecurrenceId; taskDays: string[] } {
    if (days.length === 0) return { recurrence: 'daily', taskDays: [] };
    const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri'];
    const isWeekdays = days.length === weekdays.length && weekdays.every(day => days.includes(day));
    if (isWeekdays) return { recurrence: 'weekdays', taskDays: [] };
    return { recurrence: 'custom', taskDays: days };
}

/**
 * Turns one parsed line into the draft fields for every later step.
 *
 * Typing is the source of truth while the user is typing, so this overwrites
 * the target rather than preserving a manual edit; the schedule and confirm
 * steps stay editable afterwards.
 */
export function draftFromParsedHabit(parsed: ParsedHabit): Partial<OnboardingDraft> {
    const { recurrence, taskDays } = recurrenceFromTaskDays(parsed.taskDays);
    return {
        habitName: parsed.name,
        targetValue: parsed.targetValue,
        targetUnit: parsed.targetUnit,
        trackingMethod: parsed.trackingMethod,
        recurrence,
        taskDays,
        startTime: parsed.startTime,
    };
}

/** An example sentence for a suggestion, so tapping one teaches the syntax. */
export function suggestionToSentence(suggestion: HabitSuggestion, obstacleId?: ObstacleId): string {
    const target = recommendedTarget(suggestion, obstacleId);
    const amount = suggestion.trackingMethod === 'boolean' ? '' : `${target.value} ${target.unit} `;
    return `${suggestion.name} ${amount}every day`.replace(/\s+/g, ' ').trim();
}

/** Days the draft actually runs on. Empty means every day. */
export function draftTaskDays(draft: OnboardingDraft): string[] {
    if (draft.recurrence === 'weekdays') return ['mon', 'tue', 'wed', 'thu', 'fri'];
    if (draft.recurrence === 'custom') return draft.taskDays ?? [];
    return [];
}

/**
 * Builds the habit exactly as it will be saved, so the confirmation screen and
 * the stored row can never drift apart.
 */
export function draftToHabit(draft: OnboardingDraft): Partial<Habit> {
    const startDate = draft.startDate ?? localDateKey(new Date());
    return {
        name: (draft.habitName ?? '').trim(),
        icon: draft.icon ?? 'ellipse-outline',
        category: draft.category ?? 'personal',
        type: 'build',
        frequency: 'daily',
        taskDays: draftTaskDays(draft),
        startDate,
        goalPeriod: 'daily',
        goalValue: draft.targetValue ?? 1,
        unit: draft.targetUnit ?? 'time',
        trackingMethod: draft.trackingMethod ?? 'boolean',
        description: draft.cue?.trim() ? draft.cue.trim() : undefined,
        startTime: draft.startTime,
        timeOfDay: draft.timeOfDay,
        reminders: draft.reminderTime ? [draft.reminderTime] : [],
    };
}

/**
 * First date on or after `from` that the habit runs.
 *
 * Uses the same scheduler as Home and Roadmap so onboarding cannot promise a
 * day the rest of the app disagrees with. Returns null if nothing matches
 * within a year, rather than guessing.
 */
export function nextOccurrence(draft: OnboardingDraft, from: Date = new Date()): Date | null {
    // The shared scheduler reads an empty taskDays as "every day", which is right
    // for legacy habits but would quietly turn "custom, no days picked" into a
    // daily habit. Onboarding treats that as incomplete instead.
    if (draft.recurrence === 'custom' && draftTaskDays(draft).length === 0) return null;

    const habit = draftToHabit(draft) as Habit;
    const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
    for (let i = 0; i < 366; i += 1) {
        if (isHabitScheduledForDate(habit, cursor)) return new Date(cursor);
        cursor.setDate(cursor.getDate() + 1);
    }
    return null;
}

/** False when the draft cannot produce a real schedule yet. */
export function hasValidSchedule(draft: OnboardingDraft): boolean {
    return !(draft.recurrence === 'custom' && draftTaskDays(draft).length === 0);
}

export function describeRecurrence(draft: OnboardingDraft): string {
    if (draft.recurrence === 'weekdays') return 'Weekdays';
    if (draft.recurrence === 'custom') {
        const days = draft.taskDays ?? [];
        if (days.length === 0) return 'No days chosen';
        if (days.length === 7) return 'Every day';
        return WEEKDAY_KEYS.filter(day => days.includes(day))
            .map(day => day.charAt(0).toUpperCase() + day.slice(1))
            .join(', ');
    }
    return 'Every day';
}

export function formatTarget(value: number | undefined, unit: string | undefined, tracking?: string): string {
    if (tracking === 'boolean') return 'Done or not done';
    return `${value ?? 1} ${unit ?? 'time'}`.trim();
}

/* -------------------------------------------------------------------------- */
/*  Persistence                                                                */
/* -------------------------------------------------------------------------- */

/** Draft persistence. Failures are swallowed: losing a draft must not crash setup. */
export async function loadDraft(): Promise<OnboardingDraft | null> {
    try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        return raw ? (JSON.parse(raw) as OnboardingDraft) : null;
    } catch {
        return null;
    }
}

export async function saveDraft(draft: OnboardingDraft): Promise<void> {
    try {
        await AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
        // Keep going; the in-memory draft is still usable for this session.
    }
}

export async function clearDraft(): Promise<void> {
    try {
        await AsyncStorage.removeItem(DRAFT_KEY);
    } catch {
        // Nothing to do.
    }
}
