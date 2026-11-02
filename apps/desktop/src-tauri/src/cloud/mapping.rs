//! Row translation between the local SQLite mirror and Supabase. Port of mobile `lib/cloudMapping.ts`.
//! Local: 0/1 booleans, JSON as text, `deleted`, `synced`. Server: real booleans, jsonb, `deleted_at`.
//! Values are corrected against the server's rules, since one rejected row fails its whole batch.
use regex::Regex;
use serde_json::{json, Map, Value};
use std::sync::OnceLock;

static NULL: Value = Value::Null;
const GRAPH_STYLES: [&str; 5] = ["progress", "bar", "line", "heatmap", "streak"];
const TRACKING: [&str; 5] = ["boolean", "numeric", "quantity", "duration", "rating"];
const TASK_STATUS: [&str; 3] = ["open", "done", "cancelled"];
/// The three the server's check constraint allows; anything else uploads as null.
const EVIDENCE: [&str; 3] = ["verified", "context", "self"];
const TASK_SOURCE: [&str; 3] = ["app", "mcp", "shortcut"];
const TASK_MEASURE: [&str; 3] = ["done", "count", "time"];
/// Fields a shared task must never upload onto a friend's row.
pub const PERSONAL_TASK_FIELDS: [&str; 3] = ["status", "completed_at", "amount"];

fn g<'a>(row: &'a Value, k: &str) -> &'a Value { row.get(k).unwrap_or(&NULL) }
fn now() -> String { chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true) }
/// JS truthiness.
fn truthy(v: &Value) -> bool {
    match v { Value::Null => false, Value::Bool(b) => *b, Value::String(s) => !s.is_empty(), Value::Number(n) => n.as_f64().map_or(true, |f| f != 0.0 && !f.is_nan()), _ => true }
}
/// `row[k] ?? default`
fn or_d(row: &Value, k: &str, d: Value) -> Value { match g(row, k) { Value::Null => d, v => v.clone() } }
/// `row[k] || default`
fn or_t(row: &Value, k: &str, d: &str) -> Value { let v = g(row, k); if truthy(v) { v.clone() } else { json!(d) } }
fn in_list(list: &[&str], v: &Value) -> bool { v.as_str().map_or(false, |s| list.contains(&s)) }
fn pick(list: &[&str], v: &Value, d: Value) -> Value { if in_list(list, v) { v.clone() } else { d } }
/// A whole number as an integer, anything else as a float, so equality with parsed JSON holds.
fn num(f: f64) -> Value { if f.fract() == 0.0 && f.abs() < 9e15 { json!(f as i64) } else { json!(f) } }
fn round(f: f64) -> f64 { (f + 0.5).floor() }
fn bool_of(v: &Value) -> bool { match v { Value::Bool(b) => *b, Value::Number(n) => n.as_f64() == Some(1.0), Value::String(s) => s == "1", _ => false } }
fn flag(v: &Value) -> Value { json!(if truthy(v) { 1 } else { 0 }) }

/// TS `Number(v)` made finite-or-nothing: null and "" are None, numeric strings parse.
fn finite(v: &Value) -> Option<f64> {
    let f = match v {
        Value::Number(n) => n.as_f64()?,
        Value::Bool(b) => *b as i32 as f64,
        Value::String(s) if s.is_empty() => return None,
        Value::String(s) => if s.trim().is_empty() { 0.0 } else { s.trim().parse::<f64>().ok()? },
        _ => return None,
    };
    f.is_finite().then_some(f)
}
fn finite_v(v: &Value) -> Value { finite(v).map_or(Value::Null, num) }

pub fn is_uuid(v: &Value) -> bool {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r"(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$").unwrap());
    v.as_str().map_or(false, |s| re.is_match(s))
}
fn uuid_or_null(v: &Value) -> Value { if is_uuid(v) { v.clone() } else { Value::Null } }

pub fn parse_json(v: &Value, fallback: Value) -> Value {
    match v {
        Value::Null => fallback,
        Value::String(s) if s.is_empty() => fallback,
        Value::String(s) => serde_json::from_str(s).unwrap_or(fallback),
        other => other.clone(),
    }
}
fn to_json_text(v: &Value, fallback: &str) -> Value { if v.is_null() { json!(fallback) } else { json!(v.to_string()) } }

/// A calendar date, whether stored as "YYYY-MM-DD" or a full timestamp.
pub fn date_only(v: &Value) -> Value {
    let head = v.as_str().and_then(|s| s.get(..10));
    match head { Some(h) if h.bytes().enumerate().all(|(i, b)| if i == 4 || i == 7 { b == b'-' } else { b.is_ascii_digit() }) => json!(h), _ => Value::Null }
}

fn valid_time(v: &Value) -> Value {
    static RE: OnceLock<Regex> = OnceLock::new();
    let re = RE.get_or_init(|| Regex::new(r"^([01][0-9]|2[0-3]):[0-5][0-9]$").unwrap());
    if v.as_str().map_or(false, |s| re.is_match(s)) { v.clone() } else { Value::Null }
}
fn clip(s: &str, n: usize) -> String { s.chars().take(n).collect() }

/// When a locally deleted row stops existing, as the server records it.
fn deleted_at(row: &Value, updated: &Value) -> Value { if bool_of(g(row, "deleted")) { if updated.is_null() { json!(now()) } else { updated.clone() } } else { Value::Null } }

fn merge(mut base: Value, extra: Value) -> Value {
    if let (Some(b), Value::Object(e)) = (base.as_object_mut(), extra) { b.extend(e); }
    base
}

// Habits (and goals, which are habits with is_goal set)

pub fn habit_to_remote(row: &Value, user_id: &str) -> Value {
    let goal_value = finite(g(row, "goal_value"));
    let week_interval = finite(g(row, "week_interval"));
    let duration = finite(g(row, "duration_minutes"));
    let name = g(row, "name").as_str().unwrap_or("").trim();
    let name = if name.is_empty() { "Untitled" } else { name };
    let out = json!({
        "id": g(row, "id"), "user_id": user_id,
        "name": name,
        "description": g(row, "description"),
        "category": or_t(row, "category", "personal"),
        "icon": g(row, "icon"),
        "is_goal": bool_of(g(row, "is_goal")),
        "target_date": date_only(g(row, "target_date")),
        "goal_id": uuid_or_null(g(row, "goal_id")),
        "task_days": parse_json(g(row, "task_days"), json!([])),
        "reminders": parse_json(g(row, "reminders"), json!([])),
        "start_date": date_only(g(row, "start_date")),
        "end_date": date_only(g(row, "end_date")),
        "duration_minutes": duration.filter(|d| *d >= 0.0).map_or(Value::Null, |d| num(round(d))),
        "start_time": g(row, "start_time"), "end_time": g(row, "end_time"),
        "type": or_t(row, "type", "build"),
        "color": or_t(row, "color", "#6B46C1"),
        "goal_period": or_t(row, "goal_period", "daily"),
        "goal_value": num(goal_value.filter(|v| *v >= 0.0).unwrap_or(1.0)),
        "unit": or_t(row, "unit", "count"),
        "chart_type": or_t(row, "chart_type", "bar"),
        "is_archived": bool_of(g(row, "is_archived")),
    });
    let out = merge(out, json!({
        "show_memo": bool_of(g(row, "show_memo")),
        "frequency": g(row, "frequency"),
        "week_interval": num(week_interval.filter(|v| *v >= 1.0).map_or(1.0, f64::floor)),
        "time_of_day": g(row, "time_of_day"),
        "graph_style": pick(&GRAPH_STYLES, g(row, "graph_style"), Value::Null),
        "tracking_method": pick(&TRACKING, g(row, "tracking_method"), json!("boolean")),
        "reminder_offset": finite_v(g(row, "reminder_offset")),
        "reminder_message": g(row, "reminder_message"),
        "recurrence": g(row, "recurrence"),
        "location_reminders": parse_json(g(row, "location_reminders"), json!([])),
        "health_kit_metric": g(row, "health_kit_metric"),
        "health_kit_target": finite_v(g(row, "health_kit_target")),
        "ringtone": or_d(row, "ringtone", json!("default")),
        "goal_spec": parse_json(g(row, "goal_spec"), Value::Null),
        "created_at": g(row, "created_at"), "updated_at": g(row, "updated_at"),
        "deleted_at": deleted_at(row, g(row, "updated_at")),
    }));
    merge(out, planning_to_remote(row, true))
}

pub fn habit_to_local(row: &Value) -> Value {
    let stamp = |k: &str| or_d(row, k, json!(now()));
    let out = json!({
        "id": g(row, "id"), "user_id": g(row, "user_id"), "name": g(row, "name"),
        "description": g(row, "description"),
        "category": or_d(row, "category", json!("personal")),
        "icon": g(row, "icon"),
        "is_goal": flag(g(row, "is_goal")),
        "target_date": date_only(g(row, "target_date")),
        "goal_id": g(row, "goal_id"),
        "task_days": to_json_text(g(row, "task_days"), "[]"),
        "reminders": to_json_text(g(row, "reminders"), "[]"),
        "start_date": date_only(g(row, "start_date")),
        "end_date": date_only(g(row, "end_date")),
        "duration_minutes": g(row, "duration_minutes"),
        "start_time": g(row, "start_time"), "end_time": g(row, "end_time"),
        "type": or_d(row, "type", json!("build")),
        "color": or_d(row, "color", json!("#6B46C1")),
        "goal_period": or_d(row, "goal_period", json!("daily")),
        "goal_value": num(finite(g(row, "goal_value")).unwrap_or(1.0)),
        "unit": or_d(row, "unit", json!("count")),
        "chart_type": or_d(row, "chart_type", json!("bar")),
        "is_archived": flag(g(row, "is_archived")),
    });
    let out = merge(out, json!({
        "show_memo": flag(g(row, "show_memo")),
        "frequency": g(row, "frequency"),
        "week_interval": or_d(row, "week_interval", json!(1)),
        "time_of_day": g(row, "time_of_day"),
        "graph_style": g(row, "graph_style"),
        // The app shows done/not done or an amount; older server rows used finer names for amounts.
        "tracking_method": if g(row, "tracking_method") == "boolean" || !truthy(g(row, "tracking_method")) { "boolean" } else { "numeric" },
        "reminder_offset": g(row, "reminder_offset"),
        "reminder_message": g(row, "reminder_message"),
        "recurrence": g(row, "recurrence"),
        "location_reminders": to_json_text(g(row, "location_reminders"), "[]"),
        "health_kit_metric": g(row, "health_kit_metric"),
        "health_kit_target": finite_v(g(row, "health_kit_target")),
        "ringtone": or_d(row, "ringtone", json!("default")),
        "goal_spec": if g(row, "goal_spec").is_null() { Value::Null } else { json!(g(row, "goal_spec").to_string()) },
        "created_at": stamp("created_at"), "updated_at": stamp("updated_at"),
        "deleted": flag(g(row, "deleted_at")),
        // Came from the server, so there is nothing to upload. owner_id/refused are desktop-only columns.
        "synced": 1, "owner_id": Value::Null, "refused": 0,
    }));
    merge(out, planning_to_local(row, &["priority", "difficulty", "flexible"]))
}

/// How the timeline plans a habit or task: urgency (habits only), difficulty 1..3 and whether its time may move.
fn planning_to_remote(row: &Value, with_priority: bool) -> Value {
    let level = |v: &Value, lo: f64, hi: f64| finite(v).filter(|n| *n >= lo && *n <= hi).map_or(Value::Null, |n| num(round(n)));
    let flexible = match g(row, "flexible") { Value::Null => Value::Null, v => json!(bool_of(v)) };
    let mut out = Map::new();
    if with_priority { out.insert("priority".into(), level(g(row, "priority"), 0.0, 4.0)); }
    out.insert("difficulty".into(), level(g(row, "difficulty"), 1.0, 3.0));
    out.insert("flexible".into(), flexible);
    Value::Object(out)
}

/// The same, coming down. Only what the server sent: one without these columns yet must not blank this device.
fn planning_to_local(row: &Value, fields: &[&str]) -> Value {
    let mut out = Map::new();
    for f in fields {
        let Some(v) = row.as_object().and_then(|o| o.get(*f)) else { continue };
        out.insert(f.to_string(), if *f == "flexible" { if v.is_null() { Value::Null } else { flag(v) } } else { finite_v(v) });
    }
    Value::Object(out)
}

// Completions

pub fn completion_to_remote(row: &Value, user_id: &str) -> Value {
    // No id: the server assigns one, and the row is matched on (user_id, habit_id, date).
    let updated = or_d(row, "updated_at", g(row, "created_at").clone());
    json!({
        "user_id": user_id, "habit_id": g(row, "habit_id"), "date": date_only(g(row, "date")),
        "value": num(finite(g(row, "value")).unwrap_or(1.0)),
        "memo": g(row, "memo"), "completed": true,
        "created_at": g(row, "created_at"), "updated_at": updated,
        "skipped": bool_of(g(row, "skipped")),
        "evidence": pick(&EVIDENCE, g(row, "evidence"), Value::Null),
        "deleted_at": deleted_at(row, &updated),
    })
}

pub fn completion_to_local(row: &Value) -> Value {
    let created = or_d(row, "created_at", json!(now()));
    json!({
        "id": g(row, "id"), "user_id": g(row, "user_id"), "habit_id": g(row, "habit_id"),
        "date": date_only(g(row, "date")),
        "value": num(finite(g(row, "value")).unwrap_or(1.0)),
        "memo": g(row, "memo"),
        "updated_at": or_d(row, "updated_at", created.clone()), "created_at": created,
        "evidence": pick(&EVIDENCE, g(row, "evidence"), Value::Null),
        "skipped": flag(g(row, "skipped")),
        // A completion the server marks as not completed is treated as removed.
        "deleted": if truthy(g(row, "deleted_at")) || g(row, "completed") == &json!(false) { 1 } else { 0 },
        "synced": 1, "owner_id": Value::Null, "refused": 0,
    })
}

// Tasks

pub fn task_to_remote(row: &Value, user_id: &str) -> Value {
    let priority = finite(g(row, "priority"));
    let minutes = finite(g(row, "estimated_minutes"));
    let title = clip(g(row, "title").as_str().unwrap_or("").trim(), 500);
    let section = g(row, "section").as_str().map(str::trim).filter(|s| !s.is_empty()).map_or(Value::Null, |s| json!(clip(s, 80)));
    let subtasks = match g(row, "subtasks") { Value::String(s) if !s.is_empty() => serde_json::from_str(s).unwrap_or(Value::Null), _ => Value::Null };
    let out = json!({
        "id": g(row, "id"), "user_id": user_id,
        "title": if title.is_empty() { "Untitled task".to_string() } else { title },
        "description": g(row, "description").as_str().map_or(Value::Null, |s| json!(clip(s, 5000))),
        "due_date": date_only(g(row, "due_date")), "due_time": valid_time(g(row, "due_time")),
        "estimated_minutes": minutes.filter(|m| *m >= 0.0).map_or(Value::Null, |m| num(round(m))),
        "priority": num(priority.filter(|p| *p >= 1.0 && *p <= 3.0).map_or(2.0, round)),
        "goal_id": uuid_or_null(g(row, "goal_id")),
        "status": pick(&TASK_STATUS, g(row, "status"), json!("open")),
        "completed_at": g(row, "completed_at"),
        "source": pick(&TASK_SOURCE, g(row, "source"), json!("app")),
        "external_id": g(row, "external_id"),
        "measure": pick(&TASK_MEASURE, g(row, "measure"), Value::Null),
        "target": finite_v(g(row, "target")),
        "unit": g(row, "unit").as_str().map_or(Value::Null, |s| json!(clip(s, 40))),
        "amount": finite_v(g(row, "amount")),
        "milestone_id": if g(row, "milestone_id").is_string() { g(row, "milestone_id").clone() } else { Value::Null },
        "subtasks": subtasks,
        "deadline": date_only(g(row, "deadline")),
        "section": section,
        "created_at": g(row, "created_at"), "updated_at": g(row, "updated_at"),
        "deleted_at": deleted_at(row, g(row, "updated_at")),
    });
    merge(out, planning_to_remote(row, false))
}

pub fn task_to_local(row: &Value) -> Value {
    let stamp = |k: &str| or_d(row, k, json!(now()));
    let has = |k: &str| row.as_object().map_or(false, |o| o.contains_key(k));
    let mut out = json!({
        "id": g(row, "id"), "user_id": g(row, "user_id"), "title": g(row, "title"),
        "description": g(row, "description"),
        "due_date": date_only(g(row, "due_date")), "due_time": g(row, "due_time"),
        "estimated_minutes": g(row, "estimated_minutes"),
        "priority": or_d(row, "priority", json!(2)),
        "goal_id": g(row, "goal_id"),
        "status": or_d(row, "status", json!("open")),
        "completed_at": g(row, "completed_at"),
        "source": or_d(row, "source", json!("app")),
        "external_id": g(row, "external_id"),
        "measure": pick(&TASK_MEASURE, g(row, "measure"), Value::Null),
        "target": finite_v(g(row, "target")),
        "unit": g(row, "unit"),
        "amount": finite_v(g(row, "amount")),
        "milestone_id": g(row, "milestone_id"),
        "created_at": stamp("created_at"), "updated_at": stamp("updated_at"),
        "deleted": flag(g(row, "deleted_at")),
        "synced": 1, "owner_id": Value::Null, "refused": 0,
    });
    let o = out.as_object_mut().unwrap();
    if has("subtasks") {
        let s = g(row, "subtasks");
        o.insert("subtasks".into(), if !truthy(s) { Value::Null } else if s.is_string() { s.clone() } else { json!(s.to_string()) });
    }
    if has("deadline") { o.insert("deadline".into(), date_only(g(row, "deadline"))); }
    if has("section") { o.insert("section".into(), g(row, "section").clone()); }
    merge(out, planning_to_local(row, &["difficulty", "flexible"]))
}

// Milestones

pub fn milestone_to_remote(row: &Value, user_id: &str) -> Value {
    let title = match g(row, "title") { Value::Null => String::new(), Value::String(s) => s.clone(), v => v.to_string() };
    json!({
        "id": g(row, "id"), "user_id": user_id, "goal_id": uuid_or_null(g(row, "goal_id")),
        "title": clip(&title, 200),
        "due_date": date_only(g(row, "due_date")), "done_at": g(row, "done_at"),
        "position": num(round(finite(g(row, "position")).unwrap_or(0.0))),
        "created_at": g(row, "created_at"), "updated_at": g(row, "updated_at"),
        "deleted_at": deleted_at(row, g(row, "updated_at")),
    })
}

pub fn milestone_to_local(row: &Value) -> Value {
    let stamp = |k: &str| or_d(row, k, json!(now()));
    json!({
        "id": g(row, "id"), "user_id": g(row, "user_id"), "goal_id": g(row, "goal_id"), "title": g(row, "title"),
        "due_date": date_only(g(row, "due_date")), "done_at": g(row, "done_at"),
        "position": or_d(row, "position", json!(0)),
        "created_at": stamp("created_at"), "updated_at": stamp("updated_at"),
        "deleted": flag(g(row, "deleted_at")),
        "synced": 1, "owner_id": Value::Null, "refused": 0,
    })
}

/// Goals before the habits that point at them (habits.goal_id is a foreign key). Rows whose id is not a UUID
/// cannot be uploaded and are returned separately as skipped, to be reported rather than fail the batch.
pub fn order_for_upload(rows: Vec<Value>) -> (Vec<Value>, Vec<Value>) {
    let (valid, skipped): (Vec<Value>, Vec<Value>) = rows.into_iter().partition(|r| is_uuid(g(r, "id")));
    let (mut upload, rest): (Vec<Value>, Vec<Value>) = valid.into_iter().partition(|r| bool_of(g(r, "is_goal")));
    upload.extend(rest);
    (upload, skipped)
}

#[cfg(test)]
mod tests {
    use super::*;

    const USER: &str = "aaaaaaaa-0000-4000-8000-000000000001";
    const HABIT: &str = "11111111-0000-4000-8000-000000000001";
    const GOAL: &str = "22222222-0000-4000-8000-000000000002";
    const RECURRENCE: &str = r#"{"kind":"monthly","every":2,"ordinal":3,"day":"sun"}"#;

    /// Every key of `want` must be present in `got` with an equal value (jest `toMatchObject`).
    fn matches(got: &Value, want: Value) {
        for (k, v) in want.as_object().unwrap() { assert_eq!(got.get(k), Some(v), "key {k} in {got}"); }
    }
    fn with(base: &Value, extra: Value) -> Value { merge(base.clone(), extra) }
    fn local_habit() -> Value {
        json!({
            "id": HABIT, "user_id": "old-local-id", "name": " Evening run ", "description": "After work",
            "category": "body", "icon": "walk-outline", "is_goal": 0, "target_date": null, "goal_id": GOAL,
            "task_days": "[\"mon\",\"wed\"]", "reminders": "[\"18:00\"]", "start_date": "2026-09-18", "end_date": null,
            "duration_minutes": 30, "start_time": "18:00", "end_time": null, "type": "build", "color": "#10B981",
            "goal_period": "daily", "goal_value": 3.6, "unit": "km", "chart_type": "bar", "is_archived": 0,
            "show_memo": 1, "frequency": "daily", "week_interval": 1, "time_of_day": "evening",
            "graph_style": "progress", "tracking_method": "numeric", "reminder_offset": 10,
            "reminder_message": "Shoes on. Ten minutes is enough.", "recurrence": RECURRENCE,
            "location_reminders": "[{\"name\":\"Gym\",\"latitude\":1,\"longitude\":2}]", "health_kit_metric": null,
            "health_kit_target": null, "ringtone": "default", "goal_spec": "{\"type\":\"volume\",\"target\":50}",
            "created_at": "2026-09-18T10:00:00.000Z", "updated_at": "2026-09-18T11:00:00.000Z", "synced": 0, "deleted": 0,
        })
    }

    // habits, phone to server

    #[test]
    fn uploads_under_the_signed_in_account_not_the_old_local_id() {
        assert_eq!(habit_to_remote(&local_habit(), USER)["user_id"], USER);
    }

    #[test]
    fn turns_0_1_into_real_booleans_and_json_text_into_structures() {
        let r = habit_to_remote(&local_habit(), USER);
        assert_eq!(r["is_goal"], false);
        assert_eq!(r["show_memo"], true);
        assert_eq!(r["task_days"], json!(["mon", "wed"]));
        assert_eq!(r["reminders"], json!(["18:00"]));
        assert_eq!(r["location_reminders"], json!([{"name": "Gym", "latitude": 1, "longitude": 2}]));
        assert_eq!(r["goal_spec"], json!({"type": "volume", "target": 50}));
    }

    #[test]
    fn keeps_a_decimal_target_which_the_old_server_rejected() {
        let r = habit_to_remote(&local_habit(), USER);
        assert_eq!(r["goal_value"], 3.6);
        assert_eq!(r["tracking_method"], "numeric");
    }

    #[test]
    fn trims_the_name_and_never_sends_it_empty() {
        assert_eq!(habit_to_remote(&local_habit(), USER)["name"], "Evening run");
        assert_eq!(habit_to_remote(&with(&local_habit(), json!({"name": "   "})), USER)["name"], "Untitled");
    }

    #[test]
    fn carries_the_rule_it_repeats_on_and_the_sentence_its_reminder_says() {
        let r = habit_to_remote(&local_habit(), USER);
        assert_eq!(r["recurrence"], RECURRENCE);
        assert_eq!(r["reminder_message"], "Shoes on. Ten minutes is enough.");
    }

    #[test]
    fn sends_null_for_a_habit_that_has_neither() {
        let mut h = local_habit();
        h.as_object_mut().unwrap().remove("recurrence");
        h.as_object_mut().unwrap().remove("reminder_message");
        let bare = habit_to_remote(&h, USER);
        assert!(bare["recurrence"].is_null());
        assert!(bare["reminder_message"].is_null());
    }

    #[test]
    fn maps_a_local_deletion_to_a_deletion_time() {
        assert!(habit_to_remote(&local_habit(), USER)["deleted_at"].is_null());
        assert_eq!(habit_to_remote(&with(&local_habit(), json!({"deleted": 1})), USER)["deleted_at"], local_habit()["updated_at"]);
    }

    #[test]
    fn deletion_without_an_update_time_falls_back_to_now() {
        let r = habit_to_remote(&json!({"id": "h", "name": "x", "deleted": 1}), USER);
        assert!(r["deleted_at"].as_str().unwrap().ends_with('Z'));
    }

    #[test]
    fn stores_deadlines_as_calendar_dates_whatever_shape_they_were_in() {
        assert_eq!(habit_to_remote(&with(&local_habit(), json!({"target_date": "2026-09-30T00:00:00.000Z"})), USER)["target_date"], "2026-09-30");
        assert_eq!(habit_to_remote(&with(&local_habit(), json!({"target_date": "2026-09-30"})), USER)["target_date"], "2026-09-30");
    }

    // habits are cleaned so one bad row cannot block a backup

    #[test]
    fn replaces_values_the_server_would_reject() {
        let r = habit_to_remote(&with(&local_habit(), json!({
            "tracking_method": "weird", "graph_style": "pie", "week_interval": 0,
            "goal_value": -3, "duration_minutes": -5, "category": "", "goal_id": "not-a-uuid",
        })), USER);
        assert_eq!(r["tracking_method"], "boolean");
        assert!(r["graph_style"].is_null());
        assert_eq!(r["week_interval"], 1);
        assert_eq!(r["goal_value"], 1);
        assert!(r["duration_minutes"].is_null());
        assert_eq!(r["category"], "personal");
        assert!(r["goal_id"].is_null());
    }

    #[test]
    fn survives_malformed_json() {
        let r = habit_to_remote(&with(&local_habit(), json!({"task_days": "[oops", "goal_spec": "{"})), USER);
        assert_eq!(r["task_days"], json!([]));
        assert!(r["goal_spec"].is_null());
    }

    #[test]
    fn reads_numbers_the_way_js_does() {
        assert_eq!(finite(&json!("3.5")), Some(3.5));
        assert_eq!(finite(&json!("")), None);
        assert_eq!(finite(&Value::Null), None);
        assert_eq!(finite(&json!("abc")), None);
        assert_eq!(finite(&json!(7)), Some(7.0));
        assert_eq!(habit_to_remote(&with(&local_habit(), json!({"goal_value": "2.5"})), USER)["goal_value"], 2.5);
    }

    // habits, server to phone

    #[test]
    fn round_trips_without_losing_anything_the_app_uses() {
        let back = habit_to_local(&with(&habit_to_remote(&local_habit(), USER), json!({"user_id": USER})));
        matches(&back, json!({
            "id": HABIT, "user_id": USER, "name": "Evening run", "goal_value": 3.6, "unit": "km",
            "tracking_method": "numeric", "is_goal": 0, "show_memo": 1, "goal_id": GOAL, "deleted": 0,
        }));
        assert_eq!(serde_json::from_str::<Value>(back["task_days"].as_str().unwrap()).unwrap(), json!(["mon", "wed"]));
        assert_eq!(serde_json::from_str::<Value>(back["goal_spec"].as_str().unwrap()).unwrap(), json!({"type": "volume", "target": 50}));
        // The rule comes back as the text the phone stores, key order and all.
        assert_eq!(back["recurrence"], RECURRENCE);
        assert_eq!(back["reminder_message"], local_habit()["reminder_message"]);
    }

    #[test]
    fn marks_what_came_from_the_server_as_already_backed_up() {
        let back = habit_to_local(&habit_to_remote(&local_habit(), USER));
        assert_eq!(back["synced"], 1);
        assert!(back["owner_id"].is_null());
        assert_eq!(back["refused"], 0);
    }

    #[test]
    fn turns_a_server_deletion_into_a_local_one() {
        assert_eq!(habit_to_local(&with(&habit_to_remote(&local_habit(), USER), json!({"deleted_at": "2026-09-18T12:00:00Z"})))["deleted"], 1);
    }

    // completions

    fn local_completion() -> Value {
        json!({
            "id": "33333333-0000-4000-8000-000000000003", "user_id": "old", "habit_id": HABIT,
            "date": "2026-09-18", "value": 3.6, "memo": null, "created_at": "2026-09-18T19:00:00.000Z",
            "updated_at": null, "synced": 0, "deleted": 0,
        })
    }

    #[test]
    fn completion_uploads_under_the_account_with_a_decimal_value() {
        let r = completion_to_remote(&local_completion(), USER);
        matches(&r, json!({"user_id": USER, "habit_id": HABIT, "date": "2026-09-18", "value": 3.6, "completed": true}));
        assert!(r.get("id").is_none());
    }

    #[test]
    fn completion_falls_back_to_the_creation_time_when_there_is_no_update_time() {
        assert_eq!(completion_to_remote(&local_completion(), USER)["updated_at"], local_completion()["created_at"]);
    }

    #[test]
    fn records_an_un_ticked_day_as_deleted() {
        assert_eq!(completion_to_remote(&with(&local_completion(), json!({"deleted": 1})), USER)["deleted_at"], local_completion()["created_at"]);
    }

    #[test]
    fn treats_a_server_row_marked_not_completed_as_removed() {
        assert_eq!(completion_to_local(&with(&completion_to_remote(&local_completion(), USER), json!({"completed": false})))["deleted"], 1);
    }

    #[test]
    fn completion_round_trips() {
        let back = completion_to_local(&completion_to_remote(&local_completion(), USER));
        matches(&back, json!({"habit_id": HABIT, "date": "2026-09-18", "value": 3.6, "deleted": 0, "synced": 1, "refused": 0}));
        assert!(back["owner_id"].is_null());
    }

    // tasks

    fn local_task() -> Value {
        json!({
            "id": "44444444-0000-4000-8000-000000000004", "user_id": "old", "title": " Buy shoes ",
            "description": null, "due_date": "2026-09-20", "due_time": "18:30", "estimated_minutes": 45,
            "priority": 1, "goal_id": GOAL, "status": "open", "completed_at": null, "source": "app",
            "external_id": "onboarding:x:checkpoint_1", "created_at": "2026-09-18T10:00:00.000Z",
            "updated_at": "2026-09-18T10:00:00.000Z", "deleted": 0, "synced": 0,
        })
    }

    #[test]
    fn task_uploads_with_the_fields_that_decide_what_matters_today() {
        matches(&task_to_remote(&local_task(), USER), json!({
            "user_id": USER, "title": "Buy shoes", "due_date": "2026-09-20", "due_time": "18:30",
            "estimated_minutes": 45, "priority": 1, "goal_id": GOAL, "external_id": "onboarding:x:checkpoint_1",
        }));
    }

    #[test]
    fn task_cleans_values_the_server_would_reject() {
        let r = task_to_remote(&with(&local_task(), json!({
            "due_time": "25:99", "priority": 9, "estimated_minutes": -1, "status": "weird", "source": "weird", "title": "  ",
        })), USER);
        matches(&r, json!({"due_time": null, "priority": 2, "estimated_minutes": null, "status": "open", "source": "app", "title": "Untitled task"}));
    }

    #[test]
    fn task_round_trips() {
        matches(&task_to_local(&task_to_remote(&local_task(), USER)), json!({"title": "Buy shoes", "due_time": "18:30", "priority": 1, "deleted": 0, "synced": 1}));
    }

    // upload order

    #[test]
    fn sends_goals_before_the_habits_that_point_at_them() {
        let (upload, _) = order_for_upload(vec![json!({"id": HABIT, "is_goal": 0}), json!({"id": GOAL, "is_goal": 1})]);
        assert_eq!(upload.iter().map(|r| r["id"].as_str().unwrap()).collect::<Vec<_>>(), vec![GOAL, HABIT]);
    }

    #[test]
    fn sets_aside_rows_whose_id_the_server_cannot_accept() {
        let (upload, skipped) = order_for_upload(vec![json!({"id": "legacy-id", "is_goal": 0}), json!({"id": HABIT, "is_goal": 0})]);
        assert_eq!(upload.iter().map(|r| r["id"].as_str().unwrap()).collect::<Vec<_>>(), vec![HABIT]);
        assert_eq!(skipped.iter().map(|r| r["id"].as_str().unwrap()).collect::<Vec<_>>(), vec!["legacy-id"]);
    }

    // helpers

    #[test]
    fn recognises_the_ids_the_app_generates() {
        assert!(is_uuid(&json!(HABIT)));
        assert!(!is_uuid(&json!("old-local-id")));
        assert!(!is_uuid(&Value::Null));
    }

    #[test]
    fn reads_a_date_from_either_shape_and_refuses_garbage() {
        assert_eq!(date_only(&json!("2026-09-18")), json!("2026-09-18"));
        assert_eq!(date_only(&json!("2026-09-18T23:00:00Z")), json!("2026-09-18"));
        assert!(date_only(&json!("nonsense")).is_null());
        assert!(date_only(&Value::Null).is_null());
    }

    #[test]
    fn parses_json_safely() {
        assert_eq!(parse_json(&json!("[\"a\"]"), json!([])), json!(["a"]));
        assert_eq!(parse_json(&json!("{bad"), json!([])), json!([]));
        assert_eq!(parse_json(&json!(["already"]), json!([])), json!(["already"]));
    }

    #[test]
    fn personal_task_fields_are_the_three_a_friends_row_never_receives() {
        assert_eq!(PERSONAL_TASK_FIELDS, ["status", "completed_at", "amount"]);
    }

    // rows written by older versions of the app

    #[test]
    fn shows_legacy_amount_tracking_habits_as_amounts() {
        let t = |m: Value| habit_to_local(&json!({"id": HABIT, "user_id": USER, "name": "x", "tracking_method": m}))["tracking_method"].clone();
        for legacy in ["quantity", "duration", "rating"] { assert_eq!(t(json!(legacy)), "numeric"); }
        assert_eq!(t(json!("boolean")), "boolean");
        assert_eq!(habit_to_local(&json!({"id": HABIT, "user_id": USER, "name": "x"}))["tracking_method"], "boolean");
    }

    #[test]
    fn habit_to_local_maps_unknown_tracking_to_numeric() {
        let t = |m: Value| habit_to_local(&json!({"id": HABIT, "user_id": USER, "name": "x", "tracking_method": m}))["tracking_method"].clone();
        assert_eq!(t(json!("duration")), "numeric");
        assert_eq!(t(Value::Null), "boolean");
    }

    // how a completion was evidenced

    fn evidenced() -> Value {
        json!({
            "id": "c1", "user_id": "old", "habit_id": HABIT, "date": "2026-09-27", "value": 1, "memo": null,
            "skipped": 0, "created_at": "2026-09-27T08:00:00.000Z", "updated_at": "2026-09-27T08:00:00.000Z",
            "synced": 0, "deleted": 0,
        })
    }

    #[test]
    fn uploads_the_stamp_the_phone_put_on_it() {
        assert_eq!(completion_to_remote(&with(&evidenced(), json!({"evidence": "verified"})), USER)["evidence"], "verified");
        assert_eq!(completion_to_remote(&with(&evidenced(), json!({"evidence": "context"})), USER)["evidence"], "context");
    }

    #[test]
    fn sends_null_for_a_row_written_before_the_column_existed() {
        assert!(completion_to_remote(&evidenced(), USER)["evidence"].is_null());
    }

    #[test]
    fn refuses_a_value_the_server_would_reject_rather_than_failing_the_batch() {
        assert!(completion_to_remote(&with(&evidenced(), json!({"evidence": "vouched"})), USER)["evidence"].is_null());
    }

    #[test]
    fn reads_one_back() {
        assert_eq!(completion_to_local(&with(&evidenced(), json!({"evidence": "context", "deleted_at": null})))["evidence"], "context");
        assert!(completion_to_local(&with(&evidenced(), json!({"evidence": "nonsense", "deleted_at": null})))["evidence"].is_null());
    }

    // what the timeline plans with is backed up

    #[test]
    fn sends_a_habits_urgency_difficulty_and_whether_its_time_may_move() {
        matches(&habit_to_remote(&json!({"id": "h", "name": "Run", "priority": 1, "difficulty": 3, "flexible": 0}), "u"),
            json!({"priority": 1, "difficulty": 3, "flexible": false}));
    }

    #[test]
    fn keeps_a_goal_todos_section_both_ways_and_never_blanks_it_when_the_server_sends_none() {
        assert_eq!(task_to_remote(&json!({"id": "t", "title": "Read", "section": "  Research "}), "u")["section"], "Research");
        assert!(task_to_remote(&json!({"id": "t", "title": "Read", "section": ""}), "u")["section"].is_null());
        assert_eq!(task_to_local(&json!({"id": "t", "title": "Read", "section": "Research"}))["section"], "Research");
        assert!(task_to_local(&json!({"id": "t", "title": "Read"})).get("section").is_none());
    }

    #[test]
    fn sends_a_tasks_deadline_difficulty_and_flexibility() {
        matches(&task_to_remote(&json!({"id": "t", "title": "Essay", "deadline": "2026-10-30", "difficulty": 2, "flexible": 1}), "u"),
            json!({"deadline": "2026-10-30", "difficulty": 2, "flexible": true}));
    }

    #[test]
    fn sends_not_said_as_null_and_nonsense_as_null() {
        matches(&habit_to_remote(&json!({"id": "h", "name": "Run", "difficulty": 9}), "u"), json!({"priority": null, "difficulty": null, "flexible": null}));
    }

    #[test]
    fn brings_them_back_down() {
        matches(&task_to_local(&json!({"id": "t", "title": "Essay", "deadline": "2026-10-30", "difficulty": 2, "flexible": false})),
            json!({"deadline": "2026-10-30", "difficulty": 2, "flexible": 0}));
        matches(&habit_to_local(&json!({"id": "h", "name": "Run", "priority": 0, "difficulty": 1, "flexible": true})),
            json!({"priority": 0, "difficulty": 1, "flexible": 1}));
    }

    #[test]
    fn never_blanks_them_when_the_server_has_no_such_columns_yet() {
        let t = task_to_local(&json!({"id": "t", "title": "Essay"}));
        assert!(["deadline", "difficulty", "flexible"].iter().all(|k| t.get(*k).is_none()));
        let h = habit_to_local(&json!({"id": "h", "name": "Run"}));
        assert!(["priority", "difficulty", "flexible"].iter().all(|k| h.get(*k).is_none()));
    }

    // milestones (no mobile tests; covered here)

    #[test]
    fn milestone_round_trips_and_cleans() {
        let r = milestone_to_remote(&json!({"id": "m", "goal_id": "nope", "title": "Ship", "position": "2", "deleted": 1, "updated_at": "t"}), USER);
        matches(&r, json!({"user_id": USER, "goal_id": null, "title": "Ship", "position": 2, "deleted_at": "t"}));
        matches(&milestone_to_local(&with(&r, json!({"deleted_at": null}))), json!({"deleted": 0, "synced": 1, "position": 2}));
    }
}
