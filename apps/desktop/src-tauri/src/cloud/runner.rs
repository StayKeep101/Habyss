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

/// `state` describes the latest pass and changes during one ("syncing"); `account` is the durable answer to "signed in?": an account is
/// recorded on this Mac and a session or a saved sign-in is present. The app reads sign-in from `account`, never from `state`.
#[derive(Serialize, Clone, Debug)]
pub struct SyncStatus { pub state: String, pub account: bool, pub email: Option<String>, pub last_sync: Option<String>, pub pending: i64, pub refused: i64, pub error: Option<String> }
impl SyncStatus { pub fn without_account(state: &str, error: Option<String>) -> SyncStatus { SyncStatus { state: state.into(), account: false, email: None, last_sync: None, pending: 0, refused: 0, error } } }
pub const CLOUD_CHANGED: &str = "cloud-changed";

pub struct Cloud { pub client: Arc<Client>, pub auth: Arc<Auth>, nudge: UnboundedSender<Nudge>, pub status: Arc<Mutex<SyncStatus>> }
impl Cloud {
    pub fn new(client: Arc<Client>, auth: Arc<Auth>) -> (Arc<Cloud>, UnboundedReceiver<Nudge>) {
        let (tx, rx) = unbounded_channel();
        (Arc::new(Cloud { client, auth, nudge: tx, status: Arc::new(Mutex::new(SyncStatus::without_account("signed_out", None))) }), rx)
    }
    pub fn nudge(&self, n: Nudge) { let _ = self.nudge.send(n); }
    /// The status before the first pass: still "signed_out" (Plan 1), but `account` already comes from the database and the Keychain,
    /// so a signed-in user is not shown the sign-in prompt while the launch pass runs.
    pub fn launch(&self, c: &Connection) {
        let status = read_status(c, "signed_out", None, self.auth.has_saved_token()).unwrap_or_else(|e| { eprintln!("[sync] could not read the account: {e}"); SyncStatus::without_account("signed_out", None) });
        if let Ok(mut s) = self.status.lock() { *s = status; }
    }
    pub(crate) fn set_account(&self, account: bool, email: Option<String>) { if let Ok(mut s) = self.status.lock() { s.account = account; if account { s.email = email; } } }
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
    /// After a pass: every 5 min while signed in, every 30 s while offline (a success is how a regained network shows) or while a
    /// server error keeps the saved sign-in from being restored, never while signed out.
    pub(crate) fn finish(&mut self, state: &str, restoring: bool, now: i64) {
        self.periodic = match state { "offline" => Some(now + OFFLINE_RETRY_MS), _ if restoring => Some(now + OFFLINE_RETRY_MS), "signed_out" => None, _ => Some(now + PERIODIC_MS) };
    }
}

/// Offline is checked before the session: a launch without network has no session yet but still holds a refresh token, and must keep retrying.
/// Likewise a server error (5xx, 429) while the Keychain still holds a refresh token is an `error`, not `signed_out`: see `restoring`.
fn state_after(error: Option<&str>, signed_in: bool, saved: bool) -> &'static str {
    match error {
        Some(e) if e.starts_with("No connection") => "offline",
        Some(_) if signed_in || saved => "error",
        _ if !signed_in => "signed_out",
        _ => "idle",
    }
}
/// Not signed in, yet not signed out either: the session could not be restored for a reason other than the server rejecting it.
fn restoring(state: &str, signed_in: bool) -> bool { state == "error" && !signed_in }

/// `credentials`: a live session or a saved refresh token. With a recorded account, that is "signed in".
fn read_status(c: &Connection, state: &str, error: Option<String>, credentials: bool) -> Result<SyncStatus> {
    let (pending, refused) = mirror::counts(c)?;
    let row = c.query_row("SELECT email,last_sync FROM cloud_account WHERE id=1", [], |r| Ok((r.get(0)?, r.get(1)?))).optional()?;
    let account = credentials && row.is_some();
    let (email, last_sync) = row.unwrap_or((None, None));
    Ok(SyncStatus { state: state.into(), account, email, last_sync, pending, refused, error })
}

/// One sync pass, then the status it leaves, which is also stored on `cloud`, and whether a saved sign-in is waiting to be restored.
pub(crate) async fn pass(db: &impl Db, cloud: &Cloud) -> (SyncStatus, SyncReport, bool) {
    let report = run_sync(db, &cloud.client, &cloud.auth).await;
    let signed_in = cloud.auth.user_id().await.is_some();
    let credentials = signed_in || cloud.auth.has_saved_token();
    let state = state_after(report.error.as_deref(), signed_in, !signed_in && credentials);
    let error = matches!(state, "offline" | "error").then(|| report.error.clone()).flatten();
    let status = db.with(|c| read_status(c, state, error.clone(), credentials)).unwrap_or_else(|e| {
        eprintln!("[sync] could not read the sync status: {e}");
        SyncStatus { account: credentials, ..SyncStatus::without_account(state, error) }
    });
    if let Ok(mut s) = cloud.status.lock() { *s = status.clone(); }
    let waiting = restoring(state, signed_in);
    (status, report, waiting)
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
                // A sign-in, sign-out or account deletion abandons the pass: it belongs to the old account. Dropping it is safe because
                // every database step is synchronous inside `Db::with`, so the pass can only stop between steps (`Run::mine` also
                // refuses its writes if it got that far). The nudge has already asked for the next pass.
                let finished = loop {
                    tokio::select! {
                        done = &mut running => break Some(done),
                        n = rx.recv(), if open => match n {
                            Some(n) => { take(&mut plan, n); if matches!(n, Nudge::SignedIn | Nudge::SignedOut) { break None; } }
                            None => open = false,
                        },
                    }
                };
                let Some((status, report, waiting)) = finished else { eprintln!("[sync] account changed; pass abandoned"); continue };
                plan.finish(&status.state, waiting, now_ms());
                publish(&app, &status);
                if report.downloaded > 0 { let _ = app.emit(CLOUD_CHANGED, ()); }
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
    use crate::cloud::{auth::{MemorySecret, SecretStore, Session}, client::Config};
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
            if plan.wait(t) == Some(0) { passes.push(t); plan.start(); plan.finish("idle", false, t); }
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
        p.finish("idle", false, 100);
        assert_eq!(p.wait(100), Some(0));
        p.start();
        p.finish("idle", false, 200);
        assert_eq!(p.wait(200), Some(PERIODIC_MS));
    }
    #[test] fn offline_retries_every_30s_and_signed_out_waits() {
        let mut p = Plan::default();
        p.finish("offline", false, 0);
        assert_eq!(p.wait(0), Some(30_000));
        p.finish("signed_out", false, 0);
        assert_eq!(p.wait(0), None);
        p.finish("error", true, 0);
        assert_eq!(p.wait(0), Some(30_000));
        p.finish("error", false, 0);
        assert_eq!(p.wait(0), Some(PERIODIC_MS));
    }
    #[test] fn state_mapping() {
        assert_eq!(state_after(None, true, false), "idle");
        assert_eq!(state_after(Some("No connection. x"), false, true), "offline");
        assert_eq!(state_after(Some("Your session expired. x"), false, false), "signed_out");
        assert_eq!(state_after(Some("Account mismatch; sign in again."), true, false), "error");
        // A server error at launch, with the refresh token still in the Keychain.
        assert_eq!(state_after(Some("Sync did not finish. x"), false, true), "error");
        assert_eq!(state_after(None, false, false), "signed_out");
        assert!(restoring("error", false) && !restoring("error", true) && !restoring("signed_out", false));
    }
    #[tokio::test] async fn server_error_with_a_saved_sign_in_retries_soon() {
        let mut s = mockito::Server::new_async().await;
        s.mock("POST", "/auth/v1/token?grant_type=refresh_token").with_status(503).with_body("{}").expect_at_least(1).create_async().await;
        let client = Arc::new(Client::new(Config { url: s.url(), key: "k".into() }));
        let secret = Arc::new(MemorySecret::default());
        secret.set("rt1").unwrap();
        let (cloud, _rx) = Cloud::new(client.clone(), Arc::new(Auth::new(client, secret)));
        let store = Store::open(Path::new(":memory:")).unwrap();
        mirror::set_account(&store.conn, ME, None).unwrap();
        let (status, _, waiting) = pass(&TestDb(Mutex::new(store)), &cloud).await;
        assert_eq!((status.state.as_str(), waiting), ("error", true));
        // Not signed in this run, but the saved sign-in still counts: no sign-in prompt while it is restored.
        assert!(status.account);
        let mut p = Plan::default();
        p.finish(&status.state, waiting, 0);
        assert_eq!(p.wait(0), Some(OFFLINE_RETRY_MS));
    }
    #[tokio::test] async fn offline_status_after_unreachable_sync() {
        let url = "http://127.0.0.1:9".to_string();
        let client = Arc::new(Client::new(Config { url, key: "k".into() }));
        let auth = Arc::new(Auth::new(client.clone(), Arc::new(MemorySecret::default())));
        auth.set_session(Session { access_token: "at".into(), user_id: ME.into(), email: None, expires_at: chrono::Utc::now().timestamp() + 3600 }).await;
        let store = Store::open(Path::new(":memory:")).unwrap();
        mirror::set_account(&store.conn, ME, Some("me@example.com")).unwrap();
        let (cloud, _rx) = Cloud::new(client, auth);
        let (status, report, _) = pass(&TestDb(Mutex::new(store)), &cloud).await;
        assert!(report.error.as_deref().unwrap().starts_with("No connection"));
        assert_eq!(status.state, "offline");
        assert_eq!(status.email.as_deref(), Some("me@example.com"));
        assert!(status.account);
        assert_eq!(cloud.status.lock().unwrap().state, "offline");
    }
    fn plain_cloud(secret: Arc<MemorySecret>) -> Arc<Cloud> {
        let client = Arc::new(Client::new(Config { url: "http://127.0.0.1:9".into(), key: "k".into() }));
        Cloud::new(client.clone(), Arc::new(Auth::new(client, secret))).0
    }
    #[test] fn launch_status_reads_the_durable_account() {
        let store = Store::open(Path::new(":memory:")).unwrap();
        let secret = Arc::new(MemorySecret::default());
        // Nothing recorded, nothing saved.
        let cloud = plain_cloud(secret.clone());
        cloud.launch(&store.conn);
        let s = cloud.status.lock().unwrap().clone();
        assert_eq!((s.state.as_str(), s.account), ("signed_out", false));
        // A recorded account and a saved sign-in: signed in before the first pass, although the state still says signed_out.
        mirror::set_account(&store.conn, ME, Some("me@example.com")).unwrap();
        secret.set("rt").unwrap();
        cloud.launch(&store.conn);
        let s = cloud.status.lock().unwrap().clone();
        assert_eq!((s.state.as_str(), s.account, s.email.as_deref()), ("signed_out", true, Some("me@example.com")));
        // Signed out earlier: the mirror keeps the account row, but no sign-in is saved.
        secret.clear().unwrap();
        cloud.launch(&store.conn);
        assert!(!cloud.status.lock().unwrap().account);
    }
    #[tokio::test] async fn a_pass_without_any_sign_in_has_no_account() {
        let store = Store::open(Path::new(":memory:")).unwrap();
        mirror::set_account(&store.conn, ME, Some("me@example.com")).unwrap();
        let cloud = plain_cloud(Arc::new(MemorySecret::default()));
        let (status, _, _) = pass(&TestDb(Mutex::new(store)), &cloud).await;
        assert_eq!((status.state.as_str(), status.account), ("signed_out", false));
    }
}
