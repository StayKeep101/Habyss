use serde::{Deserialize, Serialize};
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    pub tracking_enabled: bool, pub onboarding_complete: bool, pub idle_threshold: i64,
    pub collect_titles: bool, pub excluded_apps: Vec<String>, pub excluded_title_patterns: Vec<String>,
    pub start_minimized: bool, pub appearance: String, pub retention_days: i64,
    pub menu_bar_timer: bool, pub menu_bar_task: bool,
}
impl Default for Settings { fn default() -> Self { Self { tracking_enabled: false, onboarding_complete: false, idle_threshold: 120, collect_titles: false, excluded_apps: vec![], excluded_title_patterns: vec![], start_minimized: false, appearance: "dark".into(), retention_days: 0, menu_bar_timer: true, menu_bar_task: true } } }
impl Settings {
    pub fn validate(&self) -> Result<(), String> {
        if !(15..=3600).contains(&self.idle_threshold) { return Err("Idle threshold must be 15–3600 seconds".into()); }
        if !(0..=36500).contains(&self.retention_days) { return Err("Invalid retention period".into()); }
        if !["dark","light","system"].contains(&self.appearance.as_str()) { return Err("Invalid appearance".into()); }
        for pattern in &self.excluded_title_patterns { regex::Regex::new(pattern).map_err(|e| e.to_string())?; }
        Ok(())
    }
}
#[derive(Clone, Debug, Deserialize)]
pub struct NativeSample { pub utc: i64, pub mono: i64, pub idle_ms: i64, pub bundle: Option<String>, pub name: String, pub title: Option<String>, pub pid: i32, pub window_id: Option<String>, pub state: String, pub trusted: bool, pub availability: String }
#[derive(Serialize)]
pub struct Interval { pub id: String, pub application_id: Option<String>, pub name: String, pub bundle_id: Option<String>, pub title: Option<String>, pub start: i64, pub end: i64, pub state: String, pub category: String, pub availability: String, pub pid: i32, pub window_id: Option<String> }
#[derive(Serialize)]
pub struct Application { pub id: String, pub bundle_id: String, pub name: String, pub category: String, pub first_seen: i64, pub last_seen: i64 }
#[derive(Clone, Debug, Serialize)]
pub struct FocusSession { pub id: String, pub label: String, pub start: i64, pub end: Option<i64>, pub target_ms: i64, pub state: String, pub paused_ms: i64, pub paused_at: Option<i64>, pub item_id: Option<String>, pub item_kind: Option<String> }
#[derive(Serialize)]
pub struct Snapshot { pub settings: Settings, pub intervals: Vec<Interval>, pub applications: Vec<Application>, pub focus: Vec<FocusSession>, pub trusted: bool, pub current_app: Option<String>, pub current_since: Option<i64>, pub state: String, pub error: Option<String>, pub widget_available: bool, pub database_path: String, pub version: &'static str, pub classifications: std::collections::HashMap<String,String> }
