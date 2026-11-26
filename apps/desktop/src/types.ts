export interface Settings {
    tracking_enabled: boolean;
    onboarding_complete: boolean;
    idle_threshold: number;
    collect_titles: boolean;
    excluded_apps: string[];
    excluded_title_patterns: string[];
    start_minimized: boolean;
    appearance: 'dark' | 'light' | 'system';
    retention_days: number;
    menu_bar_timer: boolean;
    menu_bar_task: boolean;
}
export interface Interval {
    id: string;
    application_id: string | null;
    bundle_id: string | null;
    name: string;
    title: string | null;
    start: number;
    end: number;
    state: string;
    category: string;
    availability: string;
    pid: number;
    window_id: string | null;
    /** Front browser tab (scheme, host, path only); null outside browsers or without the titles opt-in. */
    url: string | null;
    domain: string | null;
    /** File path of the focused document, when the app exposes one. */
    document: string | null;
    /** Milliseconds of this span with keyboard input, pointer input, a call (microphone in use) or playing video. */
    typing_ms: number;
    pointer_ms: number;
    meeting_ms: number;
    media_ms: number;
}
export interface Application {
    id: string;
    bundle_id: string;
    name: string;
    category: string;
    first_seen: number;
    last_seen: number;
}
export interface FocusSession {
    id: string;
    label: string;
    start: number;
    end: number | null;
    target_ms: number;
    state: string;
    paused_ms: number;
    paused_at: number | null;
    item_id: string | null;
    item_kind: string | null;
}
export interface Snapshot {
    settings: Settings;
    intervals: Interval[];
    applications: Application[];
    focus: FocusSession[];
    trusted: boolean;
    current_app: string | null;
    current_since: number | null;
    state: string;
    error: string | null;
    widget_available: boolean;
    database_path: string;
    version: string;
    classifications: Record<string, 'productive' | 'neutral' | 'unproductive'>;
}
export type Screen = 'Dashboard' | 'Calendar' | 'Progress' | 'Analytics' | 'Friends' | 'Profile' | 'Settings';
export type Act = (command: string, args?: Record<string, unknown>) => Promise<void>;
/** `state` is the latest sync pass; `account` is whether someone is signed in on this Mac (read sign-in from it, through `isSignedIn`). */
export interface SyncStatus { state: string; account: boolean; email: string | null; last_sync: string | null; pending: number; refused: number; error: string | null }
export interface Cached<T> { value: T; fetched_at: string; stale: boolean }
export interface HabitRow { id: string; user_id: string | null; anchor?: string | null; name: string | null; description: string | null; category: string | null; icon: string | null; is_goal: number | null; target_date: string | null; goal_id: string | null; task_days: string | null; reminders: string | null; start_date: string | null; end_date: string | null; duration_minutes: number | null; start_time: string | null; end_time: string | null; type: string | null; color: string | null; goal_period: string | null; goal_value: number | null; unit: string | null; chart_type: string | null; is_archived: number | null; show_memo: number | null; frequency: string | null; week_interval: number | null; time_of_day: string | null; graph_style: string | null; tracking_method: string | null; reminder_offset: number | null; reminder_message: string | null; recurrence: string | null; location_reminders: string | null; health_kit_metric: string | null; health_kit_target: number | null; ringtone: string | null; goal_spec: string | null; priority: number | null; difficulty: number | null; flexible: number | null; created_at: string | null; updated_at: string | null; deleted: number; synced: number; owner_id: string | null; refused: number }
export interface CompletionRow { id: string; user_id: string | null; habit_id: string; date: string; value: number | null; memo: string | null; created_at: string | null; updated_at: string | null; evidence: string | null; skipped: number | null; deleted: number; synced: number; owner_id: string | null; refused: number }
export interface TaskRow { id: string; user_id: string | null; title: string | null; description: string | null; due_date: string | null; due_time: string | null; estimated_minutes: number | null; priority: number | null; goal_id: string | null; status: string | null; completed_at: string | null; source: string | null; external_id: string | null; measure: string | null; target: number | null; unit: string | null; amount: number | null; milestone_id: string | null; subtasks: string | null; deadline: string | null; section: string | null; difficulty: number | null; flexible: number | null; created_at: string | null; updated_at: string | null; deleted: number; synced: number; owner_id: string | null; refused: number }
export interface CloudData { habits: HabitRow[]; completions: CompletionRow[]; tasks: TaskRow[]; /** The day's settings synced with the phone, by key (day_window, meals, travel:…, day_memory:<date>, events:<date>, …). */ day_inputs: Record<string, unknown> }
