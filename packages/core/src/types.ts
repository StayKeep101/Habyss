/**
 * What a habit and a task are, for both apps (the phone stores them in SQLite, the Mac mirrors them from the cloud).
 * One definition; each app's storage reads and writes this shape.
 */
import type { HabitAnchor } from './habitAnchor';
import type { ScheduleEra } from './scheduleHistory';
import type { HealthMetric } from './healthMetrics';

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
    frequency?: HabitFrequency;
    weekInterval?: number;
    graphStyle?: string;
    timeOfDay?: TimeOfDay;
    trackingMethod?: TrackingMethod;
    ringtone?: string;
    locationReminders?: LocationReminder[];
    reminderOffset?: number; // Minutes before start time
    /** Its own reminders before it begins, in minutes (lib/itemAlerts.ts); replaces reminderOffset when set. */
    alerts?: number[];
    /** Held before or after an event or meal by name (lib/habitAnchor.ts); null clears it. */
    anchor?: HabitAnchor | null;
    /** One specific sentence for this habit's reminder; Echo writes it when unset. */
    reminderMessage?: string;
    /** A lib/recurrence rule as JSON, when the schedule needs more than weekdays. */
    recurrence?: string;
    /** The schedules it had before, so a change never rewrites past days (lib/scheduleHistory.ts). Kept on this phone. */
    scheduleHistory?: ScheduleEra[];
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

export interface LocationReminder {
    name: string;
    latitude: number;
    longitude: number;
    radius?: number;
    /** Remind on arriving or leaving; or `stay`: tick it by itself after `stayMinutes` there (lib/LocationService.ts). */
    trigger?: 'arrive' | 'leave' | 'stay';
    /** For `stay`: minutes there before it counts (30 when absent). */
    stayMinutes?: number;
}

export type TaskStatus = 'open' | 'done' | 'cancelled';
/** 1 is the most important. Kept numeric so ordering is obvious. */
export type TaskPriority = 1 | 2 | 3;
export type TaskDifficulty = 1 | 2 | 3;
export type TaskSource = 'app' | 'mcp' | 'shortcut';
/**
 * What finishing a task means: ticking it ("Send proposal"), reaching a count
 * ("Call 25 leads") or putting in time ("Study 2 hours", target in minutes).
 */
export type TaskMeasure = 'done' | 'count' | 'time';

export interface Task {
    id: string;
    title: string;
    description?: string;
    /** "YYYY-MM-DD" in the user's local calendar. */
    dueDate?: string;
    /** "HH:MM", 24 hour. */
    dueTime?: string;
    estimatedMinutes?: number;
    priority: TaskPriority;
    status: TaskStatus;
    completedAt?: string;
    source: TaskSource;
    /** Stable id from whatever created it, so re-importing updates in place. */
    externalId?: string;
    /** Absent on a done-or-not task. */
    measure?: TaskMeasure;
    /** The count to reach, or minutes for a time task. */
    target?: number;
    /** What a count task counts ("leads", "words"). */
    unit?: string;
    /** How far it has got; a done task with no amount counts as its target. */
    amount?: number;
    /** 1 easy, 2 medium, 3 hard: the timeline puts hard things in your best hours. Kept on this phone. */
    difficulty?: TaskDifficulty;
    /** The steps it is made of, ticked one by one ("Write", "Edit", "Publish"). */
    subtasks?: Subtask[];
    /**
     * "YYYY-MM-DD": when it must be done by, when that is later than its day
     * (`dueDate`, the day you plan to do it). Kept on this phone.
     */
    deadline?: string;
    /** At its set time: false keeps it exactly there; otherwise the timeline may move it. Kept on this phone. */
    flexible?: boolean;
    /** Its own reminders before it begins, in minutes (lib/itemAlerts.ts). */
    alerts?: number[];
    /** Reminded at this time on its day, "HH:MM", like a habit's reminder. */
    reminder?: string;
    /** Reminded on arriving at or leaving a place, like a habit's (lib/LocationService.ts). */
    locationReminders?: LocationReminder[];
    /** The heading it sits under in its goal's to-do list ("Research"). Kept on this phone. */
    section?: string;
    /** Right before or after something in the day, like a habit's (lib/habitAnchor.ts). Kept on this phone. */
    anchor?: HabitAnchor;
    /** Done early: what its Shards were multiplied by (lib/taskSpeed.ts). Kept on this phone. */
    speed?: number;
    createdAt: string;
    updatedAt: string;
}

/** One step of a task. */
export interface Subtask { id: string; title: string; done: boolean }
