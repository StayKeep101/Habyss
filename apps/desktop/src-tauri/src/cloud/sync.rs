//! Two-way sync of the local mirror with Supabase. Port of mobile `runSync` (lib/cloudSync.ts) minus `requeue` and `syncPersonal`.
//! Order: outbox, upload, download, shared items, then the result on `cloud_account`. The DB is never held across an `.await`.
use super::{auth::Auth, client::{pull_query, Client, CloudError}, mapping::*, mirror::{self, Table}};
use crate::storage::Result;
use chrono::SecondsFormat;
use rusqlite::{params, Connection};
use serde::Serialize;
use serde_json::{json, Value};
use std::{collections::HashSet, future::Future, sync::{Mutex, OnceLock}};

#[derive(Serialize, Default, Debug)]
pub struct SyncReport { pub ok: bool, pub uploaded: usize, pub downloaded: usize, pub failed: usize, pub refused: usize, pub waiting: Vec<String>, pub error: Option<String> }

/// Short access to the database. Implementations lock, call `f`, and release.
pub trait Db: Send + Sync { fn with<T>(&self, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T>; }

const BATCH: usize = 200;
const PAGE: usize = 1000;
const OFFLINE: &str = "No connection. Your changes are saved on this Mac and will sync when you're online.";
const EXPIRED: &str = "Your session expired. Sign in again to keep syncing.";
const MISMATCH: &str = "Account mismatch; sign in again.";
const UNFINISHED: &str = "Sync did not finish. Your changes are saved on this Mac.";

/// Columns a server turned out not to have, as "url|table|column". Not sent again for the life of the process.
fn absent() -> &'static Mutex<HashSet<String>> { static S: OnceLock<Mutex<HashSet<String>>> = OnceLock::new(); S.get_or_init(Default::default) }

/// Why a run stopped early. It becomes the report's error.
enum Stop { Cloud(CloudError), Local(Box<dyn std::error::Error + Send + Sync>), Mismatch }
impl From<CloudError> for Stop { fn from(e: CloudError) -> Stop { Stop::Cloud(e) } }
impl From<Box<dyn std::error::Error + Send + Sync>> for Stop { fn from(e: Box<dyn std::error::Error + Send + Sync>) -> Stop { Stop::Local(e) } }
impl Stop {
    fn message(&self) -> &'static str {
        match self { Stop::Cloud(CloudError::Offline) => OFFLINE, Stop::Cloud(CloudError::Unauthorized) => EXPIRED, Stop::Mismatch => MISMATCH, _ => UNFINISHED }
    }
    fn log(&self) -> String { match self { Stop::Cloud(e) => kind(e), Stop::Local(e) => format!("local: {e}"), Stop::Mismatch => "account mismatch".into() } }
}
/// Nothing else can succeed until the network or the session is back.
fn fatal(e: &CloudError) -> bool { matches!(e, CloudError::Offline | CloudError::Unauthorized) }
/// For logs: never the server's message, which can echo row contents.
fn kind(e: &CloudError) -> String { match e { CloudError::Server { status, code, .. } => format!("server {status} {code}"), CloudError::Forbidden { .. } => "forbidden".into(), e => e.to_string() } }
fn id(row: &Value) -> &str { row["id"].as_str().unwrap_or("?") }
fn query(pairs: &[(&str, &str)]) -> Vec<(String, String)> { pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect() }
fn strip(rows: &mut [Value], column: &str) { for r in rows { if let Some(o) = r.as_object_mut() { o.remove(column); } } }

/// `shared`: a friend's task, sent without what each person keeps for themselves.
fn to_remote(t: Table, row: &Value, me: &str, shared: bool) -> Value {
    let mut v = match t { Table::Habits => habit_to_remote(row, me), Table::Completions => completion_to_remote(row, me), Table::Tasks => task_to_remote(row, me), Table::Milestones => milestone_to_remote(row, me) };
    if shared { for k in PERSONAL_TASK_FIELDS { strip(std::slice::from_mut(&mut v), k); } }
    v
}
fn to_local(t: Table, row: &Value) -> Value {
    match t { Table::Habits => habit_to_local(row), Table::Completions => completion_to_local(row), Table::Tasks => task_to_local(row), Table::Milestones => milestone_to_local(row) }
}

pub async fn run_sync(db: &impl Db, client: &Client, auth: &Auth) -> SyncReport {
    let mut run = Run { db, client, auth, token: String::new(), me: String::new(), report: SyncReport::default() };
    if let Err(stop) = run.sync().await {
        eprintln!("[sync] stopped: {}", stop.log());
        run.report.error = Some(stop.message().into());
    }
    let mut report = run.report;
    report.ok = report.error.is_none() && report.failed == 0;
    let last_sync = report.ok.then(|| chrono::Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true));
    let recorded = db.with(|c| Ok(c.execute("UPDATE cloud_account SET last_sync=COALESCE(?1,last_sync),last_error=?2 WHERE id=1", params![last_sync, report.error])?));
    if let Err(e) = recorded { eprintln!("[sync] could not record the result: {e}"); }
    report
}

struct Run<'a, D: Db> { db: &'a D, client: &'a Client, auth: &'a Auth, token: String, me: String, report: SyncReport }

impl<D: Db> Run<'_, D> {
    async fn sync(&mut self) -> std::result::Result<(), Stop> {
        self.token = self.auth.token().await?;
        // One account per database: never upload one account's rows under another.
        let (session, account) = (self.auth.user_id().await, self.db.with(mirror::account)?.map(|(u, _)| u));
        match (session, account) { (Some(s), Some(a)) if s == a => self.me = s, _ => return Err(Stop::Mismatch) }
        self.flush_outbox().await?;
        for t in Table::ALL { self.upload(t).await?; }
        for t in Table::ALL { self.download(t).await?; }
        match self.pull_shared().await { Ok(n) => self.report.downloaded += n, Err(e) => eprintln!("[sync] shared items did not refresh: {}", e.log()) }
        Ok(())
    }

    /// One request, sent again once with a refreshed token if the server rejects the current one.
    async fn call<T, F, Fut>(&mut self, f: F) -> std::result::Result<T, CloudError> where F: Fn(String) -> Fut, Fut: Future<Output = std::result::Result<T, CloudError>> {
        match f(self.token.clone()).await {
            Err(CloudError::Unauthorized) => { self.auth.expire().await; self.token = self.auth.token().await?; f(self.token.clone()).await }
            r => r,
        }
    }

    /// Shared completions recorded while offline. An entry is removed once the server has it, or once access rules refuse it.
    /// After an entry fails, later entries for the same item and day wait for the next run, so they never replay out of order.
    async fn flush_outbox(&mut self) -> std::result::Result<(), Stop> {
        let c = self.client;
        let mut blocked = HashSet::new();
        for (n, kind_name, p) in self.db.with(mirror::outbox_all)? {
            let me = self.me.clone();
            let text = |k: &str| p[k].as_str().unwrap_or("").to_string();
            let key = (text("item_id"), text("day"));
            if blocked.contains(&key) { continue; }
            let sent = match kind_name.as_str() {
                "shared_done" => {
                    let rows = [json!({"user_id": me, "item_id": p["item_id"], "item_type": p["item_type"], "day": p["day"], "evidence": p["evidence"]})];
                    let rows = &rows[..];
                    self.call(move |tok| async move { c.upsert(&tok, "shared_completions", "user_id,item_id,day", rows).await }).await
                }
                "shared_undone" => {
                    let q = query(&[("user_id", &format!("eq.{me}")), ("item_id", &format!("eq.{}", text("item_id"))), ("day", &format!("eq.{}", text("day")))]);
                    let q = &q;
                    self.call(move |tok| async move { c.delete(&tok, "shared_completions", q).await }).await
                }
                _ => { eprintln!("[sync] outbox {n}: unknown kind"); continue; }
            };
            match sent {
                Ok(()) => self.db.with(|c| mirror::outbox_done(c, n))?,
                Err(e) if fatal(&e) => return Err(e.into()),
                // A share that was withdrawn will be refused every time.
                Err(CloudError::Forbidden { .. }) => {
                    self.db.with(|c| mirror::outbox_done(c, n))?;
                    self.report.refused += 1;
                    eprintln!("[sync] outbox {n} ({kind_name}) refused by the server; dropped");
                }
                Err(e) => {
                    self.report.failed += 1;
                    blocked.insert(key);
                    eprintln!("[sync] outbox {n} ({kind_name}) not sent: {}", kind(&e));
                }
            }
        }
        Ok(())
    }

    /// Port of `upload`.
    async fn upload(&mut self, t: Table) -> std::result::Result<(), Stop> {
        let rows = self.db.with(|c| mirror::unsynced(c, t))?;
        if rows.is_empty() { return Ok(()); }
        // A completion's own id never goes up; only its habit has to be a real id.
        let (usable, skipped) = if t == Table::Completions { rows.into_iter().partition(|r| is_uuid(&r["habit_id"])) } else { order_for_upload(rows) };
        self.report.failed += skipped.len();
        // A friend's row is theirs on the server. Their goals, habits and milestones are read-only here;
        // a shared task's plan goes up without your done-state, in batches of its own.
        let me = self.me.clone();
        let (theirs, mine): (Vec<Value>, Vec<Value>) = usable.into_iter().partition(|r| r["owner_id"].as_str().is_some_and(|o| o != me));
        let mut batches: Vec<(&[Value], bool)> = mine.chunks(BATCH).map(|b| (b, false)).collect();
        if t == Table::Tasks { batches.extend(theirs.chunks(BATCH).map(|b| (b, true))); }
        for (batch, shared) in batches { if !self.push(t, batch, shared).await? { break; } }
        Ok(())
    }

    /// Uploads one batch. If it fails, retries row by row so only the bad row is reported. False when the table is missing.
    async fn push(&mut self, t: Table, batch: &[Value], shared: bool) -> std::result::Result<bool, Stop> {
        let me = self.me.clone();
        match self.upsert_tolerant(t, batch.iter().map(|r| to_remote(t, r, &me, shared)).collect()).await {
            Ok(()) => { self.db.with(|c| mirror::mark_uploaded(c, t, batch))?; self.report.uploaded += batch.len(); return Ok(true); }
            Err(CloudError::MissingTable) => {
                eprintln!("[sync] this server has no {} table yet; keeping those changes on this Mac", t.remote());
                self.report.waiting.push(t.remote().into());
                return Ok(false);
            }
            Err(e) if fatal(&e) => return Err(e.into()),
            Err(_) => {}
        }
        for row in batch {
            match self.upsert_tolerant(t, vec![to_remote(t, row, &me, shared)]).await {
                Ok(()) => { self.db.with(|c| mirror::mark_uploaded(c, t, std::slice::from_ref(row)))?; self.report.uploaded += 1; }
                Err(e) if fatal(&e) => return Err(e.into()),
                // Access rules will refuse it every time: stop retrying, and show it in sync health.
                Err(CloudError::Forbidden { .. }) => {
                    self.db.with(|c| mirror::mark_refused(c, t, id(row)))?;
                    self.report.refused += 1;
                    eprintln!("[sync] {} {} refused by the server", t.remote(), id(row));
                }
                Err(e) => { self.report.failed += 1; eprintln!("[sync] {} {} failed: {}", t.remote(), id(row), kind(&e)); }
            }
        }
        Ok(true)
    }

    /// Port of `upsertTolerant`: a column the server lacks is dropped and the rows sent again without it.
    async fn upsert_tolerant(&mut self, t: Table, mut rows: Vec<Value>) -> std::result::Result<(), CloudError> {
        let prefix = format!("{}|{}|", self.client.config.url, t.remote());
        let known: Vec<String> = absent().lock().unwrap().iter().filter_map(|k| k.strip_prefix(&prefix).map(String::from)).collect();
        for column in &known { strip(&mut rows, column); }
        let c = self.client;
        for _ in 0..8 {
            let sent = { let rows = &rows[..]; self.call(move |tok| async move { c.upsert(&tok, t.remote(), t.on_conflict(), rows).await }).await };
            match sent {
                Err(CloudError::MissingColumn(column)) if rows.first().and_then(Value::as_object).is_some_and(|o| o.contains_key(&column)) => {
                    eprintln!("[sync] {}.{column} is missing on the server; uploading without it", t.remote());
                    absent().lock().unwrap().insert(format!("{prefix}{column}"));
                    strip(&mut rows, &column);
                }
                sent => return sent,
            }
        }
        Err(CloudError::Server { status: 0, code: "too_many_missing_columns".into(), message: String::new() })
    }

    /// Port of `download`: keyset pages from the table's own cursor. A row that cannot be written holds the cursor back.
    async fn download(&mut self, t: Table) -> std::result::Result<(), Stop> {
        if self.report.waiting.iter().any(|w| w == t.remote()) { return Ok(()); }
        let since = self.db.with(|c| mirror::cursor(c, t))?;
        let (mut newest, mut after, mut held) = (since.clone(), None::<(String, String)>, false);
        let c = self.client;
        loop {
            let q = pull_query(&self.me, since.as_deref(), after.as_ref().map(|(u, i)| (u.as_str(), i.as_str())), PAGE);
            let page = { let q = &q[..]; self.call(move |tok| async move { c.select(&tok, t.remote(), q).await }).await };
            let rows = match page {
                Ok(rows) => rows,
                Err(CloudError::MissingTable) => { self.report.waiting.push(t.remote().into()); return Ok(()); }
                Err(e) => return Err(e.into()),
            };
            if rows.is_empty() { break; }
            let (written, failed) = self.db.with(|c| {
                let tx = c.unchecked_transaction()?;
                let (mut w, mut f) = (0, 0);
                for r in &rows {
                    match mirror::write_local(&tx, t, &to_local(t, r), &[]) { Ok(n) => w += n, Err(_) => { f += 1; eprintln!("[sync] could not write {} {}", t.remote(), id(r)); } }
                }
                tx.commit()?;
                Ok((w, f))
            })?;
            (self.report.downloaded, self.report.failed, held) = (self.report.downloaded + written, self.report.failed + failed, held || failed > 0);
            for u in rows.iter().filter_map(|r| r["updated_at"].as_str()) { if newest.as_deref().is_none_or(|n| u > n) { newest = Some(u.into()); } }
            if rows.len() < PAGE { break; }
            let last = &rows[rows.len() - 1];
            match (last["updated_at"].as_str(), last["id"].as_str()) { (Some(u), Some(i)) => after = Some((u.into(), i.into())), _ => break }
        }
        if let Some(n) = newest.as_deref().filter(|n| !held && Some(*n) != since.as_deref()) { self.db.with(|c| mirror::set_cursor(c, t, n))?; }
        Ok(())
    }

    /// Accepted, live share ids of one kind where you are the owner or the friend.
    async fn shared(&mut self, table: &'static str, column: &str) -> std::result::Result<Vec<String>, CloudError> {
        let mine = format!("(owner_id.eq.{0},shared_with_id.eq.{0})", self.me);
        let q = query(&[("select", column), ("status", "eq.accepted"), ("deleted_at", "is.null"), ("or", &mine)]);
        let c = self.client;
        let rows = { let q = &q[..]; self.call(move |tok| async move { c.select(&tok, table, q).await }).await? };
        let mut ids: Vec<String> = rows.iter().filter_map(|r| r[column].as_str()).map(String::from).collect();
        ids.sort();
        ids.dedup();
        Ok(ids)
    }
    /// A friend's rows of `t` matching any of `filters`.
    async fn theirs(&mut self, t: Table, filters: &[String]) -> std::result::Result<Vec<Value>, CloudError> {
        if filters.is_empty() || self.report.waiting.iter().any(|w| w == t.remote()) { return Ok(vec![]); }
        let q = query(&[("select", "*"), ("user_id", &format!("neq.{}", self.me)), ("or", &format!("({})", filters.join(",")))]);
        let c = self.client;
        let q = &q[..];
        self.call(move |tok| async move { c.select(&tok, t.remote(), q).await }).await
    }

    /// Port of `pullShared` plus `refreshSharedIds`: what friends share is kept as your copy, marked with its owner.
    async fn pull_shared(&mut self) -> std::result::Result<usize, Stop> {
        let goals = self.shared("shared_goals", "goal_id").await?;
        let (habits, tasks) = (self.shared("shared_habits", "habit_id").await?, self.shared("shared_tasks", "task_id").await?);
        let ids: Vec<String> = habits.iter().chain(&tasks).cloned().collect();
        self.db.with(|c| mirror::set_shared_ids(c, &ids))?;
        let list = |v: &[String]| { let v: Vec<&str> = v.iter().map(String::as_str).filter(|i| is_uuid(&json!(i))).collect(); (!v.is_empty()).then(|| format!("({})", v.join(","))) };
        let (g, h, k) = (list(&goals), list(&habits), list(&tasks));
        let habit_filters: Vec<String> = [g.as_ref().map(|g| format!("id.in.{g}")), g.as_ref().map(|g| format!("goal_id.in.{g}")), h.map(|h| format!("id.in.{h}"))].into_iter().flatten().collect();
        let task_filters: Vec<String> = [g.map(|g| format!("goal_id.in.{g}")), k.map(|k| format!("id.in.{k}"))].into_iter().flatten().collect();
        let habit_rows = self.theirs(Table::Habits, &habit_filters).await?;
        let task_rows = self.theirs(Table::Tasks, &task_filters).await?;
        let me = self.me.clone();
        Ok(self.db.with(|c| {
            let tx = c.unchecked_transaction()?;
            let mut n = 0;
            for (t, rows) in [(Table::Habits, &habit_rows), (Table::Tasks, &task_rows)] {
                for r in rows {
                    let mut local = to_local(t, r);
                    (local["user_id"], local["owner_id"]) = (json!(me), r["user_id"].clone());
                    // A shared task's done-state is each person's own: a new copy starts open, an existing one keeps yours.
                    let keep: &[&str] = if t == Table::Tasks { for k in PERSONAL_TASK_FIELDS { local[k] = Value::Null; } local["status"] = json!("open"); &PERSONAL_TASK_FIELDS } else { &[] };
                    match mirror::write_local(&tx, t, &local, keep) { Ok(w) => n += w, Err(_) => eprintln!("[sync] could not refresh shared {} {}", t.remote(), id(r)) }
                }
            }
            tx.commit()?;
            Ok(n)
        })?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cloud::{auth::{MemorySecret, SecretStore, Session}, client::Config, mirror::{self, Table}};
    use crate::storage::Store;
    use mockito::{Matcher, Server};
    use serde_json::{json, Value};
    use std::{path::Path, sync::{Arc, Mutex}};

    struct TestDb(Mutex<Store>);
    impl Db for TestDb { fn with<T>(&self, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T> { f(&self.0.lock().unwrap().conn) } }

    const ME: &str = "11111111-1111-4111-8111-111111111111";
    const FRIEND: &str = "22222222-2222-4222-8222-222222222222";
    const NOW: &str = "2026-01-01T00:00:00.000Z";
    fn uid(n: u32) -> String { format!("00000000-0000-4000-8000-{n:012}") }
    fn db_for(account: &str) -> TestDb {
        let s = Store::open(Path::new(":memory:")).unwrap();
        mirror::set_account(&s.conn, account, None).unwrap();
        TestDb(Mutex::new(s))
    }
    fn db() -> TestDb { db_for(ME) }
    async fn signed_in(url: String) -> (Client, Auth) {
        let secret = Arc::new(MemorySecret::default());
        let auth = Auth::new(Arc::new(Client::new(Config { url: url.clone(), key: "k".into() })), secret);
        auth.set_session(Session { access_token: "at".into(), user_id: ME.into(), email: None, expires_at: chrono::Utc::now().timestamp() + 3600 }).await;
        (Client::new(Config { url, key: "k".into() }), auth)
    }
    fn save(d: &TestDb, t: Table, row: Value) { d.with(|c| mirror::save_local(c, t, row, ME, NOW)).unwrap() }
    fn row(d: &TestDb, t: Table, id: &str) -> Value {
        d.with(|c| Ok(c.query_row(&format!("SELECT synced,refused,owner_id FROM {} WHERE id=?1", t.local()), [id], |r| Ok(json!({"synced": r.get::<_, i64>(0)?, "refused": r.get::<_, i64>(1)?, "owner_id": r.get::<_, Option<String>>(2)?})))?)).unwrap()
    }
    /// Every GET not matched by a more specific mock answers an empty page. Create it after the specific mocks.
    async fn empty_reads(s: &mut Server) { s.mock("GET", Matcher::Any).with_body("[]").expect_at_least(0).create_async().await; }
    /// Records each request body sent to `path`, answering `status`.
    async fn capture(s: &mut Server, method: &str, path: &str, status: usize, hits: usize) -> Arc<Mutex<Vec<Value>>> {
        let seen = Arc::new(Mutex::new(vec![]));
        let keep = seen.clone();
        s.mock(method, Matcher::Regex(format!("^{path}"))).with_status(status)
            .with_body_from_request(move |r| { keep.lock().unwrap().push(serde_json::from_slice(r.body().unwrap()).unwrap_or(Value::Null)); vec![] }).expect(hits).create_async().await;
        seen
    }

    #[tokio::test] async fn goals_upload_before_habits() {
        let mut s = Server::new_async().await;
        let bodies = capture(&mut s, "POST", "/rest/v1/habits", 201, 1).await;
        empty_reads(&mut s).await;
        let d = db();
        save(&d, Table::Habits, json!({"id": uid(1), "name": "Run", "is_goal": 0}));
        save(&d, Table::Habits, json!({"id": uid(2), "name": "Marathon", "is_goal": 1}));
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        assert_eq!((r.uploaded, r.failed, r.error.as_deref()), (2, 0, None));
        let first = bodies.lock().unwrap()[0][0].clone();
        assert_eq!((first["is_goal"].clone(), first["id"].clone()), (json!(true), json!(uid(2))));
    }

    #[tokio::test] async fn completion_upload_omits_id_and_uses_composite_conflict() {
        let mut s = Server::new_async().await;
        let m = s.mock("POST", "/rest/v1/habit_completions").match_query(Matcher::UrlEncoded("on_conflict".into(), "user_id,habit_id,date".into()))
            .match_request(|r| { let v: Value = serde_json::from_slice(r.body().unwrap()).unwrap(); v[0].get("id").is_none() && v[0]["habit_id"] == json!(uid(1)) })
            .with_status(201).expect(1).create_async().await;
        empty_reads(&mut s).await;
        let d = db();
        save(&d, Table::Completions, json!({"id": "c1", "habit_id": uid(1), "date": "2026-01-01"}));
        save(&d, Table::Completions, json!({"id": "c2", "habit_id": "local-only", "date": "2026-01-01"}));
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        m.assert_async().await;
        assert_eq!((r.uploaded, r.failed), (1, 1));
        assert_eq!(row(&d, Table::Completions, "c1")["synced"], 1);
    }

    #[tokio::test] async fn bad_row_is_retried_alone() {
        let mut s = Server::new_async().await;
        let bad = r#"{"code":"23514","message":"violates check constraint"}"#;
        s.mock("POST", "/rest/v1/tasks").match_query(Matcher::Any).with_status(400).with_body(bad).expect(1).create_async().await;
        s.mock("POST", "/rest/v1/tasks").match_query(Matcher::Any).with_status(201).expect(1).create_async().await;
        s.mock("POST", "/rest/v1/tasks").match_query(Matcher::Any).with_status(400).with_body(bad).expect(1).create_async().await;
        empty_reads(&mut s).await;
        let d = db();
        save(&d, Table::Tasks, json!({"id": uid(1), "title": "good"}));
        save(&d, Table::Tasks, json!({"id": uid(2), "title": "bad"}));
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        assert_eq!((r.uploaded, r.failed, r.refused, r.ok), (1, 1, 0, false));
        assert_eq!(row(&d, Table::Tasks, &uid(1))["synced"], 1);
        assert_eq!(row(&d, Table::Tasks, &uid(2))["synced"], 0);
    }

    #[tokio::test] async fn rls_refusal_marks_row_refused_and_stops_retrying() {
        let mut s = Server::new_async().await;
        s.mock("POST", "/rest/v1/tasks").match_query(Matcher::Any).with_status(403).with_body(r#"{"code":"42501","message":"new row violates row-level security policy"}"#).expect(2).create_async().await;
        empty_reads(&mut s).await;
        let d = db();
        save(&d, Table::Tasks, json!({"id": uid(1), "title": "x"}));
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        assert_eq!((r.uploaded, r.failed, r.refused), (0, 0, 1));
        assert_eq!(row(&d, Table::Tasks, &uid(1))["refused"], 1);
        assert!(d.with(|c| mirror::unsynced(c, Table::Tasks)).unwrap().is_empty());
    }

    #[tokio::test] async fn missing_column_is_dropped_and_rest_uploads() {
        let mut s = Server::new_async().await;
        s.mock("POST", "/rest/v1/tasks").match_query(Matcher::Any).with_status(400).with_body(r#"{"code":"PGRST204","message":"Could not find the 'section' column of 'tasks' in the schema cache"}"#).expect(1).create_async().await;
        let bodies = capture(&mut s, "POST", "/rest/v1/tasks", 201, 1).await;
        empty_reads(&mut s).await;
        let d = db();
        save(&d, Table::Tasks, json!({"id": uid(1), "title": "x", "section": "Work"}));
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        assert_eq!((r.uploaded, r.failed), (1, 0));
        let sent = bodies.lock().unwrap()[0][0].clone();
        assert!(sent.get("section").is_none() && sent["title"] == "x");
    }

    #[tokio::test] async fn shared_task_upload_excludes_personal_fields() {
        let mut s = Server::new_async().await;
        let bodies = capture(&mut s, "POST", "/rest/v1/tasks", 201, 2).await;
        empty_reads(&mut s).await;
        let d = db();
        let mut theirs = task_to_local(&json!({"id": uid(2), "title": "Ours", "updated_at": NOW}));
        theirs["owner_id"] = json!(FRIEND);
        d.with(|c| mirror::write_local(c, Table::Tasks, &theirs, &[])).unwrap();
        save(&d, Table::Tasks, json!({"id": uid(2), "title": "Ours, renamed", "status": "done", "amount": 3}));
        save(&d, Table::Tasks, json!({"id": uid(1), "title": "Mine", "status": "done"}));
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        assert_eq!((r.uploaded, r.failed), (2, 0));
        let b = bodies.lock().unwrap().clone();
        assert_eq!((b[0].as_array().unwrap().len(), b[0][0]["id"].clone(), b[0][0]["status"].clone()), (1, json!(uid(1)), json!("done")));
        assert_eq!((b[1].as_array().unwrap().len(), b[1][0]["title"].clone()), (1, json!("Ours, renamed")));
        for k in PERSONAL_TASK_FIELDS { assert!(b[1][0].get(k).is_none(), "{k} was sent"); }
    }

    #[tokio::test] async fn friend_goal_is_never_uploaded() {
        let mut s = Server::new_async().await;
        let m = s.mock("POST", Matcher::Any).expect(0).create_async().await;
        empty_reads(&mut s).await;
        let d = db();
        let mut goal = habit_to_local(&json!({"id": uid(1), "name": "Their goal", "is_goal": true, "updated_at": NOW}));
        goal["owner_id"] = json!(FRIEND);
        d.with(|c| { mirror::write_local(c, Table::Habits, &goal, &[])?; c.execute("UPDATE cloud_habits SET synced=0", [])?; Ok(()) }).unwrap();
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        m.assert_async().await;
        assert_eq!((r.uploaded, r.failed, r.error.as_deref()), (0, 0, None));
    }

    fn remote_task(i: u32) -> Value { json!({"id": uid(i), "user_id": ME, "title": format!("t{i}"), "updated_at": format!("2026-01-01T{:02}:{:02}:{:02}.000Z", i / 3600, i / 60 % 60, i % 60)}) }

    #[tokio::test] async fn download_pages_and_advances_cursor() {
        let mut s = Server::new_async().await;
        let page1: Vec<Value> = (1..=1000).map(remote_task).collect();
        let page2: Vec<Value> = (1001..=1003).map(remote_task).collect();
        let first = s.mock("GET", "/rest/v1/tasks").match_query(Matcher::Any).match_request(|r| !r.path_and_query().contains("or=")).with_body(Value::from(page1).to_string()).expect(1).create_async().await;
        let second = s.mock("GET", "/rest/v1/tasks").match_query(Matcher::Any).match_request(|r| r.path_and_query().contains("or=")).with_body(Value::from(page2).to_string()).expect(1).create_async().await;
        empty_reads(&mut s).await;
        let d = db();
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        first.assert_async().await;
        second.assert_async().await;
        assert_eq!((r.downloaded, r.failed, r.error.as_deref(), r.ok), (1003, 0, None, true));
        assert_eq!(d.with(|c| mirror::cursor(c, Table::Tasks)).unwrap(), remote_task(1003)["updated_at"].as_str().map(String::from));
        assert_eq!(row(&d, Table::Tasks, &uid(1003))["synced"], 1);
        assert!(d.with(|c| Ok(c.query_row("SELECT last_sync FROM cloud_account", [], |r| r.get::<_, Option<String>>(0))?)).unwrap().is_some());
    }

    #[tokio::test] async fn failed_local_write_holds_cursor() {
        let mut s = Server::new_async().await;
        s.mock("GET", "/rest/v1/tasks").match_query(Matcher::Any).with_body(json!([remote_task(1), remote_task(2)]).to_string()).expect(1).create_async().await;
        empty_reads(&mut s).await;
        let d = db();
        d.with(|c| Ok(c.execute_batch(&format!("CREATE TRIGGER no_bad BEFORE INSERT ON cloud_tasks WHEN NEW.id='{}' BEGIN SELECT RAISE(ABORT,'refused'); END;", uid(2)))?)).unwrap();
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        assert_eq!((r.downloaded, r.failed, r.ok), (1, 1, false));
        assert_eq!(row(&d, Table::Tasks, &uid(1))["synced"], 1);
        assert_eq!(d.with(|c| mirror::cursor(c, Table::Tasks)).unwrap(), None);
    }

    #[tokio::test] async fn offline_keeps_cursor_and_local_edits() {
        let d = db();
        d.with(|c| mirror::set_cursor(c, Table::Tasks, "2026-01-01T00:00:00Z")).unwrap();
        save(&d, Table::Tasks, json!({"id": uid(1), "title": "x"}));
        let (c, a) = signed_in("http://127.0.0.1:9".into()).await;
        let r = run_sync(&d, &c, &a).await;
        assert!(r.error.as_deref().unwrap_or("").contains("No connection"), "{:?}", r.error);
        assert!(!r.ok);
        assert_eq!(d.with(|c| mirror::cursor(c, Table::Tasks)).unwrap().as_deref(), Some("2026-01-01T00:00:00Z"));
        assert_eq!(d.with(mirror::counts).unwrap(), (1, 0));
    }

    #[tokio::test] async fn outbox_shared_done_is_sent_then_removed() {
        let mut s = Server::new_async().await;
        let m = s.mock("POST", "/rest/v1/shared_completions").match_query(Matcher::UrlEncoded("on_conflict".into(), "user_id,item_id,day".into()))
            .match_body(Matcher::Json(json!([{"user_id": ME, "item_id": uid(1), "item_type": "habit", "day": "2026-01-01", "evidence": null}])))
            .with_status(201).expect(1).create_async().await;
        let undo = s.mock("DELETE", "/rest/v1/shared_completions").match_query(Matcher::AllOf(vec![
            Matcher::UrlEncoded("user_id".into(), format!("eq.{ME}")), Matcher::UrlEncoded("item_id".into(), format!("eq.{}", uid(2))), Matcher::UrlEncoded("day".into(), "eq.2026-01-02".into())]))
            .with_status(204).expect(1).create_async().await;
        empty_reads(&mut s).await;
        let d = db();
        d.with(|c| { mirror::outbox_push(c, "shared_done", &json!({"item_id": uid(1), "item_type": "habit", "day": "2026-01-01", "evidence": null}), NOW)?;
            mirror::outbox_push(c, "shared_undone", &json!({"item_id": uid(2), "day": "2026-01-02"}), NOW) }).unwrap();
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        m.assert_async().await;
        undo.assert_async().await;
        assert_eq!(r.error, None);
        assert!(d.with(mirror::outbox_all).unwrap().is_empty());
    }

    fn queue(d: &TestDb, entries: &[(&str, u32, &str)]) {
        d.with(|c| { for (k, i, day) in entries { mirror::outbox_push(c, k, &json!({"item_id": uid(*i), "item_type": "habit", "day": day, "evidence": null}), NOW)?; } Ok(()) }).unwrap();
    }
    fn queued(d: &TestDb) -> Vec<(String, String)> { d.with(mirror::outbox_all).unwrap().into_iter().map(|(_, k, p)| (k, p["item_id"].as_str().unwrap().to_string())).collect() }

    #[tokio::test] async fn failed_outbox_entry_holds_later_entries_for_the_same_key() {
        let mut s = Server::new_async().await;
        s.mock("POST", "/rest/v1/shared_completions").match_query(Matcher::Any).with_status(500).with_body("{}").expect(1).create_async().await;
        let undo = s.mock("DELETE", "/rest/v1/shared_completions").match_query(Matcher::Any).with_status(204).expect(0).create_async().await;
        empty_reads(&mut s).await;
        let d = db();
        queue(&d, &[("shared_done", 1, "2026-01-01"), ("shared_undone", 1, "2026-01-01")]);
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        undo.assert_async().await;
        assert!(r.failed >= 1 && !r.ok);
        assert_eq!(queued(&d), vec![("shared_done".into(), uid(1)), ("shared_undone".into(), uid(1))]);
    }

    #[tokio::test] async fn refused_outbox_entry_is_dropped() {
        let mut s = Server::new_async().await;
        s.mock("POST", "/rest/v1/shared_completions").match_query(Matcher::Any).with_status(403).with_body(r#"{"code":"42501","message":"rls"}"#).expect(1).create_async().await;
        empty_reads(&mut s).await;
        let d = db();
        queue(&d, &[("shared_done", 1, "2026-01-01")]);
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        assert_eq!((r.refused, r.failed), (1, 0));
        assert!(queued(&d).is_empty());
    }

    #[tokio::test] async fn offline_during_outbox_keeps_the_rest() {
        let d = db();
        queue(&d, &[("shared_done", 1, "2026-01-01"), ("shared_done", 2, "2026-01-01")]);
        let (c, a) = signed_in("http://127.0.0.1:9".into()).await;
        let r = run_sync(&d, &c, &a).await;
        assert!(r.error.as_deref().unwrap_or("").contains("No connection"));
        assert_eq!(queued(&d).len(), 2);
    }

    #[tokio::test] async fn unauthorized_during_download_keeps_cursor() {
        let mut s = Server::new_async().await;
        s.mock("GET", "/rest/v1/habits").match_query(Matcher::Any).with_status(401).with_body("{}").create_async().await;
        s.mock("POST", "/auth/v1/token?grant_type=refresh_token").with_status(400).with_body(r#"{"error":"invalid_grant"}"#).create_async().await;
        empty_reads(&mut s).await;
        let d = db();
        d.with(|c| mirror::set_cursor(c, Table::Habits, "2026-01-01T00:00:00Z")).unwrap();
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        assert_eq!(r.error.as_deref(), Some("Your session expired. Sign in again to keep syncing."));
        assert_eq!(d.with(|c| mirror::cursor(c, Table::Habits)).unwrap().as_deref(), Some("2026-01-01T00:00:00Z"));
    }

    #[tokio::test] async fn mismatched_account_uploads_nothing() {
        let mut s = Server::new_async().await;
        let m = s.mock("POST", Matcher::Any).expect(0).create_async().await;
        empty_reads(&mut s).await;
        let d = db_for(FRIEND);
        save(&d, Table::Tasks, json!({"id": uid(1), "title": "x"}));
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        m.assert_async().await;
        assert_eq!((r.error.as_deref(), r.uploaded, r.ok), (Some("Account mismatch; sign in again."), 0, false));
        assert_eq!(row(&d, Table::Tasks, &uid(1))["synced"], 0);
    }

    #[tokio::test] async fn unauthorized_refreshes_token_and_retries_once() {
        let mut s = Server::new_async().await;
        s.mock("POST", "/rest/v1/tasks").match_query(Matcher::Any).match_header("authorization", "Bearer at").with_status(401).with_body("{}").expect(1).create_async().await;
        let refresh = s.mock("POST", "/auth/v1/token?grant_type=refresh_token").with_body(json!({"access_token": "at2", "refresh_token": "rt2", "expires_in": 3600, "user": {"id": ME}}).to_string()).expect(1).create_async().await;
        let retry = s.mock("POST", "/rest/v1/tasks").match_query(Matcher::Any).match_header("authorization", "Bearer at2").with_status(201).expect(1).create_async().await;
        empty_reads(&mut s).await;
        let d = db();
        save(&d, Table::Tasks, json!({"id": uid(1), "title": "x"}));
        let secret = Arc::new(MemorySecret::default());
        secret.set("rt1").unwrap();
        let auth = Auth::new(Arc::new(Client::new(Config { url: s.url(), key: "k".into() })), secret);
        auth.set_session(Session { access_token: "at".into(), user_id: ME.into(), email: None, expires_at: chrono::Utc::now().timestamp() + 3600 }).await;
        let r = run_sync(&d, &Client::new(Config { url: s.url(), key: "k".into() }), &auth).await;
        refresh.assert_async().await;
        retry.assert_async().await;
        assert_eq!((r.uploaded, r.error.as_deref()), (1, None));
    }

    #[tokio::test] async fn rejected_session_reports_expired() {
        let mut s = Server::new_async().await;
        s.mock("POST", "/rest/v1/tasks").match_query(Matcher::Any).with_status(401).with_body("{}").create_async().await;
        s.mock("POST", "/auth/v1/token?grant_type=refresh_token").with_status(400).with_body(r#"{"error":"invalid_grant"}"#).create_async().await;
        let d = db();
        save(&d, Table::Tasks, json!({"id": uid(1), "title": "x"}));
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        assert_eq!(r.error.as_deref(), Some("Your session expired. Sign in again to keep syncing."));
        assert_eq!(d.with(mirror::counts).unwrap(), (1, 0));
    }

    #[tokio::test] async fn shared_rows_are_pulled_as_friend_owned_copies() {
        let mut s = Server::new_async().await;
        s.mock("GET", "/rest/v1/shared_goals").match_query(Matcher::Any).with_body(json!([{"goal_id": uid(1)}]).to_string()).create_async().await;
        s.mock("GET", "/rest/v1/shared_habits").match_query(Matcher::Any).with_body(json!([{"habit_id": uid(3)}]).to_string()).create_async().await;
        s.mock("GET", "/rest/v1/shared_tasks").match_query(Matcher::Any).with_body(json!([{"task_id": uid(4)}]).to_string()).create_async().await;
        s.mock("GET", "/rest/v1/habits").match_query(Matcher::UrlEncoded("user_id".into(), format!("neq.{ME}")))
            .with_body(json!([{"id": uid(1), "user_id": FRIEND, "name": "Goal", "is_goal": true, "updated_at": NOW}]).to_string()).create_async().await;
        s.mock("GET", "/rest/v1/tasks").match_query(Matcher::UrlEncoded("user_id".into(), format!("neq.{ME}")))
            .with_body(json!([{"id": uid(4), "user_id": FRIEND, "title": "Plan", "status": "done", "amount": 2, "updated_at": NOW}]).to_string()).create_async().await;
        empty_reads(&mut s).await;
        let d = db();
        let (c, a) = signed_in(s.url()).await;
        let r = run_sync(&d, &c, &a).await;
        assert_eq!((r.downloaded, r.error.as_deref()), (2, None));
        assert_eq!(row(&d, Table::Habits, &uid(1))["owner_id"], FRIEND);
        let t = d.with(|c| Ok(c.query_row("SELECT user_id,owner_id,status,amount FROM cloud_tasks WHERE id=?1", [uid(4)], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, String>(2)?, r.get::<_, Option<f64>>(3)?)))?)).unwrap();
        assert_eq!(t, (ME.to_string(), FRIEND.to_string(), "open".to_string(), None));
        assert!(d.with(|c| Ok(mirror::is_shared(c, &uid(3))? && mirror::is_shared(c, &uid(4))?)).unwrap());
    }

    #[test] fn sync_future_is_send() {
        fn send<T: Send>(_: T) {}
        let (d, c) = (db(), Client::new(Config { url: "http://127.0.0.1:9".into(), key: "k".into() }));
        let a = Auth::new(Arc::new(Client::new(Config { url: "http://127.0.0.1:9".into(), key: "k".into() })), Arc::new(MemorySecret::default()));
        send(run_sync(&d, &c, &a));
    }
}
