//! The menu bar pill: the same countdown as the phone's Live Activity (mobile lib/scheduledActivities.ts `activityPlan`).
//! A running focus session wins; otherwise the timeline item on now counts down to its end, and between items the next
//! one counts down to its start. The webview sends the day's slots (`set_day_plan`); this ticks them every second, so the
//! pill keeps counting while every window is hidden.
use crate::{focus, models::{FocusSession, Settings}};
use serde::Deserialize;

/// One timeline item for the pill: epoch ms. `fixed` marks meals, events and travel.
#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct PlanSlot { pub key: String, pub title: String, pub start: i64, pub end: i64, #[serde(default)] pub fixed: bool }

/// Time left as the phone's Live Activity shows it: `M:SS`, or `H:MM:SS` from an hour. Rounded up to the second.
pub fn clock(ms: i64) -> String {
    let secs = (ms.max(0) + 999) / 1000;
    let (h, m, s) = (secs / 3600, secs / 60 % 60, secs % 60);
    if h > 0 { format!("{h}:{m:02}:{s:02}") } else { format!("{m}:{s:02}") }
}

/// `text · title`, the title cut to 24 characters (the last being the ellipsis), or the text alone.
pub fn with_title(text: String, title: &str, settings: &Settings) -> String {
    let title = title.trim();
    if !settings.menu_bar_task || title.is_empty() { return text; }
    if title.chars().count() > 24 { format!("{text} · {}…", title.chars().take(23).collect::<String>()) } else { format!("{text} · {title}") }
}

/// The pill's text now: "" shows the icon alone.
pub fn title(focus_session: Option<&FocusSession>, plan: &[PlanSlot], now: i64, settings: &Settings) -> String {
    if !settings.menu_bar_timer { return String::new(); }
    if let Some(f) = focus_session.filter(|s| s.end.is_none()) { return focus::tray_title(Some(f), now, settings); }
    if let Some(on) = plan.iter().find(|s| s.start <= now && now < s.end) { return with_title(clock(on.end - now), &on.title, settings); }
    match plan.iter().filter(|s| s.start > now).min_by_key(|s| s.start) {
        Some(next) => with_title(clock(next.start - now), &next.title, settings),
        None => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{FocusSession, Settings};

    fn slot(start: i64, end: i64, title: &str) -> PlanSlot { PlanSlot { key: format!("habit:{title}"), title: title.into(), start, end, fixed: false } }
    fn focus() -> FocusSession { FocusSession { id: "f".into(), label: "Deep Work".into(), start: 0, end: None, target_ms: 1_500_000, state: "running".into(), paused_ms: 0, paused_at: None, item_id: None, item_kind: None } }

    #[test] fn counts_down_the_item_on_now_like_the_live_activity() {
        let st = Settings::default();
        assert_eq!(title(None, &[slot(0, 600_000, "Shower")], 7_000, &st), "9:53 · Shower");
        assert_eq!(title(None, &[slot(0, 3 * 3_600_000 + 120_000, "Study")], 0, &st), "3:02:00 · Study");
        assert_eq!(title(None, &[slot(0, 600_000, "Shower")], 7_000, &Settings { menu_bar_task: false, ..st.clone() }), "9:53");
    }
    #[test] fn between_items_counts_to_the_next_start() {
        let plan = [slot(0, 60_000, "Done one"), slot(600_000, 900_000, "Run")];
        assert_eq!(title(None, &plan, 120_000, &Settings::default()), "8:00 · Run");
    }
    #[test] fn focus_wins_over_the_timeline() {
        assert_eq!(title(Some(&focus()), &[slot(0, 600_000, "Shower")], 0, &Settings::default()), "25:00 · Deep Work");
    }
    #[test] fn nothing_left_shows_only_the_icon() {
        assert_eq!(title(None, &[], 0, &Settings::default()), "");
        assert_eq!(title(None, &[slot(0, 60_000, "Over")], 120_000, &Settings::default()), "");
        assert_eq!(title(None, &[slot(0, 600_000, "Shower")], 7_000, &Settings { menu_bar_timer: false, ..Settings::default() }), "");
    }
    #[test] fn formats_like_the_phone() {
        assert_eq!(clock(593_000), "9:53");
        assert_eq!(clock(1_000), "0:01");
        assert_eq!(clock(3_723_000), "1:02:03");
        assert_eq!(clock(400), "0:01");
    }
}
