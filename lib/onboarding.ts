import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Habit, HabitCategory, TimeOfDay } from './habitsSQLite';
import { isHabitScheduledForDate, localDateKey } from './habitSchedule';
import type { PersonalityModeId } from '@/constants/AIPersonalities';
import type { AttemptsId, KillerId, TimeBudget, ToneId } from './onboardingAnswers';
import type { BlockerId, ChronotypeId, HopeId, JuggleId, SleepAmountId, SourceId, TimingId } from './onboardingProfile';

/**
 * The onboarding draft, and the schedule it turns into.
 *
 * What each answer changes lives in lib/onboardingAnswers.ts; this file is the
 * shape that is persisted between steps and the translation into a habit.
 */

export const DRAFT_KEY = 'habyss_onboarding_draft';

export type RecurrenceId = 'daily' | 'weekdays' | 'custom';

export interface PlanItem {
    id: string;
    kind: 'habit' | 'task';
    title: string;
    /** Tasks only: the day it is due. */
    dueDate?: string;
}

/**
 * Bumped whenever steps are added or reordered. A draft saved by an older
 * flow keeps its answers but starts again from the welcome screen, because its
 * step number would now point at a different question.
 */
export const FLOW_VERSION = 5;

export interface OnboardingDraft {
    step: number;
    flow?: number;

    /** What Echo calls them. Also saved as their profile name. */
    name?: string;
    /** The voice Echo speaks in; one of the app's personalities. */
    echo?: PersonalityModeId;
    /** "HH:MM" local; when their day starts and ends. */
    wake?: string;
    sleep?: string;

    /* What we ask about the person. See lib/onboardingProfile.ts. */
    /** Where they heard about Habyss. Asked once, never acted on. */
    source?: SourceId;
    /** What they are carrying at once (job, school, side project…). Multi-select. */
    juggling?: JuggleId[];
    /** What they are here for. Multi-select. */
    hope?: HopeId[];
    /** Early bird, night owl, or neither; seeds the day window. */
    chronotype?: ChronotypeId;
    /** How much sleep they actually get. */
    sleepAmount?: SleepAmountId;
    /** When work actually happens, which decides how firm Echo starts. */
    timing?: TimingId;
    /** What gets in the way. Multi-select, and the strongest signal. */
    blockers?: BlockerId[];

    /* The seven answers. See lib/onboardingAnswers.ts for what each one does. */
    /** 1. The goal in their words, which becomes the measurable one in 7. */
    identityGoal?: string;
    /** 2. How many times they have tried this before. */
    attempts?: AttemptsId;
    /** 3. What kills their momentum. Multi-select, and the strongest signal. */
    killers?: KillerId[];
    /** 4. What giving up would cost. Optional, and quoted back later. */
    stakesText?: string;
    /** 5. How they want to be coached. */
    tone?: ToneId;
    /** 6. Minutes a day they say they can give. */
    timeBudget?: TimeBudget;
    /** 7. The measurable sentence, seeded from 1 and editable. */
    measurableText?: string;
    /** 7. Current value, for a goal like "lose 5 kg" that needs a starting point. */
    baselineText?: string;
    /**
     * 8. The path: checkpoints between today and the goal, seeded from the
     * confirmed target and then edited. Undefined means not built yet; an empty
     * array means the user removed them all, which is their choice to keep.
     */
    roadmapSteps?: { id: string; title: string; dueDate: string }[];

    /**
     * What gets them there: habits to repeat and one-off tasks with a date, in
     * the order the user arranged them. Replaces the separate roadmap and plan
     * steps, which asked for the same thing twice.
     */
    planItems?: PlanItem[];

    /* The habit those answers produce. */
    habitName?: string;
    targetValue?: number;
    targetUnit?: string;
    trackingMethod?: 'boolean' | 'numeric';
    icon?: string;
    category?: HabitCategory;
    recurrence?: RecurrenceId;
    taskDays?: string[];
    startDate?: string;
    cue?: string;
    /** "HH:MM" when a time was given. */
    startTime?: string;
    timeOfDay?: TimeOfDay;
    coachId?: PersonalityModeId;
    reminderTime?: string;
    /** Label of the place saved as an arrival reminder, if any. */
    arrivalPlace?: string;

    /**
     * The on-device model's reading of the goal, kept with the exact text it
     * read. Used instead of the rule-based parse only while the text is
     * unchanged, so editing the goal can never leave a stale reading behind.
     */
    goalReading?: { text: string; result: import('./goalParser').GoalParseResult };

    /** Set once the plan has been written, so a retry cannot duplicate it. */
    planSaved?: boolean;

    /** Set once the rows exist, so a retry cannot create duplicates. */
    createdGoalId?: string;
    createdHabitId?: string;
}

export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Days the draft actually runs on. Empty means every day. */
export function draftTaskDays(draft: OnboardingDraft): string[] {
    if (draft.recurrence === 'weekdays') return ['mon', 'tue', 'wed', 'thu', 'fri'];
    if (draft.recurrence === 'custom') return draft.taskDays ?? [];
    return [];
}

/**
 * Builds the habit exactly as it will be saved, so the plan shown at the end
 * and the stored row can never drift apart.
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

/* -------------------------------------------------------------------------- */
/*  Persistence                                                                */
/* -------------------------------------------------------------------------- */

/** Draft persistence. Failures are swallowed: losing a draft must not crash setup. */
export async function loadDraft(): Promise<OnboardingDraft | null> {
    try {
        const raw = await AsyncStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const draft = JSON.parse(raw) as OnboardingDraft;
        return draft.flow === FLOW_VERSION ? draft : { ...draft, step: 0, flow: FLOW_VERSION };
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
