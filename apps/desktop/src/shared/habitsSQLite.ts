// Copied from Habyss Mobile lib/habitsSQLite.ts @0fcd218. Keep in sync; do not re-derive rules.
// Type-only extract: the storage, cache and notification code stays on mobile.

/** From lib/healthMetrics.ts. */
export type HealthMetric = 'sleep';
export type HabitCategory = 'body' | 'wealth' | 'heart' | 'mind' | 'soul' | 'play' | 'health' | 'fitness' | 'work' | 'personal' | 'mindfulness' | 'misc' | 'productivity' | 'learning' | 'creativity' | 'social' | 'family' | 'finance';
export type HabitType = 'build' | 'quit';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly';
export type ChartType = 'bar' | 'line';
export type HabitFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'free_time';
export type TrackingMethod = 'boolean' | 'numeric';

export interface Habit {
    id: string;
    name: string;
    description?: string;
    icon?: string;
    category: HabitCategory;
    createdAt: string;
    durationMinutes?: number;
    startTime?: string;
    endTime?: string;
    isGoal?: boolean;
    targetDate?: string;
    type: HabitType;
    color: string;
    goalPeriod: GoalPeriod;
    goalValue: number;
    unit: string;
    taskDays: string[];
    reminders: string[];
    chartType: ChartType;
    startDate: string;
    endDate?: string;
    isArchived: boolean;
    showMemo: boolean;
    goalId?: string;
    frequency?: HabitFrequency;
    weekInterval?: number;
    graphStyle?: string;
    timeOfDay?: TimeOfDay;
    trackingMethod?: TrackingMethod;
    ringtone?: string;
    /** Parsed goal contract as JSON; set on goals created from natural language. */
    goalSpec?: string;
    locationReminders?: LocationReminder[];
    reminderOffset?: number; // Minutes before start time
    /** One specific sentence for this habit's reminder; Echo writes it when unset. */
    reminderMessage?: string;
    /** A lib/recurrence rule as JSON, when the schedule needs more than weekdays. */
    recurrence?: string;
    /** Which Apple Health metric answers for this habit; see lib/healthMetrics. */
    healthKitMetric?: HealthMetric;
    healthKitTarget?: number; // New
    /** 1 high, 2 normal, 3 low: how the timeline orders it when it has no time. Kept on this phone. */
    priority?: 1 | 2 | 3;
    /** 1 easy, 2 medium, 3 hard: hard ones go in your best hours. Kept on this phone. */
    difficulty?: 1 | 2 | 3;
    /** At its set time: false keeps it exactly there; otherwise the timeline may move it. Kept on this phone. */
    flexible?: boolean;
}

/**
 * A place this habit listens for, and which way you have to cross it.
 *
 * `trigger` is absent on every place saved before directions existed, and
 * absent means arriving — which is what those places already did.
 */
export interface LocationReminder {
    name: string;
    latitude: number;
    longitude: number;
    radius?: number;
    trigger?: 'arrive' | 'leave';
}
