import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Habit, HabitCategory, TimeOfDay } from './habitsSQLite';
import { isHabitScheduledForDate, localDateKey } from './habitSchedule';
import type { PersonalityModeId } from '@/constants/AIPersonalities';

/**
 * Onboarding data model.
 *
 * Every answer here changes something the user can see afterwards: the area
 * ranks suggestions, the obstacle changes which target is recommended and
 * whether a cue and reminder are offered, and the rest is saved directly onto
 * the habit. Nothing is collected for its own sake.
 */

export const DRAFT_KEY = 'habyss_onboarding_draft';

export type AreaId = 'body' | 'mind' | 'soul' | 'wealth' | 'heart';
export type ObstacleId = 'forgetting' | 'too_big' | 'no_time' | 'unsure';

export interface Area {
    id: AreaId;
    label: string;
    blurb: string;
    icon: string;
    category: HabitCategory;
}

export const AREAS: Area[] = [
    { id: 'body', label: 'Move more', blurb: 'Training, walking, stretching', icon: 'barbell-outline', category: 'body' },
    { id: 'mind', label: 'Focus and learn', blurb: 'Reading, studying, deep work', icon: 'book-outline', category: 'mind' },
    { id: 'soul', label: 'Feel calmer', blurb: 'Breathing, journalling, rest', icon: 'leaf-outline', category: 'soul' },
    { id: 'wealth', label: 'Work and money', blurb: 'Planning, saving, admin', icon: 'trending-up-outline', category: 'wealth' },
    { id: 'heart', label: 'People I care about', blurb: 'Staying in touch, showing up', icon: 'heart-outline', category: 'heart' },
];

export interface Obstacle {
    id: ObstacleId;
    label: string;
    /** Shown so the effect of the answer is never a surprise. */
    effect: string;
}

export const OBSTACLES: Obstacle[] = [
    { id: 'forgetting', label: 'I forget', effect: 'Adds a routine cue and offers a reminder' },
    { id: 'too_big', label: 'I start too big', effect: 'Recommends the smaller target' },
    { id: 'no_time', label: 'I run out of time', effect: 'Puts the shortest habits first' },
    { id: 'unsure', label: 'Not sure yet', effect: 'Starts small, nothing added' },
];

export interface HabitSuggestion {
    id: string;
    name: string;
    icon: string;
    area: AreaId;
    category: HabitCategory;
    /** Minutes the activity takes, used to rank when time is the obstacle. */
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
    // Body
    { id: 'walk', name: 'Walk', icon: 'walk-outline', area: 'body', category: 'body', minutes: 15, standard: { value: 15, unit: 'min' }, small: { value: 5, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'After lunch' },
    { id: 'strength', name: 'Strength training', icon: 'barbell-outline', area: 'body', category: 'body', minutes: 30, standard: { value: 30, unit: 'min' }, small: { value: 10, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'After work' },
    { id: 'stretch', name: 'Stretch', icon: 'body-outline', area: 'body', category: 'body', minutes: 5, standard: { value: 10, unit: 'min' }, small: { value: 3, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'Before bed' },
    // Mind
    { id: 'read', name: 'Read', icon: 'book-outline', area: 'mind', category: 'mind', minutes: 20, standard: { value: 10, unit: 'pages' }, small: { value: 2, unit: 'pages' }, trackingMethod: 'numeric', suggestedCue: 'With morning coffee' },
    { id: 'deep_work', name: 'Deep work', icon: 'timer-outline', area: 'mind', category: 'mind', minutes: 25, standard: { value: 25, unit: 'min' }, small: { value: 10, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'First thing at my desk' },
    { id: 'study', name: 'Study', icon: 'school-outline', area: 'mind', category: 'learning', minutes: 20, standard: { value: 20, unit: 'min' }, small: { value: 5, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'After dinner' },
    // Soul
    { id: 'meditate', name: 'Meditate', icon: 'leaf-outline', area: 'soul', category: 'soul', minutes: 10, standard: { value: 10, unit: 'min' }, small: { value: 3, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'After waking up' },
    { id: 'journal', name: 'Journal', icon: 'create-outline', area: 'soul', category: 'soul', minutes: 10, standard: { value: 1, unit: 'entry' }, small: { value: 1, unit: 'entry' }, trackingMethod: 'boolean', suggestedCue: 'Before bed' },
    { id: 'breathe', name: 'Breathing break', icon: 'cloud-outline', area: 'soul', category: 'mindfulness', minutes: 3, standard: { value: 3, unit: 'min' }, small: { value: 1, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'Mid-afternoon' },
    // Wealth
    { id: 'plan_day', name: 'Plan tomorrow', icon: 'list-outline', area: 'wealth', category: 'productivity', minutes: 5, standard: { value: 5, unit: 'min' }, small: { value: 2, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'End of the workday' },
    { id: 'track_spend', name: 'Log spending', icon: 'wallet-outline', area: 'wealth', category: 'finance', minutes: 5, standard: { value: 1, unit: 'check' }, small: { value: 1, unit: 'check' }, trackingMethod: 'boolean', suggestedCue: 'After dinner' },
    { id: 'inbox', name: 'Clear inbox', icon: 'mail-outline', area: 'wealth', category: 'work', minutes: 15, standard: { value: 15, unit: 'min' }, small: { value: 5, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'Before lunch' },
    // Heart
    { id: 'reach_out', name: 'Message someone', icon: 'chatbubble-outline', area: 'heart', category: 'social', minutes: 5, standard: { value: 1, unit: 'person' }, small: { value: 1, unit: 'person' }, trackingMethod: 'boolean', suggestedCue: 'On my commute' },
    { id: 'call', name: 'Call family', icon: 'call-outline', area: 'heart', category: 'family', minutes: 15, standard: { value: 10, unit: 'min' }, small: { value: 5, unit: 'min' }, trackingMethod: 'numeric', suggestedCue: 'After dinner' },
    { id: 'gratitude', name: 'Note one good thing', icon: 'sparkles-outline', area: 'heart', category: 'heart', minutes: 3, standard: { value: 1, unit: 'note' }, small: { value: 1, unit: 'note' }, trackingMethod: 'boolean', suggestedCue: 'Before bed' },
];

export type RecurrenceId = 'daily' | 'weekdays' | 'custom';

export interface OnboardingDraft {
    step: number;
    areaId?: AreaId;
    obstacleId?: ObstacleId;
    /** Suggestion id, or 'custom'. */
    suggestionId?: string;
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
    timeOfDay?: TimeOfDay;
    coachId?: PersonalityModeId;
    reminderTime?: string;
    /** Set once the habit row exists, so a retry cannot create a second one. */
    createdHabitId?: string;
}

export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Ranks suggestions for the chosen area; time pressure puts the shortest first. */
export function rankSuggestions(areaId: AreaId | undefined, obstacleId?: ObstacleId): HabitSuggestion[] {
    if (!areaId) return [];
    const forArea = SUGGESTIONS.filter(item => item.area === areaId);
    if (obstacleId === 'no_time') {
        return [...forArea].sort((a, b) => a.minutes - b.minutes);
    }
    return forArea;
}

/** The obstacle decides which of the two prepared targets is recommended. */
export function recommendedTarget(suggestion: HabitSuggestion, obstacleId?: ObstacleId) {
    if (obstacleId === 'too_big' || obstacleId === 'unsure') return suggestion.small;
    return suggestion.standard;
}

export const shouldSuggestCue = (obstacleId?: ObstacleId): boolean => obstacleId === 'forgetting';
export const shouldOfferReminder = (obstacleId?: ObstacleId): boolean => obstacleId === 'forgetting';

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
    const amount = value ?? 1;
    return `${amount} ${unit ?? 'time'}${amount === 1 || unit === 'min' ? '' : ''}`.trim();
}

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
