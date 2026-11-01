import { DeviceEventEmitter, type EmitterSubscription } from 'react-native';
import type { Habit } from './habitsSQLite';
import type { Task } from './tasks';
import type { DayTally } from './dayComplete';
import type { DailyTarget } from './dailyFocus';

/**
 * Every message the app broadcasts to itself, and what it carries.
 *
 * The app coordinates screens through a device-wide emitter, which is a
 * reasonable fit for a local-first app: a habit ticked in one tab has to show
 * in three others, and nothing here is worth a store for. What it lacked was
 * any way to be wrong loudly. Both ends were raw strings, so a mistyped name or
 * a payload that quietly changed shape failed in the only way an event bus can
 * — by doing nothing at all, on a screen nobody was looking at.
 *
 * Naming them once makes both ends checkable: `emit` and `on` below accept only
 * these keys, and only the payload each key declares.
 */
export interface AppEvents {
    /* ---------------------------------------------------- something changed */
    /** A habit was ticked, un-ticked or skipped. Empty means "something did". */
    habit_completion_updated: {
        habitId?: string; date?: string; completed?: boolean; skipped?: boolean; value?: number;
    };
    habit_completed: { habitId: string; date: string; value: number };
    habit_created: { habit: Habit };
    habit_updated: { habitId?: string };
    habit_deleted: { habitId: string };
    goal_deleted: { goalId: string };
    tasks_changed: void;
    /** Settings → How Habyss works: Home runs the first-run walkthrough again. */
    start_walkthrough: void;
    /** A tab in the dock was tapped (its route name): the tour waits for Roadmap and Community. */
    tab_selected: string;
    /** A new goal was saved from the goal sheet. */
    goal_created: { goalId: string };
    /** The tour is on the goals in Roadmap: Roadmap shows its list, not the timeline, until the tour ends. */
    tour_roadmap_list: void;
    tour_end: void;
    /** A goal's milestones were added, changed, reached or removed. */
    milestones_changed: { goalId?: string; reached?: boolean };
    task_completed: { taskId: string };
    /** A done task opened again: it can earn again. */
    task_reopened: { taskId: string };
    /** "Next" pressed on the watch during a focus session: finish this one, go to the next. */
    focus_next: { id?: string };
    /** Settings → Focus → Turn sideways to focus changed. */
    engagement_settings_changed: void;
    /** Every task and habit for the day is done. */
    day_complete: { tally: DayTally; streak: number; completedDates: string[] };
    /** The day's promise — three things, or five — has been kept. */
    daily_target_reached: { done: number; target: number };
    /** A goal reached a hundred per cent for the first time. */
    /** `count`: goals done now, this one included. */
    goal_complete: { goalId: string; name: string; count?: number; color?: string; icon?: string };
    daily_focus_target_changed: DailyTarget;

    /* ------------------------------------------------------------- the account */
    cloud_restored: void;
    /** A bet was placed, a goal opened to bets, or one settled (lib/market.ts): the wallet and market read again. */
    market_changed: void;
    /** A habit or goal sheet opened by the create flow has closed (saved or not): speaking freely opens the next one (lib/voicePlan.ts). */
    creation_sheet_closed: { kind: 'habit' | 'goal' };
    social_state_updated: void;
    premium_status_updated: void;
    notifications_updated: { unreadCount: number };

    /* -------------------------------------------------- a screen is being asked */
    /** Where on screen the creation modal should grow from. */
    show_creation_modal: { x: number; y: number; size: number; height?: number } | undefined;
    close_creation_modal: void;
    /** Holding the create button: listen for a habit, task or goal said aloud. */
    voice_start: void;
    voice_stop: void;
    /** What the voice listener is doing, for the create button to draw. */
    voice_state: { listening: boolean; heard: string };
    show_habit_modal: { goalId?: string; initialHabit?: Habit } | undefined;
    show_task_form: { task?: Task; goalId?: string; /** A row id to open with, e.g. 'due'. */ focus?: string; /** Words to start with (from voice). */ prefill?: string } | undefined;
    show_goal_quick_add: { goal?: Habit; prefill?: string } | undefined;
    show_quick_add: { goalId?: string; prefillName?: string } | undefined;
    openModal: { modal: string };
    /** Raise the feedback sheet from anywhere. `screen` is collected, not typed. */
    show_feedback: { screen?: string } | undefined;
    /** Developer page: play the rank-up moment for a rank, without changing anything. */
    preview_climb: { rank: string };
    /** Developer page: open an easter egg, or ask a quick question, now. */
    preview_question: { kind: 'mood' | 'energy' };
}

export type AppEvent = keyof AppEvents;

/**
 * Events carrying nothing take no second argument, events whose payload is
 * optional may omit it, and the rest must supply one.
 */
type Payload<K extends AppEvent> =
    AppEvents[K] extends void ? []
    : undefined extends AppEvents[K] ? [AppEvents[K]?]
    : [AppEvents[K]];

export function emit<K extends AppEvent>(event: K, ...payload: Payload<K>): void {
    DeviceEventEmitter.emit(event, payload[0]);
}

export function on<K extends AppEvent>(
    event: K,
    handler: (payload: AppEvents[K]) => void,
): EmitterSubscription {
    return DeviceEventEmitter.addListener(event, handler);
}

/** Subscribe to several at once; the returned function drops them all. */
export function onAny(events: AppEvent[], handler: () => void): () => void {
    const subs = events.map(event => DeviceEventEmitter.addListener(event, handler));
    return () => subs.forEach(sub => sub.remove());
}
