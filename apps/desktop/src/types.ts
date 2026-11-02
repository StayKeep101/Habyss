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
}
export type Screen = 'Dashboard' | 'Timeline' | 'Applications' | 'Focus' | 'Analytics' | 'Settings';
export type Act = (command: string, args?: Record<string, unknown>) => Promise<void>;
