//! Tauri commands for the account, the mirrored data and the server's RPCs. The logic is in functions over `&Connection` (tested here); the commands only fetch, lock and nudge.
//! Every write saves locally first, so it works offline, then nudges the runner.
use super::{client::CloudError, mapping::is_uuid, mirror::{self, Table}, runner::{Cloud, Nudge, SyncStatus, CLOUD_CHANGED}, sync::Db};
use crate::storage::Result as Stored;
use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use serde_json::{json, Value};
use std::sync::Arc;
use tauri::{Emitter, Manager};

type Result<T> = std::result::Result<T, String>;
const UNCONFIGURED: &str = "Sync isn't set up in this build.";
const NEEDS_SIGN_IN: &str = "Sign in to edit your habits and tasks.";
const BAD_ID: &str = "The id must be a UUID.";
const BAD_HABIT_ID: &str = "The habit id must be a UUID.";
const KEYCHAIN: &str = "Couldn't remove the saved sign-in from Keychain.";
const RPC_READS: [&str; 15] = ["my_wallet", "my_ledger", "my_streak_freezes", "community_feed", "friend_stats", "friend_today_tasks", "friend_presence", "leaderboard", "crew_consistency", "crew_king", "crew_quest", "crew_challenges_for", "my_mission", "revealed_missions", "market_feed"];
const RPC_ACTIONS: [&str; 9] = ["issue_challenge", "join_challenge", "open_market", "place_stake", "settle_market", "use_streak_freeze", "gift_streak_freeze", "create_exposed", "act_on_exposed"];

#[derive(Serialize, Debug)]
pub struct CloudData { pub habits: Vec<Value>, pub completions: Vec<Value>, pub tasks: Vec<Value>, pub day_inputs: serde_json::Map<String, Value> }
#[derive(Serialize, Debug)]
pub struct Cached<T> { pub value: T, pub fetched_at: String, pub stale: bool }

fn now() -> String { chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true) }
fn today() -> String { chrono::Local::now().format("%Y-%m-%d").to_string() }
/// The account that owns local edits. It persists offline, unlike the live session.
fn me(c: &Connection) -> Stored<String> { Ok(mirror::account(c)?.ok_or(NEEDS_SIGN_IN)?.0) }
fn editable(table: &str) -> Stored<Table> {
    match table { "habits" => Ok(Table::Habits), "tasks" => Ok(Table::Tasks), _ => Err("Unknown table".into()) }
}

pub(crate) fn data(c: &Connection, completions_since: Option<&str>) -> Stored<CloudData> {
    let live = |t: Table| -> Stored<Vec<Value>> { Ok(mirror::select(c, t, "WHERE deleted=0")?) };
    let mut completions = live(Table::Completions)?;
    if let Some(since) = completions_since { completions.retain(|r| r["date"].as_str().is_some_and(|d| d >= since)); }
    Ok(CloudData { habits: live(Table::Habits)?, completions, tasks: live(Table::Tasks)?, day_inputs: super::day_inputs::live(c)? })
}

/// Saves a habit or task; a row without an id is new. Returns the id.
pub(crate) fn save(c: &Connection, table: &str, mut row: Value, at: &str) -> Stored<String> {
    let t = editable(table)?;
    let user = me(c)?;
    let o = row.as_object_mut().ok_or("row must be an object")?;
    // The server only takes UUIDs; anything else could never upload, and would hold "Last synced" back for good.
    let id = match o.get("id").and_then(Value::as_str) { Some(i) if !i.is_empty() => if is_uuid(&json!(i)) { i.to_string() } else { return Err(BAD_ID.into()) }, _ => uuid::Uuid::new_v4().to_string() };
    o.insert("id".into(), json!(id));
    mirror::save_local(c, t, row, &user, at)?;
    Ok(id)
}

/// Sets (or, with `None`, removes) one of the day's settings, sent on the next sync.
pub(crate) fn set_day_input(c: &Connection, key: &str, value: Option<Value>, at: &str) -> Stored<()> {
    me(c)?;
    Ok(super::day_inputs::set_local(c, key, value, at)?)
}

pub(crate) fn delete(c: &Connection, table: &str, id: &str, at: &str) -> Stored<()> {
    let t = editable(table)?;
    let user = me(c)?;
    if !c.query_row(&format!("SELECT EXISTS(SELECT 1 FROM {} WHERE id=?1)", t.local()), [id], |r| r.get::<_, bool>(0))? { return Err("Not found".into()); }
    mirror::save_local(c, t, json!({"id": id, "deleted": 1}), &user, at)
}

pub(crate) fn set_completion(c: &Connection, habit_id: &str, date: &str, value: Option<f64>, skipped: bool, memo: Option<String>, evidence: Option<String>, at: &str) -> Stored<()> {
    if !is_uuid(&json!(habit_id)) { return Err(BAD_HABIT_ID.into()); }
    let user = me(c)?;
    let existing: Option<String> = c.query_row("SELECT id FROM cloud_completions WHERE habit_id=?1 AND date=?2", [habit_id, date], |r| r.get(0)).optional()?;
    match value {
        Some(v) => {
            let id = existing.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
            mirror::save_local(c, Table::Completions, json!({"id": id, "habit_id": habit_id, "date": date, "value": v, "skipped": skipped as i64, "memo": memo, "evidence": evidence, "deleted": 0}), &user, at)?;
        }
        None => if let Some(id) = existing { mirror::save_local(c, Table::Completions, json!({"id": id, "habit_id": habit_id, "date": date, "skipped": 0, "deleted": 1}), &user, at)?; },
    }
    // A skip is not done: friends see nothing, and an earlier tick that day is withdrawn.
    if mirror::is_shared(c, habit_id)? {
        match value {
            Some(_) if !skipped => mirror::outbox_push(c, "shared_done", &json!({"item_id": habit_id, "item_type": "habit", "day": date, "evidence": evidence.as_deref().unwrap_or("self")}), at)?,
            _ => mirror::outbox_push(c, "shared_undone", &json!({"item_id": habit_id, "day": date}), at)?,
        }
    }
    Ok(())
}

pub(crate) fn set_task_done(c: &Connection, id: &str, done: bool, at: &str, day: &str) -> Stored<()> {
    let user = me(c)?;
    if !c.query_row("SELECT EXISTS(SELECT 1 FROM cloud_tasks WHERE id=?1)", [id], |r| r.get::<_, bool>(0))? { return Err("Task not found".into()); }
    mirror::save_local(c, Table::Tasks, json!({"id": id, "status": if done { "done" } else { "open" }, "completed_at": if done { json!(at) } else { Value::Null }}), &user, at)?;
    if mirror::is_shared(c, id)? {
        if done { mirror::outbox_push(c, "shared_done", &json!({"item_id": id, "item_type": "task", "day": day, "evidence": null}), at)?; }
        else { mirror::outbox_push(c, "shared_undone", &json!({"item_id": id, "day": day}), at)?; }
    }
    Ok(())
}

pub(crate) fn rpc_key(name: &str, args: &Value) -> String { format!("rpc:{name}:{args}") }
pub(crate) fn read_allowed(name: &str) -> bool { name == "profile" || RPC_READS.contains(&name) }
pub(crate) fn action_allowed(name: &str) -> bool { RPC_ACTIONS.contains(&name) }

/// Fetch-then-fallback: a fresh result is cached; being offline serves the cache, marked stale.
pub(crate) fn rpc_result(c: &Connection, key: &str, fetched: std::result::Result<Value, CloudError>, at: &str) -> Stored<Cached<Value>> {
    match fetched {
        Ok(value) => { mirror::cache_put(c, key, &value, at)?; Ok(Cached { value, fetched_at: at.into(), stale: false }) }
        Err(CloudError::Offline) => match mirror::cache_get(c, key)? {
            Some((value, fetched_at)) => Ok(Cached { value, fetched_at, stale: true }),
            None => Err("Needs a connection".into()),
        },
        Err(e) => Err(e.to_string().into()),
    }
}

// Thin wrappers below.

fn cloud(app: &tauri::AppHandle) -> Result<Arc<Cloud>> { app.try_state::<Arc<Cloud>>().map(|c| c.inner().clone()).ok_or_else(|| UNCONFIGURED.to_string()) }
fn db<T>(app: &tauri::AppHandle, f: impl FnOnce(&Connection) -> Stored<T>) -> Result<T> { Db::with(app, f).map_err(|e| e.to_string()) }
/// Runs a local write, then `saved` only if it succeeded.
pub(crate) fn after_write<T>(write: impl FnOnce() -> Result<T>, saved: impl FnOnce()) -> Result<T> { let out = write()?; saved(); Ok(out) }
/// A write that is saved locally, then synced soon. Every window (the main one and the menu bar panel) is told at once, so none
/// shows the old data until the next download.
fn edit<T>(app: &tauri::AppHandle, f: impl FnOnce(&Connection) -> Stored<T>) -> Result<T> {
    let cloud = cloud(app)?;
    after_write(|| db(app, f), || { cloud.nudge(Nudge::LocalEdit); let _ = app.emit(CLOUD_CHANGED, ()); })
}
fn failed(e: CloudError) -> String { match e { CloudError::Offline => "Needs a connection".into(), e => e.to_string() } }

#[tauri::command]
pub fn cloud_status(app: tauri::AppHandle) -> SyncStatus {
    match cloud(&app) {
        Ok(c) => c.status.lock().map(|s| s.clone()).unwrap_or_else(|_| SyncStatus::without_account("error", Some("Status unavailable".into()))),
        Err(_) => SyncStatus::without_account("unconfigured", None),
    }
}

#[tauri::command]
pub async fn cloud_send_code(app: tauri::AppHandle, email: String) -> Result<()> { cloud(&app)?.auth.send_code(&email).await.map_err(failed) }

/// After a sign-in: remember the account (clearing the mirror if it changed), cache the personal backups, and sync.
/// If the account cannot be recorded, the sign-in is undone: every pass would otherwise stop at "Account mismatch".
async fn signed_in(d: &impl Db, cloud: &Cloud, session: super::auth::Session) -> Result<()> {
    let db = |f: &dyn Fn(&Connection) -> Stored<()>| d.with(f).map_err(|e| e.to_string());
    if let Err(e) = db(&|c| mirror::set_account(c, &session.user_id, session.email.as_deref())) {
        if sign_out(cloud).await.is_err() { eprintln!("[auth] could not remove the saved sign-in from Keychain"); }
        return Err(e);
    }
    cloud.set_account(true, session.email.clone());
    let query = vec![("select".to_string(), "*".to_string()), ("user_id".to_string(), format!("eq.{}", session.user_id))];
    if let Ok(rows) = cloud.client.select(&session.access_token, "personal_backups", &query).await {
        let rows = Value::Array(rows);
        let _ = db(&|c| mirror::cache_put(c, "personal_backups", &rows, &now()));
    }
    cloud.nudge(Nudge::SignedIn);
    Ok(())
}

/// Signs out of this run even if the Keychain refuses, and says so: the saved sign-in would bring the account back at the next launch.
async fn sign_out(cloud: &Cloud) -> Result<()> {
    let cleared = cloud.auth.sign_out().await;
    cloud.set_account(false, None);
    cloud.nudge(Nudge::SignedOut);
    cleared.map_err(|_| KEYCHAIN.to_string())
}

#[tauri::command]
pub async fn cloud_verify_code(app: tauri::AppHandle, email: String, code: String) -> Result<()> {
    let cloud = cloud(&app)?;
    let session = cloud.auth.verify_code(&email, &code).await.map_err(failed)?;
    signed_in(&app, &cloud, session).await
}

#[tauri::command]
pub async fn cloud_sign_in_password(app: tauri::AppHandle, email: String, password: String) -> Result<()> {
    let cloud = cloud(&app)?;
    let session = cloud.auth.sign_in_password(&email, &password).await.map_err(failed)?;
    signed_in(&app, &cloud, session).await
}

/// Apple or Google, in the browser (cloud/oauth.rs). Returns once the browser has come back,
/// with the window brought forward again.
#[tauri::command]
pub async fn cloud_sign_in_with(app: tauri::AppHandle, provider: String) -> Result<()> {
    use super::oauth;
    if !oauth::PROVIDERS.contains(&provider.as_str()) { return Err(format!("Unknown sign-in: {provider}")); }
    let cloud = cloud(&app)?;
    let (listener, redirect) = oauth::listen().await.map_err(|e| e.to_string())?;
    let verifier = oauth::verifier();
    oauth::open_browser(&oauth::authorize_url(&cloud.client.config.url, &provider, &redirect, &oauth::challenge(&verifier))).map_err(|_| "Couldn't open the browser".to_string())?;
    let code = oauth::wait_for_code(listener).await;
    if let Some(window) = tauri::Manager::get_webview_window(&app, "main") { let _ = window.show(); let _ = window.set_focus(); }
    let session = cloud.auth.exchange_code(&code?, &verifier).await.map_err(failed)?;
    signed_in(&app, &cloud, session).await
}

/// Keeps the mirror, so the same account can sign back in without downloading everything again.
#[tauri::command]
pub async fn cloud_sign_out(app: tauri::AppHandle) -> Result<()> { let cloud = cloud(&app)?; sign_out(&cloud).await }

/// Asks for a pass and returns the status as it is now; the result arrives as the `sync-status` event.
#[tauri::command]
pub fn cloud_sync_now(app: tauri::AppHandle) -> Result<SyncStatus> { cloud(&app)?.nudge(Nudge::Manual); Ok(cloud_status(app)) }

#[tauri::command]
pub fn cloud_data(app: tauri::AppHandle, completions_since: Option<String>) -> Result<CloudData> { cloud(&app)?; db(&app, |c| data(c, completions_since.as_deref())) }
#[tauri::command]
pub fn cloud_save(app: tauri::AppHandle, table: String, row: Value) -> Result<String> { edit(&app, |c| save(c, &table, row, &now())) }
#[tauri::command]
pub fn cloud_delete(app: tauri::AppHandle, table: String, id: String) -> Result<()> { edit(&app, |c| delete(c, &table, &id, &now())) }
#[tauri::command]
pub fn cloud_set_completion(app: tauri::AppHandle, habit_id: String, date: String, value: Option<f64>, skipped: bool, memo: Option<String>, evidence: Option<String>) -> Result<()> { edit(&app, |c| set_completion(c, &habit_id, &date, value, skipped, memo, evidence, &now())) }
#[tauri::command]
pub fn cloud_set_day_input(app: tauri::AppHandle, key: String, value: Option<Value>) -> Result<()> { edit(&app, |c| set_day_input(c, &key, value, &now())) }
#[tauri::command]
pub fn cloud_set_task_done(app: tauri::AppHandle, id: String, done: bool) -> Result<()> { edit(&app, |c| set_task_done(c, &id, done, &now(), &today())) }

#[tauri::command]
pub async fn cloud_rpc(app: tauri::AppHandle, name: String, args: Value) -> Result<Cached<Value>> {
    let cloud = cloud(&app)?;
    if !read_allowed(&name) { return Err("Unknown request".into()); }
    let key = rpc_key(&name, &args);
    let fetched = async {
        let token = cloud.auth.token().await?;
        if name == "profile" {
            let user = db(&app, me).map_err(|message| CloudError::Server { status: 0, code: String::new(), message })?;
            let rows = cloud.client.select(&token, "profiles", &[("select".to_string(), "*".to_string()), ("id".to_string(), format!("eq.{user}"))]).await?;
            Ok(rows.into_iter().next().unwrap_or(Value::Null))
        } else { cloud.client.rpc(&token, &name, &args).await }
    }.await;
    db(&app, |c| rpc_result(c, &key, fetched, &now()))
}

#[tauri::command]
pub async fn cloud_action(app: tauri::AppHandle, name: String, args: Value) -> Result<Value> {
    let cloud = cloud(&app)?;
    if !action_allowed(&name) { return Err("Unknown request".into()); }
    let token = cloud.auth.token().await.map_err(|e| if matches!(e, CloudError::Offline) { "This needs a connection.".to_string() } else { e.to_string() })?;
    cloud.client.rpc(&token, &name, &args).await.map_err(|e| if matches!(e, CloudError::Offline) { "This needs a connection.".to_string() } else { e.to_string() })
}

#[tauri::command]
pub async fn cloud_delete_account(app: tauri::AppHandle) -> Result<()> {
    let cloud = cloud(&app)?;
    let token = cloud.auth.token().await.map_err(|e| if matches!(e, CloudError::Offline) { "This needs a connection.".to_string() } else { e.to_string() })?;
    cloud.client.rpc(&token, "delete_my_account", &json!({})).await.map_err(|e| if matches!(e, CloudError::Offline) { "This needs a connection.".to_string() } else { e.to_string() })?;
    let cleared = db(&app, |c| mirror::clear_cloud(c));
    let signed_out = sign_out(&cloud).await;
    cleared.and(signed_out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cloud::{auth::{Auth, MemorySecret, SecretStore, Session, StuckSecret}, client::{Client, Config}};
    use crate::storage::Store;
    use std::{path::Path, sync::Mutex};

    const AT: &str = "2026-01-01T00:00:00.000Z";
    const H1: &str = "00000000-0000-4000-8000-000000000001";
    const H2: &str = "00000000-0000-4000-8000-000000000002";
    fn store() -> Store { let s = Store::open(Path::new(":memory:")).unwrap(); mirror::set_account(&s.conn, "me", Some("a@b.c")).unwrap(); s }
    fn one(c: &Connection, t: Table) -> Value { mirror::select(c, t, "").unwrap().remove(0) }

    #[test]
    fn save_assigns_uuid_and_marks_pending() {
        let s = store();
        let id = save(&s.conn, "tasks", json!({"title": "A"}), AT).unwrap();
        assert!(uuid::Uuid::parse_str(&id).is_ok());
        let r = one(&s.conn, Table::Tasks);
        assert_eq!((r["id"].as_str(), r["synced"].as_i64(), r["user_id"].as_str(), r["created_at"].as_str()), (Some(id.as_str()), Some(0), Some("me"), Some(AT)));
        assert!(save(&s.conn, "profiles", json!({}), AT).is_err());
    }

    #[test]
    fn save_needs_an_account() {
        let s = Store::open(Path::new(":memory:")).unwrap();
        assert_eq!(save(&s.conn, "tasks", json!({"title": "A"}), AT).unwrap_err().to_string(), NEEDS_SIGN_IN);
    }

    #[test]
    fn untick_sets_deleted_and_pending() {
        let s = store();
        set_completion(&s.conn, H1, "2026-01-01", Some(1.0), false, None, None, AT).unwrap();
        mirror::mark_uploaded(&s.conn, Table::Completions, &mirror::select(&s.conn, Table::Completions, "").unwrap()).unwrap();
        set_completion(&s.conn, H1, "2026-01-01", None, false, None, None, "2026-01-02T00:00:00.000Z").unwrap();
        let r = one(&s.conn, Table::Completions);
        assert_eq!((r["deleted"].as_i64(), r["synced"].as_i64()), (Some(1), Some(0)));
        assert!(data(&s.conn, None).unwrap().completions.is_empty());
    }

    #[test]
    fn tick_on_shared_habit_queues_shared_done() {
        let s = store();
        mirror::set_shared_ids(&s.conn, &[H1.to_string()]).unwrap();
        set_completion(&s.conn, H1, "2026-01-01", Some(1.0), false, None, None, AT).unwrap();
        set_completion(&s.conn, H2, "2026-01-01", Some(1.0), false, None, None, AT).unwrap();
        set_completion(&s.conn, H1, "2026-01-01", None, false, None, None, AT).unwrap();
        let q = mirror::outbox_all(&s.conn).unwrap();
        assert_eq!(q.len(), 2);
        assert_eq!((q[0].1.as_str(), &q[0].2), ("shared_done", &json!({"item_id": H1, "item_type": "habit", "day": "2026-01-01", "evidence": "self"})));
        assert_eq!((q[1].1.as_str(), &q[1].2), ("shared_undone", &json!({"item_id": H1, "day": "2026-01-01"})));
    }

    #[test]
    fn skip_on_shared_habit_withdraws_the_tick() {
        let s = store();
        mirror::set_shared_ids(&s.conn, &[H1.to_string()]).unwrap();
        set_completion(&s.conn, H1, "2026-01-01", Some(1.0), false, None, None, AT).unwrap();
        set_completion(&s.conn, H1, "2026-01-01", Some(0.0), true, None, None, AT).unwrap();
        let kinds: Vec<String> = mirror::outbox_all(&s.conn).unwrap().into_iter().map(|e| e.1).collect();
        assert_eq!(kinds, ["shared_done", "shared_undone"]);
        assert_eq!(mirror::outbox_all(&s.conn).unwrap()[1].2, json!({"item_id": H1, "day": "2026-01-01"}));
        assert_eq!(one(&s.conn, Table::Completions)["skipped"], 1);
    }

    #[test]
    fn untick_clears_skipped() {
        let s = store();
        set_completion(&s.conn, H1, "2026-01-01", Some(0.0), true, None, None, AT).unwrap();
        set_completion(&s.conn, H1, "2026-01-01", None, true, None, None, AT).unwrap();
        let r = one(&s.conn, Table::Completions);
        assert_eq!((r["deleted"].as_i64(), r["skipped"].as_i64()), (Some(1), Some(0)));
    }

    #[test]
    fn ids_must_be_uuids() {
        let s = store();
        assert_eq!(save(&s.conn, "tasks", json!({"id": "t1", "title": "A"}), AT).unwrap_err().to_string(), BAD_ID);
        assert_eq!(set_completion(&s.conn, "h1", "2026-01-01", Some(1.0), false, None, None, AT).unwrap_err().to_string(), BAD_HABIT_ID);
        assert!(mirror::select(&s.conn, Table::Tasks, "").unwrap().is_empty() && mirror::select(&s.conn, Table::Completions, "").unwrap().is_empty());
        assert!(save(&s.conn, "tasks", json!({"id": H1, "title": "A"}), AT).is_ok());
    }

    #[test]
    fn task_done_sets_status_and_queues_for_shared_tasks() {
        let s = store();
        let id = save(&s.conn, "tasks", json!({"title": "A"}), AT).unwrap();
        mirror::set_shared_ids(&s.conn, &[id.clone()]).unwrap();
        set_task_done(&s.conn, &id, true, AT, "2026-01-01").unwrap();
        let r = one(&s.conn, Table::Tasks);
        assert_eq!((r["status"].as_str(), r["completed_at"].as_str()), (Some("done"), Some(AT)));
        assert_eq!(mirror::outbox_all(&s.conn).unwrap()[0].2["item_type"], "task");
        set_task_done(&s.conn, &id, false, AT, "2026-01-01").unwrap();
        assert!(one(&s.conn, Table::Tasks)["completed_at"].is_null());
        assert!(set_task_done(&s.conn, "nope", true, AT, "2026-01-01").is_err());
    }

    #[test]
    fn delete_unknown_id_writes_nothing() {
        let s = store();
        assert_eq!(delete(&s.conn, "tasks", "nope", AT).unwrap_err().to_string(), "Not found");
        assert!(mirror::select(&s.conn, Table::Tasks, "").unwrap().is_empty());
        assert_eq!(mirror::counts(&s.conn).unwrap(), (0, 0));
    }

    #[test]
    fn friend_owned_habit_is_read_only() {
        let s = store();
        s.conn.execute("INSERT INTO cloud_habits(id,user_id,name,owner_id,synced) VALUES(?1,'friend','F','friend',1)", [H1]).unwrap();
        assert!(delete(&s.conn, "habits", H1, AT).is_err());
        assert_eq!(save(&s.conn, "habits", json!({"id": H1, "name": "X"}), AT).unwrap_err().to_string(), "This belongs to a friend and is read-only");
        let r = one(&s.conn, Table::Habits);
        assert_eq!((r["name"].as_str(), r["deleted"].as_i64(), r["synced"].as_i64()), (Some("F"), Some(0), Some(1)));
    }

    struct TestDb(Mutex<Store>);
    impl Db for TestDb { fn with<T>(&self, f: impl FnOnce(&Connection) -> Stored<T>) -> Stored<T> { f(&self.0.lock().unwrap().conn) } }
    fn offline_cloud(secret: Arc<dyn SecretStore>) -> Arc<Cloud> {
        let client = Arc::new(Client::new(Config { url: "http://127.0.0.1:9".into(), key: "k".into() }));
        Cloud::new(client.clone(), Arc::new(Auth::new(client, secret))).0
    }
    fn session() -> Session { Session { access_token: "at".into(), user_id: "u2".into(), email: None, expires_at: chrono::Utc::now().timestamp() + 3600 } }

    #[tokio::test]
    async fn unrecorded_sign_in_is_undone() {
        let secret = Arc::new(MemorySecret::default());
        secret.set("rt").unwrap();
        let cloud = offline_cloud(secret.clone());
        cloud.auth.set_session(session()).await;
        let d = TestDb(Mutex::new(Store::open(Path::new(":memory:")).unwrap()));
        d.with(|c| Ok(c.execute_batch("CREATE TRIGGER no_account BEFORE INSERT ON cloud_account BEGIN SELECT RAISE(ABORT,'disk full'); END;")?)).unwrap();
        assert!(signed_in(&d, &cloud, session()).await.unwrap_err().contains("disk full"));
        assert!(cloud.auth.user_id().await.is_none() && secret.get().is_none());
    }

    #[tokio::test]
    async fn recorded_sign_in_keeps_the_session() {
        let cloud = offline_cloud(Arc::new(MemorySecret::default()));
        cloud.auth.set_session(session()).await;
        let d = TestDb(Mutex::new(Store::open(Path::new(":memory:")).unwrap()));
        signed_in(&d, &cloud, session()).await.unwrap();
        assert_eq!((d.with(mirror::account).unwrap().map(|a| a.0), cloud.auth.user_id().await), (Some("u2".into()), Some("u2".into())));
        assert!(cloud.status.lock().unwrap().account);
    }

    #[tokio::test]
    async fn sign_out_reports_a_keychain_failure() {
        let cloud = offline_cloud(Arc::new(StuckSecret));
        cloud.auth.set_session(session()).await;
        cloud.set_account(true, None);
        assert_eq!(sign_out(&cloud).await.unwrap_err(), KEYCHAIN);
        assert!(cloud.auth.user_id().await.is_none());
        assert!(!cloud.status.lock().unwrap().account);
        assert!(sign_out(&offline_cloud(Arc::new(MemorySecret::default()))).await.is_ok());
    }

    #[test]
    fn a_write_announces_itself_only_when_it_succeeds() {
        let s = store();
        let mut told = 0;
        assert!(after_write(|| save(&s.conn, "tasks", json!({"title": "A"}), AT).map_err(|e| e.to_string()), || told += 1).is_ok());
        assert_eq!(told, 1);
        assert!(after_write(|| save(&s.conn, "tasks", json!({"id": "bad"}), AT).map_err(|e| e.to_string()), || told += 1).is_err());
        assert_eq!(told, 1);
    }

    /// Every local write command goes through `edit`, which emits `cloud-changed` after the write.
    #[test]
    fn every_write_command_emits_cloud_changed() {
        let src = include_str!("commands.rs");
        let edit = &src[src.find("fn edit<T>").unwrap()..];
        assert!(edit[..edit.find("\n}").unwrap()].contains("app.emit(CLOUD_CHANGED"));
        for cmd in ["cloud_save", "cloud_delete", "cloud_set_completion", "cloud_set_task_done"] {
            let body = &src[src.find(&format!("pub fn {cmd}(")).unwrap()..];
            assert!(body[..body.find('\n').unwrap()].contains("edit(&app,"), "{cmd} must write through edit()");
        }
    }

    #[test]
    fn rpc_name_outside_allowlist_is_rejected() {
        assert!(read_allowed("my_wallet") && read_allowed("profile") && !read_allowed("delete_my_account") && !read_allowed("place_stake"));
        assert!(action_allowed("place_stake") && !action_allowed("my_wallet") && !action_allowed("delete_my_account"));
    }

    #[test]
    fn offline_rpc_returns_stale_cache() {
        let s = store();
        let key = rpc_key("my_wallet", &json!({}));
        assert_eq!(rpc_result(&s.conn, &key, Err(CloudError::Offline), AT).unwrap_err().to_string(), "Needs a connection");
        let fresh = rpc_result(&s.conn, &key, Ok(json!({"coins": 3})), AT).unwrap();
        assert!(!fresh.stale);
        let stale = rpc_result(&s.conn, &key, Err(CloudError::Offline), "2026-02-02T00:00:00.000Z").unwrap();
        assert_eq!((stale.value, stale.fetched_at.as_str(), stale.stale), (json!({"coins": 3}), AT, true));
        assert!(rpc_result(&s.conn, &key, Err(CloudError::Unauthorized), AT).is_err());
    }

    #[test]
    fn cloud_data_excludes_deleted() {
        let s = store();
        let keep = save(&s.conn, "tasks", json!({"title": "keep"}), AT).unwrap();
        let gone = save(&s.conn, "tasks", json!({"title": "gone"}), AT).unwrap();
        delete(&s.conn, "tasks", &gone, AT).unwrap();
        set_completion(&s.conn, H1, "2026-01-01", Some(1.0), false, None, None, AT).unwrap();
        set_completion(&s.conn, H1, "2026-01-05", Some(1.0), false, None, None, AT).unwrap();
        let d = data(&s.conn, Some("2026-01-03")).unwrap();
        assert_eq!(d.tasks.len(), 1);
        assert_eq!(d.tasks[0]["id"], keep.as_str());
        assert_eq!(d.completions.len(), 1);
        assert_eq!(data(&s.conn, None).unwrap().completions.len(), 2);
    }

    #[test]
    fn day_settings_are_in_cloud_data_and_keys_are_checked() {
        let s = store();
        set_day_input(&s.conn, "meals", Some(json!({"lunch": {"on": true}})), AT).unwrap();
        set_day_input(&s.conn, "travel:school", Some(json!({"before": 30, "after": 30})), AT).unwrap();
        set_day_input(&s.conn, "travel:school", None, AT).unwrap();
        let d = data(&s.conn, None).unwrap();
        assert_eq!(d.day_inputs.get("meals"), Some(&json!({"lunch": {"on": true}})));
        assert!(!d.day_inputs.contains_key("travel:school"));
        assert!(set_day_input(&s.conn, "Meals!", Some(json!(1)), AT).is_err());
    }
}
