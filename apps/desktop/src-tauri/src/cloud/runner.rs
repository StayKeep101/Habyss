//! Decides when sync runs. Nudges (edits, Realtime, focus, the user) and timers feed a `Plan`; one pass runs at a time.
//! The timing is pure (`Plan`, `next_due`, `focus_allowed`) so it is tested without a clock; `run` is the thin tokio loop around it.
use super::{auth::Auth, client::Client, mirror, realtime, sync::{run_sync, Db, SyncReport}};
use crate::storage::Result;
use rusqlite::{Connection, OptionalExtension};
use serde::Serialize;
use std::{sync::{Arc, Mutex}, time::Duration};
use tauri::{Emitter, Manager};
use tokio::sync::{mpsc::{unbounded_channel, UnboundedReceiver, UnboundedSender}, Notify};

const EDIT_DEBOUNCE_MS: i64 = 2_500;
const REMOTE_DEBOUNCE_MS: i64 = 1_000;
const FOCUS_THROTTLE_MS: i64 = 60_000;
const PERIODIC_MS: i64 = 300_000;
const OFFLINE_RETRY_MS: i64 = 30_000;
/// Longest sleep when nothing is scheduled; waking early is harmless.
const IDLE_MS: i64 = 3_600_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Nudge { LocalEdit, Remote, Focus, Manual, SignedIn, SignedOut }

#[derive(Serialize, Clone, Debug)]
pub struct SyncStatus { pub state: String, pub email: Option<String>, pub last_sync: Option<String>, pub pending: i64, pub refused: i64, pub error: Option<String> }

pub struct Cloud { pub client: Arc<Client>, pub auth: Arc<Auth>, nudge: UnboundedSender<Nudge>, pub status: Arc<Mutex<SyncStatus>> }
impl Cloud {
    pub fn new(client: Arc<Client>, auth: Arc<Auth>) -> (Arc<Cloud>, UnboundedReceiver<Nudge>) {
        let (tx, rx) = unbounded_channel();
        let status = SyncStatus { state: "signed_out".into(), email: None, last_sync: None, pending: 0, refused: 0, error: None };
        (Arc::new(Cloud { client, auth, nudge: tx, status: Arc::new(Mutex::new(status)) }), rx)
    }
    pub fn nudge(&self, n: Nudge) { let _ = self.nudge.send(n); }
}

/// The app's database, locked only for the length of `f`.
impl Db for tauri::AppHandle {
    fn with<T>(&self, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        let state = self.state::<crate::commands::Shared>();
        let service = state.lock().map_err(|_| "tracking service lock failed")?;
        f(&service.store.conn)
    }
}

/// When the debounced pass for the latest local edit runs: `Some(time)` while it is still ahead of `now`, `None` once it is due.
pub(crate) fn next_due(last_edit_ms: i64, now: i64) -> Option<i64> { let due = last_edit_ms + EDIT_DEBOUNCE_MS; (due > now).then_some(due) }
/// A focus nudge runs a pass at most once a minute.
pub(crate) fn focus_allowed(last_focus_ms: Option<i64>, now: i64) -> bool { last_focus_ms.is_none_or(|t| now - t >= FOCUS_THROTTLE_MS) }

/// What is waiting to run. A pass covers everything asked before it started; anything asked during it schedules one more.
#[derive(Default, Debug)]
pub(crate) struct Plan { immediate: bool, edit: Option<i64>, remote: Option<i64>, periodic: Option<i64>, last_focus: Option<i64> }
impl Plan {
    pub(crate) fn on(&mut self, n: Nudge, now: i64) {
        match n {
            Nudge::LocalEdit => self.edit = Some(now),
            Nudge::Remote => self.remote = Some(now),
            Nudge::Focus => if focus_allowed(self.last_focus, now) { self.last_focus = Some(now); self.immediate = true },
            Nudge::Manual | Nudge::SignedIn | Nudge::SignedOut => self.immediate = true,
        }
    }
    /// Milliseconds until the next pass: `Some(0)` means now, `None` means nothing is scheduled.
    pub(crate) fn wait(&self, now: i64) -> Option<i64> {
        let due = [
            self.immediate.then_some(now),
            self.edit.map(|t| next_due(t, now).unwrap_or(now)),
            self.remote.map(|t| (t + REMOTE_DEBOUNCE_MS).max(now)),
            self.periodic.map(|t| t.max(now)),
        ];
        due.into_iter().flatten().min().map(|t| t - now)
    }
    /// The launch pass: it also counts as the focus pass, since the window usually gains focus as the app opens.
    pub(crate) fn launch(&mut self, now: i64) { self.immediate = true; self.last_focus = Some(now); }
    pub(crate) fn start(&mut self) { (self.immediate, self.edit, self.remote, self.periodic) = (false, None, None, None); }
    /// After a pass: every 5 min while signed in, every 30 s while offline (a success is how a regained network shows), never while signed out.
    pub(crate) fn finish(&mut self, state: &str, now: i64) {
        self.periodic = match state { "offline" => Some(now + OFFLINE_RETRY_MS), "signed_out" => None, _ => Some(now + PERIODIC_MS) };
    }
}

/// Offline is checked before the session: a launch without network has no session yet but still holds a refresh token, and must keep retrying.
fn state_after(error: Option<&str>, signed_in: bool) -> &'static str {
    match error {
        Some(e) if e.starts_with("No connection") => "offline",
        _ if !signed_in => "signed_out",
        Some(_) => "error",
        None => "idle",
    }
}

fn read_status(c: &Connection, state: &str, error: Option<String>) -> Result<SyncStatus> {
    let (pending, refused) = mirror::counts(c)?;
    let (email, last_sync) = c.query_row("SELECT email,last_sync FROM cloud_account WHERE id=1", [], |r| Ok((r.get(0)?, r.get(1)?))).optional()?.unwrap_or((None, None));
    Ok(SyncStatus { state: state.into(), email, last_sync, pending, refused, error })
}

/// One sync pass, then the status it leaves, which is also stored on `cloud`.
pub(crate) async fn pass(db: &impl Db, cloud: &Cloud) -> (SyncStatus, SyncReport) {
    let report = run_sync(db, &cloud.client, &cloud.auth).await;
    let state = state_after(report.error.as_deref(), cloud.auth.user_id().await.is_some());
    let error = matches!(state, "offline" | "error").then(|| report.error.clone()).flatten();
    let status = db.with(|c| read_status(c, state, error.clone())).unwrap_or_else(|e| {
        eprintln!("[sync] could not read the sync status: {e}");
        SyncStatus { state: state.into(), email: None, last_sync: None, pending: 0, refused: 0, error }
    });
    if let Ok(mut s) = cloud.status.lock() { *s = status.clone(); }
    (status, report)
}

fn now_ms() -> i64 { chrono::Utc::now().timestamp_millis() }
fn publish(app: &tauri::AppHandle, status: &SyncStatus) { let _ = app.emit("sync-status", status); }
fn mark_syncing(app: &tauri::AppHandle, cloud: &Cloud) {
    let status = match cloud.status.lock() { Ok(mut s) => { s.state = "syncing".into(); s.clone() } Err(_) => return };
    publish(app, &status);
}

/// Restores the session, keeps Realtime following it, and runs passes as the `Plan` says, for the life of the app.
pub async fn run(app: tauri::AppHandle, cloud: Arc<Cloud>, mut rx: UnboundedReceiver<Nudge>) {
    if let Err(e) = cloud.auth.restore().await { eprintln!("[sync] session not restored: {}", match e { super::client::CloudError::Unauthorized => "rejected", _ => "server error" }); }
    let wake = Arc::new(Notify::new());
    let remote = cloud.nudge.clone();
    tauri::async_runtime::spawn(realtime::follow(cloud.client.config.clone(), cloud.auth.clone(), wake.clone(), move || { let _ = remote.send(Nudge::Remote); }));
    let mut plan = Plan::default();
    plan.launch(now_ms());
    let mut open = true;
    let take = |plan: &mut Plan, n: Nudge| {
        if matches!(n, Nudge::SignedIn | Nudge::SignedOut) { wake.notify_one(); }
        plan.on(n, now_ms());
    };
    loop {
        match plan.wait(now_ms()) {
            Some(0) => {
                plan.start();
                mark_syncing(&app, &cloud);
                let running = pass(&app, &cloud);
                tokio::pin!(running);
                let (status, report) = loop {
                    tokio::select! {
                        done = &mut running => break done,
                        n = rx.recv(), if open => match n { Some(n) => take(&mut plan, n), None => open = false },
                    }
                };
                plan.finish(&status.state, now_ms());
                publish(&app, &status);
                if report.downloaded > 0 { let _ = app.emit("cloud-changed", ()); }
            }
            wait => {
                if !open { return; }
                let sleep = tokio::time::sleep(Duration::from_millis(wait.unwrap_or(IDLE_MS).max(0) as u64));
                tokio::select! {
                    n = rx.recv() => match n { Some(n) => take(&mut plan, n), None => open = false },
                    _ = sleep => {}
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cloud::{auth::{MemorySecret, Session}, client::Config};
    use crate::storage::Store;
    use std::path::Path;

    struct TestDb(Mutex<Store>);
    impl Db for TestDb { fn with<T>(&self, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T> { f(&self.0.lock().unwrap().conn) } }
    const ME: &str = "11111111-1111-4111-8111-111111111111";

    /// Steps a clock 100 ms at a time; returns when passes started.
    fn simulate(plan: &mut Plan, until: i64, mut at: impl FnMut(&mut Plan, i64)) -> Vec<i64> {
        let mut passes = vec![];
        for t in (0..=until).step_by(100) {
            at(plan, t);
            if plan.wait(t) == Some(0) { passes.push(t); plan.start(); plan.finish("idle", t); }
        }
        passes
    }

    #[test] fn debounce_coalesces_edits() {
        assert_eq!(next_due(400, 400), Some(2900));
        assert_eq!(next_due(400, 2899), Some(2900));
        assert_eq!(next_due(400, 2900), None);
        let passes = simulate(&mut Plan::default(), 6_000, |p, t| if t <= 400 { p.on(Nudge::LocalEdit, t) });
        assert_eq!(passes, [2900]);
    }
    #[test] fn remote_is_debounced_and_manual_is_immediate() {
        assert_eq!(simulate(&mut Plan::default(), 3_000, |p, t| if t == 0 || t == 500 { p.on(Nudge::Remote, t) }), [1500]);
        assert_eq!(simulate(&mut Plan::default(), 3_000, |p, t| if t == 200 { p.on(Nudge::Manual, t) }), [200]);
    }
    #[test] fn focus_is_throttled_to_once_a_minute() {
        let passes = simulate(&mut Plan::default(), 130_000, |p, t| if t % 10_000 == 0 { p.on(Nudge::Focus, t) });
        // 300 000 ms periodic passes never fall inside this window, so these are all focus passes.
        assert_eq!(passes, [0, 60_000, 120_000]);
    }
    #[test] fn launch_pass_counts_as_the_focus_pass() {
        let mut p = Plan::default();
        p.launch(0);
        let passes = simulate(&mut p, 70_000, |p, t| if t == 500 || t == 60_000 { p.on(Nudge::Focus, t) });
        assert_eq!(passes, [0, 60_000]);
    }
    #[test] fn nudges_during_a_pass_schedule_exactly_one_more() {
        let mut p = Plan::default();
        p.on(Nudge::Manual, 0);
        assert_eq!(p.wait(0), Some(0));
        p.start();
        for n in [Nudge::Manual, Nudge::Manual, Nudge::SignedIn] { p.on(n, 50); }
        p.finish("idle", 100);
        assert_eq!(p.wait(100), Some(0));
        p.start();
        p.finish("idle", 200);
        assert_eq!(p.wait(200), Some(PERIODIC_MS));
    }
    #[test] fn offline_retries_every_30s_and_signed_out_waits() {
        let mut p = Plan::default();
        p.finish("offline", 0);
        assert_eq!(p.wait(0), Some(30_000));
        p.finish("signed_out", 0);
        assert_eq!(p.wait(0), None);
    }
    #[test] fn state_mapping() {
        assert_eq!(state_after(None, true), "idle");
        assert_eq!(state_after(Some("No connection. x"), false), "offline");
        assert_eq!(state_after(Some("Your session expired. x"), false), "signed_out");
        assert_eq!(state_after(Some("Account mismatch; sign in again."), true), "error");
    }
    #[tokio::test] async fn offline_status_after_unreachable_sync() {
        let url = "http://127.0.0.1:9".to_string();
        let client = Arc::new(Client::new(Config { url, key: "k".into() }));
        let auth = Arc::new(Auth::new(client.clone(), Arc::new(MemorySecret::default())));
        auth.set_session(Session { access_token: "at".into(), user_id: ME.into(), email: None, expires_at: chrono::Utc::now().timestamp() + 3600 }).await;
        let store = Store::open(Path::new(":memory:")).unwrap();
        mirror::set_account(&store.conn, ME, Some("me@example.com")).unwrap();
        let (cloud, _rx) = Cloud::new(client, auth);
        let (status, report) = pass(&TestDb(Mutex::new(store)), &cloud).await;
        assert!(report.error.as_deref().unwrap().starts_with("No connection"));
        assert_eq!(status.state, "offline");
        assert_eq!(status.email.as_deref(), Some("me@example.com"));
        assert_eq!(cloud.status.lock().unwrap().state, "offline");
    }
}
