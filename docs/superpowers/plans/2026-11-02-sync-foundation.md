# Sync Foundation (Plan 1 of 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sign Habyss Desktop in to the Habyss Supabase account and keep a local-first, two-way mirror of habits (including goals), completions, tasks and milestones. Provide cached access to server RPCs and the mobile rule functions in TypeScript, so that Plan 2 can build the six tabs on top.

**Architecture:** A new Rust module `cloud/` sits beside the existing tracker. It talks to Supabase over HTTPS (GoTrue for auth, PostgREST for rows and RPCs) and to Realtime over a WebSocket. It writes only through the existing single SQLite connection owned by `Service`. Network calls never hold the `Mutex<Service>` lock: lock, read, unlock, call the network, lock, write. The sync algorithm is a direct port of mobile `lib/cloudSync.ts` and `lib/cloudMapping.ts`, working on `serde_json::Value` rows exactly as the TypeScript works on plain objects. React reaches all of this only through Tauri commands and events. The mobile rule files are copied into `src/shared/` as TypeScript.

**Tech Stack:**
- Existing: Tauri 2, Rust 2021, rusqlite 0.38, React 19, Vitest.
- New Rust crates: `reqwest` 0.12 (features `json`, `rustls-tls`, no default features), `tokio-tungstenite` 0.24 (feature `rustls-tls-webpki-roots`), `futures-util` 0.3, `keyring` 3 (feature `apple-native`), `tokio` 1 (features `time`, `sync`, `macros`, `rt`).
- New Rust dev-dependency: `mockito` 1.

**Spec:** `docs/superpowers/specs/2026-11-02-desktop-sync-design.md`. Mobile reference: `~/Coding/Habyss` at commit `335c672`, read-only.

## Global Constraints

- Supabase URL is `https://wlbjhtlznzdumqxetilx.supabase.co`, and only the publishable key is used. Both are read at build time from `apps/desktop/src-tauri/.env` (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, gitignored) through `build.rs`. If either is missing, the build still works and sync reports `unconfigured`.
- No service-role key anywhere. Never log tokens, emails or window titles.
- The refresh token lives only in the macOS Keychain (service `com.habyss.desktop`, account `supabase-refresh-token`). The access token lives only in memory.
- Server conventions:
  - Ids are client-generated UUID v4 and kept forever.
  - `updated_at` is set by the server.
  - Dates are local `YYYY-MM-DD`, and times are local `HH:MM`.
  - Deletes are soft (`deleted_at`).
  - `habit_completions` upserts use `on_conflict=user_id,habit_id,date` and never send `id`.
  - Goals upload before other habits.
- Batch size is 200 rows for uploads and the page size is 1000 for downloads.
- The local write rule: a row from the server replaces a local row only when `synced = 1` and `updated_at` differs.
- Shared tasks never upload `status`, `completed_at` or `amount` onto a friend's row. Goals and habits owned by a friend are read-only.
- The desktop never writes `profiles` or `personal_backups`, and never uploads activity data (intervals, applications, titles).
- One account per local database. Signing in as a different user clears the mirror, cursors, cache and outbox first. Activity tables are never cleared by account actions.
- The webview CSP stays closed to the network. Only Rust talks to Supabase.
- Rust style: match the existing dense style in `src-tauri/src/*.rs`, `Result` from `storage.rs`, and tests in `#[cfg(test)] mod tests` in the same file.
- This folder is not a git repository. Skip "Commit" steps unless the owner has run `git init`.

## Review Focus

1. **A timestamp containing `+` in the keyset `or=` filter.** It must be percent-encoded, or PostgREST reads the `+` as a space, the filter fails, and the cursor never moves. The test is in Task 1.
2. **A local edit made while its upload is in flight.** It must stay `synced = 0` and go up on the next pass. The test is in Task 3, using `mark_uploaded` with a changed `updated_at`.
3. **Going offline mid-sync, or starting the app offline.** Local edits must still commit, the status must read `offline`, and no cursor may move past rows that weren't written. The tests are in Tasks 5 and 6.
4. **Signing in as a different account on the same Mac.** None of the previous account's rows may upload under the new user. The test is in Task 4.
5. **An access token expiring during a long sync, or overnight.** One refresh and a retry should happen without user action. A failed refresh should sign the user out and keep their data. The test is in Task 4.

---

### Task 1: Supabase client core and config

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`. Add the crates from the Tech Stack.
- Modify: `apps/desktop/src-tauri/build.rs`. Read `.env` lines `KEY=VALUE` and emit `cargo:rustc-env=HABYSS_SUPABASE_URL=…` and `cargo:rustc-env=HABYSS_SUPABASE_KEY=…`, plus `cargo:rerun-if-changed=.env`. A missing file is not an error.
- Create: `apps/desktop/src-tauri/src/cloud/mod.rs`, which declares the submodules.
- Create: `apps/desktop/src-tauri/src/cloud/client.rs`.
- Modify: `apps/desktop/src-tauri/src/lib.rs`. Add `mod cloud;`.

**Interfaces:**
- Produces:
  - `pub struct Config { pub url: String, pub key: String }` and `impl Config { pub fn from_build() -> Option<Config> }`. The latter uses `option_env!`.
  - `pub struct Client { pub config: Config, http: reqwest::Client }`.
  - `impl Client`:
    - `pub fn new(config: Config) -> Client`
    - `pub async fn select(&self, token: &str, table: &str, query: &[(String, String)]) -> Result<Vec<Value>, CloudError>`
    - `pub async fn upsert(&self, token: &str, table: &str, on_conflict: &str, rows: &[Value]) -> Result<(), CloudError>`. This sends `Prefer: resolution=merge-duplicates,return=minimal`.
    - `pub async fn delete(&self, token: &str, table: &str, query: &[(String, String)]) -> Result<(), CloudError>`
    - `pub async fn rpc(&self, token: &str, name: &str, args: &Value) -> Result<Value, CloudError>`
    - `pub async fn auth_post(&self, path: &str, token: Option<&str>, body: &Value) -> Result<Value, CloudError>`. Here `path` is, for example, `"otp"`, `"verify"` or `"token?grant_type=refresh_token"`.
  - `pub fn pull_query(user_id: &str, since: Option<&str>, after: Option<(&str, &str)>, limit: usize) -> Vec<(String, String)>`. This is a port of `lib/cloudPullPage.ts`.
  - `#[derive(Debug)] pub enum CloudError { Offline, Unauthorized, Forbidden { message: String }, MissingColumn(String), MissingTable, Server { status: u16, code: String, message: String } }`, with `Display`.
  - `pub fn classify(status: u16, body: &str) -> CloudError`. This ports `missingColumnFrom` and `missingTableFrom` from `lib/cloudSync.ts` (codes `PGRST204`, `42703`, `PGRST205`, `42P01`, and the same three message regexes). 401 maps to `Unauthorized`. 403, or code `42501`, maps to `Forbidden`. Connect or timeout errors from `reqwest` map to `Offline`.

Every request sends `apikey: <key>` and `Authorization: Bearer <token or key>`, with a 20 s timeout.

- [ ] **Step 1: Write failing tests in `client.rs`**

```rust
#[test] fn pull_query_matches_mobile_keyset() {
    let q=pull_query("u1",Some("2026-11-02T10:00:00.5+00:00"),Some(("2026-11-02T10:00:01+00:00","abc")),1000);
    assert!(q.contains(&("user_id".into(),"eq.u1".into())));
    assert!(q.contains(&("order".into(),"updated_at.asc,id.asc".into())));
    assert!(q.contains(&("limit".into(),"1000".into())));
    assert!(q.contains(&("updated_at".into(),"gte.2026-11-02T10:00:00.5+00:00".into())));
    assert!(q.contains(&("or".into(),"(updated_at.gt.2026-11-02T10:00:01+00:00,and(updated_at.eq.2026-11-02T10:00:01+00:00,id.gt.abc))".into())));
}
#[test] fn classify_matches_mobile_error_rules() {
    assert!(matches!(classify(400,r#"{"code":"PGRST204","message":"Could not find the 'section' column of 'tasks' in the schema cache"}"#),CloudError::MissingColumn(c) if c=="section"));
    assert!(matches!(classify(404,r#"{"code":"PGRST205","message":"Could not find the table 'public.tasks'"}"#),CloudError::MissingTable));
    assert!(matches!(classify(401,"{}"),CloudError::Unauthorized));
    assert!(matches!(classify(403,r#"{"code":"42501","message":"new row violates row-level security policy"}"#),CloudError::Forbidden{..}));
}
#[tokio::test] async fn plus_in_timestamp_is_percent_encoded_on_the_wire() {
    let mut server=mockito::Server::new_async().await;
    let m=server.mock("GET",mockito::Matcher::Regex(r"updated_at=gte\.2026-11-02T10%3A00%3A00%2B00%3A00".into())).with_body("[]").create_async().await;
    let c=Client::new(Config{url:server.url(),key:"k".into()});
    c.select("t","habits",&pull_query("u",Some("2026-11-02T10:00:00+00:00"),None,1000)).await.unwrap();
    m.assert_async().await;
}
```

- [ ] **Step 2: Run** `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml cloud::client`. Expected: the tests fail to compile, because the module doesn't exist yet.
- [ ] **Step 3: Implement `client.rs` and the `build.rs` env loading** as listed in Interfaces. Use `reqwest::RequestBuilder::query` so that encoding is done by the library.
- [ ] **Step 4: Run the same command.** Expected: 3 passed. Also run `cargo test` for the whole crate: the existing tests still pass.
- [ ] **Step 5: Commit** with the message `feat(cloud): supabase client and config`.

---

### Task 2: Row mapping port

**Files:**
- Create: `apps/desktop/src-tauri/src/cloud/mapping.rs`.
- Test: in the same file. Translate every case from mobile `lib/__tests__/cloudMapping.test.ts` one for one, keeping the test names in snake_case.

**Interfaces:**
- Consumes: nothing.
- Produces, all pure and all on `serde_json::Value` objects:
  - Habits: `habit_to_remote(row:&Value,user_id:&str)->Value` and `habit_to_local(row:&Value)->Value`.
  - Completions: `completion_to_remote(row:&Value,user_id:&str)->Value` and `completion_to_local(row:&Value)->Value`.
  - Tasks: `task_to_remote(row:&Value,user_id:&str)->Value` and `task_to_local(row:&Value)->Value`.
  - Milestones: `milestone_to_remote(row:&Value,user_id:&str)->Value` and `milestone_to_local(row:&Value)->Value`.
  - Helpers: `is_uuid(&Value)->bool`, `date_only(&Value)->Value`, `order_for_upload(rows:Vec<Value>)->(Vec<Value>,Vec<Value>)` (returns upload and skipped), and `pub const PERSONAL_TASK_FIELDS:[&str;3]=["status","completed_at","amount"]`.

This is a port of `lib/cloudMapping.ts` function for function, including:
- the allowed-value lists;
- `planningToRemote` and `planningToLocal`, which only copy the keys that are present;
- `deletedAt` taking `updated_at`, falling back to now;
- `*_to_local` setting `synced: 1`.

`*_to_local` adds `"owner_id": null` and `"refused": 0`. These are desktop-only local columns from Task 3.

- [ ] **Step 1: Write the translated tests.** Add one more test: `habit_to_local_maps_unknown_tracking_to_numeric`, where `tracking_method:"duration"` becomes `"numeric"` and `null` becomes `"boolean"`.
- [ ] **Step 2: Run** `cargo test … cloud::mapping`. Expected: compile failure.
- [ ] **Step 3: Implement `mapping.rs`.**
- [ ] **Step 4: Run.** Expected: every translated test passes.
- [ ] **Step 5: Commit** with the message `feat(cloud): port cloudMapping`.

---

### Task 3: Local mirror schema and store operations

**Files:**
- Create: `apps/desktop/src-tauri/migrations/002_cloud.sql`.
- Modify: `apps/desktop/src-tauri/src/storage.rs:13-14`. Reject `user_version > 2`. After executing 001, also execute 002, which ends with `PRAGMA user_version = 2;`. Note that 001 resets the version to 1 every launch, so 002 must run after it every time and must be idempotent.
- Create: `apps/desktop/src-tauri/src/cloud/mirror.rs`.

**`002_cloud.sql` contents.** Use `CREATE TABLE IF NOT EXISTS` throughout. Column names are exactly the keys produced by `*_to_local` in Task 2. Every mirror table also gets:
- `owner_id TEXT` (null means "mine");
- `refused INTEGER NOT NULL DEFAULT 0`;
- `deleted INTEGER NOT NULL DEFAULT 0`;
- `synced INTEGER NOT NULL DEFAULT 0`.

The tables:
- `cloud_habits` (primary key `id`).
- `cloud_completions` (primary key `id`, with `UNIQUE(habit_id,date)`). A desktop-created completion's id is `"<habit_id>_<date>"`, as on mobile.
- `cloud_tasks` (primary key `id`).
- `cloud_milestones` (primary key `id`).
- `cloud_cursors(table_name TEXT PRIMARY KEY, cursor TEXT NOT NULL)`.
- `cloud_account(id INTEGER PRIMARY KEY CHECK(id=1), user_id TEXT NOT NULL, email TEXT, last_sync TEXT, last_error TEXT)`.
- `cloud_cache(key TEXT PRIMARY KEY, json TEXT NOT NULL, fetched_at TEXT NOT NULL)`.
- `cloud_outbox(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL)`.
- `cloud_shared_ids(id TEXT PRIMARY KEY)`.

Add indexes on `synced` for each mirror table.

**Interfaces:**
- Produces, as functions taking `&rusqlite::Connection`:
  - `pub enum Table { Habits, Completions, Tasks, Milestones }`, with:
    - `fn local(&self)->&'static str`, giving the `cloud_*` name;
    - `fn remote(&self)->&'static str`, giving `habits`, `habit_completions`, `tasks` or `goal_milestones`;
    - `fn on_conflict(&self)->&'static str`;
    - `fn local_conflict(&self)->&'static str`, which is `"habit_id,date"` for completions and `"id"` otherwise.
    - `pub const ALL:[Table;4]`, in the order habits, completions, tasks, milestones.
  - `pub fn write_local(c:&Connection,t:Table,row:&Value,keep:&[&str])->Result<usize>`. This is a port of `writeLocal`: `INSERT … ON CONFLICT(local_conflict) DO UPDATE SET … WHERE synced=1 AND updated_at IS NOT excluded.updated_at`. Columns come from the row's keys and are filtered against the table's real columns (`PRAGMA table_info`) so that an unknown server column never fails the write.
  - `pub fn unsynced(c:&Connection,t:Table)->Result<Vec<Value>>`. This returns rows where `synced=0 AND refused=0`.
  - `pub fn mark_uploaded(c:&Connection,t:Table,rows:&[Value])->Result<usize>`. This runs `UPDATE … SET synced=1 WHERE id=? AND updated_at IS ?`.
  - `pub fn mark_refused(c:&Connection,t:Table,id:&str)->Result<()>`.
  - `pub fn cursor(c:&Connection,t:Table)->Result<Option<String>>` and `pub fn set_cursor(c:&Connection,t:Table,v:&str)->Result<()>`.
  - `pub fn account(c:&Connection)->Result<Option<(String,Option<String>)>>`, returning user id and email.
  - `pub fn set_account(c:&Connection,user_id:&str,email:Option<&str>)->Result<()>`. If a different `user_id` is stored, this first calls `clear_cloud` in the same transaction.
  - `pub fn clear_cloud(c:&Connection)->Result<()>`. This empties every `cloud_*` table.
  - `pub fn counts(c:&Connection)->Result<(i64,i64)>`, returning pending and refused, summed over the four tables.
  - `pub fn save_local(c:&Connection,t:Table,row:Value,user_id:&str,now:&str)->Result<()>`. This handles desktop edits. It sets `user_id`, `updated_at=now`, `synced=0` and `refused=0`. It errors with `"This belongs to a friend and is read-only"` when the existing row has `owner_id` set, is a habit or milestone, and isn't `user_id`.
  - Cache: `pub fn cache_get(c:&Connection,key:&str)->Result<Option<(Value,String)>>` and `pub fn cache_put(c:&Connection,key:&str,v:&Value,now:&str)->Result<()>`.
  - Outbox: `pub fn outbox_push(c:&Connection,kind:&str,payload:&Value,now:&str)->Result<()>` and `pub fn outbox_all(c:&Connection)->Result<Vec<(i64,String,Value)>>`.
  - Shared ids: `pub fn outbox_done(c:&Connection,id:i64)->Result<()>`, `pub fn set_shared_ids(c:&Connection,ids:&[String])->Result<()>` and `pub fn is_shared(c:&Connection,id:&str)->Result<bool>`.

- [ ] **Step 1: Write failing tests in `mirror.rs`**, using `Store::open(Path::new(":memory:"))`:
  - `incoming_row_never_overwrites_unsent_edit`: `save_local` a task with title A, then `write_local` the server version with title B. The title stays A and `synced` stays 0.
  - `incoming_row_replaces_synced_row_when_updated_at_differs`.
  - `edit_during_upload_stays_pending`: read `unsynced`, then `save_local` again with a new `now`, then `mark_uploaded` with the old rows. The row still has `synced=0`.
  - `completion_conflicts_on_habit_and_date`: two `write_local` calls with different ids but the same habit and date leave one row, carrying the second id.
  - `unknown_server_column_is_ignored`: a row with `"brand_new":1` still writes.
  - `switching_account_clears_mirror_but_not_activity`: `set_account("u1")`, then save a habit and commit an activity span, then `set_account("u2")`. The habits are empty and the intervals still exist.
  - `friend_owned_goal_is_read_only`: a habit row with `owner_id:"friend"`, edited by `save_local` as `"me"`, returns an error.
  - `migration_002_is_idempotent_and_version_is_2`. Reopen the store and check that `user_version` is 2. The existing test `migrations_are_idempotent_and_future_versions_are_rejected` must still pass.
- [ ] **Step 2: Run** `cargo test … cloud::mirror storage`. Expected: fail.
- [ ] **Step 3: Implement the migration, the `storage.rs` change and `mirror.rs`.**
- [ ] **Step 4: Run.** Expected: all pass, including the existing storage tests.
- [ ] **Step 5: Commit** with the message `feat(cloud): local mirror schema`.

---

### Task 4: Auth, Keychain and session

**Files:**
- Create: `apps/desktop/src-tauri/src/cloud/auth.rs`.

**Interfaces:**
- Consumes: `Client::auth_post` (Task 1), and `mirror::set_account` and `mirror::clear_cloud` (Task 3).
- Produces:
  - `pub trait SecretStore: Send + Sync { fn get(&self)->Option<String>; fn set(&self,v:&str)->Result<()>; fn clear(&self)->Result<()>; }`, with:
    - `pub struct Keychain`, which uses `keyring::Entry::new("com.habyss.desktop","supabase-refresh-token")`;
    - `pub struct MemorySecret(Mutex<Option<String>>)` for tests.
  - `#[derive(Clone)] pub struct Session { pub access_token:String, pub user_id:String, pub email:Option<String>, pub expires_at:i64 }`, where `expires_at` is in epoch seconds.
  - `pub struct Auth { client: Arc<Client>, secret: Arc<dyn SecretStore>, session: tokio::sync::Mutex<Option<Session>> }`, with:
    - `pub async fn send_code(&self,email:&str)->Result<(),CloudError>`. This calls `POST otp {"email":…, "create_user":true}`.
    - `pub async fn verify_code(&self,email:&str,code:&str)->Result<Session,CloudError>`. This calls `POST verify {"type":"email","email":…,"token":…}`.
    - `pub async fn sign_in_password(&self,email:&str,password:&str)->Result<Session,CloudError>`. This calls `POST token?grant_type=password`.
    - `pub async fn restore(&self)->Result<Option<Session>,CloudError>`. This refreshes from the Keychain token at launch. On `Offline` it returns `Ok(None)` but keeps the token, so it can retry later.
    - `pub async fn token(&self)->Result<String,CloudError>`. This refreshes when fewer than 60 s remain. A refresh answered with 400 or 401 clears the secret and session and returns `Unauthorized`.
    - `pub async fn sign_out(&self)`. This makes a best-effort `POST logout`, then clears the secret and session. It keeps local data.
    - Every successful sign-in or refresh stores the new `refresh_token` through `secret.set`.

- [ ] **Step 1: Write failing tests** using `mockito` and `MemorySecret`:
  - `verify_code_stores_refresh_token_and_returns_user`.
  - `expired_token_refreshes_once`: set `expires_at` in the past. `token()` makes exactly one call to `token?grant_type=refresh_token`.
  - `rejected_refresh_signs_out_but_keeps_nothing_secret`: the refresh returns 400. `token()` gives `Unauthorized`, and `secret.get()` is `None`.
  - `restore_offline_keeps_token`: the server is unreachable (use URL `http://127.0.0.1:9`). The result is `Ok(None)`, and the secret is still present.
- [ ] **Step 2: Run** `cargo test … cloud::auth`. Expected: fail.
- [ ] **Step 3: Implement `auth.rs`.**
- [ ] **Step 4: Run.** Expected: pass.
- [ ] **Step 5: Commit** with the message `feat(cloud): email auth with keychain session`.

---

### Task 5: Sync engine

**Files:**
- Create: `apps/desktop/src-tauri/src/cloud/sync.rs`.

**Interfaces:**
- Consumes: Tasks 1 to 4.
- Produces:
  - `#[derive(Serialize,Default)] pub struct SyncReport { pub ok:bool, pub uploaded:usize, pub downloaded:usize, pub failed:usize, pub refused:usize, pub waiting:Vec<String>, pub error:Option<String> }`.
  - `pub trait Db: Send + Sync { fn with<T>(&self,f:impl FnOnce(&rusqlite::Connection)->crate::storage::Result<T>)->crate::storage::Result<T>; }`. This is implemented for `tauri::AppHandle`, which locks `app.state::<commands::Shared>()` (the existing `Mutex<Service>`) and calls `f(&service.store.conn)`. In tests it is implemented for `struct TestDb(std::sync::Mutex<Store>)`.
  - `pub async fn run_sync(db:&impl Db,client:&Client,auth:&Auth)->SyncReport`.

**Algorithm.** This is a port of `runSync` minus `requeue` and `syncPersonal`. Order:

1. **Flush the outbox.** For each entry:
   - kind `shared_done` with payload `{item_id,item_type,day,evidence}`: upsert `shared_completions` with `on_conflict=user_id,item_id,day` and `user_id` = me;
   - kind `shared_undone` with payload `{item_id,day}`: delete with `user_id=eq.me&item_id=eq.…&day=eq.…`.
   
   Remove an entry when it succeeds. Stop at the first `Offline`.
2. **Upload** for each `Table::ALL`, as in `upload()` on mobile:
   - Completions are filtered to `is_uuid(habit_id)`. Other tables go through `order_for_upload`.
   - Rows with `owner_id` set and not equal to me:
     - habits and milestones are skipped and not uploaded;
     - tasks are uploaded without `PERSONAL_TASK_FIELDS`, in their own batches.
   - A missing column is dropped and the batch retried, up to 8 times. The dropped column is remembered in a process-lifetime `HashSet`.
   - A missing table is added to `waiting` and the table is skipped.
   - When a batch fails, retry it row by row. A row answered with `Forbidden` gets `mark_refused` and counts in `refused`. Any other failure counts in `failed`.
3. **Download** for each table, as in `download()` on mobile:
   - one cursor per table, paged with `pull_query`;
   - each page is written in a single DB transaction;
   - a failed row write counts in `failed` and holds that table's cursor back;
   - the cursor is the string-max of `updated_at`.
4. **Pull shared.** This is a port of `pullShared` plus `refreshSharedIds`:
   - write rows with `user_id` = me and `owner_id` = the remote `user_id`;
   - tasks keep `PERSONAL_TASK_FIELDS` through the `keep` argument, and a new copy starts `status:"open"`;
   - store the shared ids from `shared_habits` and `shared_tasks` (accepted, not deleted, where I am owner or `shared_with`).
   
   Failures here are logged and don't fail the report.
5. **Record the result:** `cloud_account.last_sync` = now when `failed==0`, and `last_error`.

`Unauthorized` at any step retries once after `auth.token()`. If it still fails, the report error is `"Your session expired. Sign in again to keep syncing."`. `Offline` gives the error `"No connection. Your changes are saved on this Mac and will sync when you're online."`. Neither moves any cursor.

- [ ] **Step 1: Write failing tests** with `mockito` and an in-memory `Store`:
  - `goals_upload_before_habits`: the first upsert body's first row has `is_goal:true`.
  - `completion_upload_omits_id_and_uses_composite_conflict`.
  - `bad_row_is_retried_alone`: the batch returns 400, and the single-row retries return 201 then 400. Result: `uploaded==1`, `failed==1`, and the good row has `synced==1`.
  - `rls_refusal_marks_row_refused_and_stops_retrying`: a 403 row has `refused==1`, and the next `unsynced` excludes it.
  - `missing_column_is_dropped_and_rest_uploads`: the first call is a `PGRST204` naming `section`, and the second call's body has no `section` key.
  - `shared_task_upload_excludes_personal_fields`.
  - `friend_goal_is_never_uploaded`.
  - `download_pages_and_advances_cursor`: page 1 has 1000 rows, page 2 has 3. The second request carries `or=`, and the cursor equals the last row's `updated_at`.
  - `failed_local_write_holds_cursor`. Inject a SQLite trigger that aborts insert for one id.
  - `offline_keeps_cursor_and_local_edits`: the server is unreachable, `report.error` mentions "No connection", the cursor is unchanged and the pending count is unchanged.
  - `outbox_shared_done_is_sent_then_removed`.
- [ ] **Step 2: Run** `cargo test … cloud::sync`. Expected: fail.
- [ ] **Step 3: Implement `sync.rs`.**
- [ ] **Step 4: Run.** Expected: pass.
- [ ] **Step 5: Commit** with the message `feat(cloud): two-way sync engine`.

---

### Task 6: Runner, triggers and Realtime

**Files:**
- Create: `apps/desktop/src-tauri/src/cloud/realtime.rs`.
- Create: `apps/desktop/src-tauri/src/cloud/runner.rs`.
- Modify: `apps/desktop/src-tauri/src/lib.rs` (setup). If `Config::from_build()` is `Some`, build `Cloud` and `app.manage(cloud)`, then spawn the runner on `tauri::async_runtime`. Also emit a nudge when the main window gains focus (`WindowEvent::Focused(true)` on `"main"`).

**Interfaces:**
- Produces:
  - `pub struct Cloud { pub client:Arc<Client>, pub auth:Arc<Auth>, nudge:tokio::sync::mpsc::UnboundedSender<Nudge>, pub status:Arc<std::sync::Mutex<SyncStatus>> }`, with `pub fn nudge(&self,n:Nudge)`.
  - `pub enum Nudge { LocalEdit, Remote, Focus, Manual, SignedIn, SignedOut }`.
  - `#[derive(Serialize,Clone)] pub struct SyncStatus { pub state:String, pub email:Option<String>, pub last_sync:Option<String>, pub pending:i64, pub refused:i64, pub error:Option<String> }`. `state` is one of `unconfigured`, `signed_out`, `idle`, `syncing`, `offline` or `error`.
  - `pub async fn run(app:tauri::AppHandle,cloud:Arc<Cloud>,rx:UnboundedReceiver<Nudge>)`.
  - `pub async fn realtime(config:Config,token:String,user_id:String,on_change:impl Fn())->Result<(),CloudError>`.

**Runner timing:**
- `LocalEdit` waits 2.5 s from the last edit (debounce).
- `Focus` is throttled to once every 60 s.
- `Remote` is debounced by 1 s.
- `Manual` and `SignedIn` run immediately.
- A periodic pass runs every 5 min while signed in. While `offline`, a retry runs every 30 s instead. A successful retry is how "network regained" is detected.
- Only one sync runs at a time. A nudge that arrives during a sync schedules exactly one more pass.
- After each pass, update `SyncStatus`, emit `sync-status` (the payload is the status) to all windows, and if `downloaded>0`, emit `cloud-changed`.
- At launch, call `auth.restore()`, then sync.

**Realtime:**
- Connect to `wss://<host>/realtime/v1/websocket?apikey=<key>&vsn=1.0.0`.
- Join topic `realtime:habyss-desktop` with `config.postgres_changes` = four entries `{event:"*",schema:"public",table:<remote>,filter:"user_id=eq.<uid>"}` and `access_token`.
- Send a heartbeat `{"topic":"phoenix","event":"heartbeat","payload":{},"ref":<n>}` every 25 s.
- Call `on_change` for every `postgres_changes` message.
- On token refresh, send `{"topic":"realtime:habyss-desktop","event":"access_token","payload":{"access_token":…}}`.
- Reconnect with backoff of 1, 2, 4 and so on up to 60 s.
- Realtime only sends `Nudge::Remote`. It never writes data.

- [ ] **Step 1: Write failing tests:**
  - `join_message_filters_by_user` in `realtime.rs`. Pure: `fn join_payload(user_id:&str,token:&str)->Value`. Assert the four tables and the filter string.
  - `debounce_coalesces_edits` in `runner.rs`. Pure: `fn next_due(last_edit_ms:i64,now:i64)->Option<i64>`. Five edits 100 ms apart give one pass 2.5 s after the last edit.
  - `offline_status_after_unreachable_sync`. Run one pass against an unreachable URL: the status `state=="offline"`.
- [ ] **Step 2: Run** `cargo test … cloud::runner cloud::realtime`. Expected: fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: pass. Then run `bun run dev`. Without signing in, the app still tracks activity, and the status is `signed_out`.
- [ ] **Step 5: Commit** with the message `feat(cloud): sync runner and realtime nudges`.

---

### Task 7: Tauri commands for account, data and RPCs

**Files:**
- Create: `apps/desktop/src-tauri/src/cloud/commands.rs`.
- Modify: `apps/desktop/src-tauri/src/lib.rs`. Register the commands in `generate_handler!`.
- Modify: `apps/desktop/src/types.ts`. Add the matching TypeScript types: `SyncStatus`, `CloudData`, `Cached<T>`, `HabitRow`, `CompletionRow`, `TaskRow` and `MilestoneRow`. The row types are the local column shapes from Task 3.

**Interfaces.** Every command returns `Result<_, String>`. Every write command saves locally first and then calls `cloud.nudge(LocalEdit)`. That works offline.

Account commands:
- `cloud_status()->SyncStatus`
- `cloud_send_code(email:String)`
- `cloud_verify_code(email:String,code:String)`. This calls `set_account`, which clears the mirror on an account switch, then caches `personal_backups` (select `*` where `user_id=eq.me`) under the key `personal_backups`, then nudges `SignedIn`.
- `cloud_sign_in_password(email:String,password:String)`. Same behaviour.
- `cloud_sign_out()`. This keeps the mirror, so the same account can sign back in without downloading everything again.
- `cloud_sync_now()->SyncReport`

Data commands:
- `cloud_data(completions_since:Option<String>)->CloudData{habits,completions,tasks,milestones}`. Each list holds the rows with `deleted=0`. Completions are filtered by `date>=since` when one is given.
- `cloud_save(table:String,row:Value)`. `table` is one of `habits`, `tasks` or `milestones`. A new row without an `id` gets a UUID v4 and `created_at`.
- `cloud_delete(table:String,id:String)`. This sets `deleted=1` and `synced=0`.
- `cloud_set_completion(habit_id:String,date:String,value:Option<f64>,skipped:bool,memo:Option<String>,evidence:Option<String>)`:
  - `value: None` means untick, which sets `deleted=1`.
  - If `is_shared(habit_id)`, it also pushes `shared_done` with `item_type` `"habit"`, `day` = date and `evidence` = evidence or `"self"`, or pushes `shared_undone`.
- `cloud_set_task_done(id:String,done:bool)`. This sets `status`, `completed_at` and, for shared tasks, the outbox entry, as mobile `publishIfShared` does with `item_type` `"task"` and `day` = today local.

RPC commands:
- `cloud_rpc(name:String,args:Value)->Cached<Value>`, where `Cached<T> = {value:T,fetched_at:String,stale:bool}`. This is for reads.
  - Allowed names: `my_wallet`, `my_ledger`, `my_streak_freezes`, `community_feed`, `friend_stats`, `friend_today_tasks`, `friend_presence`, `leaderboard`, `crew_consistency`, `crew_king`, `crew_quest`, `crew_challenges_for`, `my_mission`, `revealed_missions` and `market_feed`.
  - Also allowed: `profile`, which reads `profiles` for my id.
  - Cache key: `rpc:<name>:<args json>`.
  - When offline, return the cached value with `stale:true`. With no cache, return the error `"Needs a connection"`.
- `cloud_action(name:String,args:Value)->Value`. This is for writes and is online only.
  - Allowed names: `issue_challenge`, `join_challenge`, `open_market`, `place_stake`, `settle_market`, `use_streak_freeze`, `gift_streak_freeze`, `create_exposed` and `act_on_exposed`.
  - When offline, return the error `"This needs a connection."`.
- `cloud_delete_account()`. This calls `delete_my_account`, then `clear_cloud` and `sign_out`.

Friends direct-table access is left to Plan 2.

Events: `sync-status` and `cloud-changed`, from Task 6.

- [ ] **Step 1: Write failing tests** in `commands.rs`. Test the pure inner functions that the commands wrap, each taking `&Connection`:
  - `save_assigns_uuid_and_marks_pending`.
  - `untick_sets_deleted_and_pending`.
  - `tick_on_shared_habit_queues_shared_done`.
  - `rpc_name_outside_allowlist_is_rejected`.
  - `offline_rpc_returns_stale_cache`.
  - `cloud_data_excludes_deleted`.
- [ ] **Step 2: Run** `cargo test … cloud::commands`. Expected: fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `cargo test`, then `bun run check`. Expected: pass.
- [ ] **Step 5: Commit** with the message `feat(cloud): commands for account, data and rpc`.

---

### Task 8: Shared rule functions in TypeScript

**Files:**
- Create: `apps/desktop/src/shared/`. Copy `recurrence.ts`, `habitSchedule.ts`, `dayPlan.ts`, `dayFlow.ts`, `habitStatus.ts`, `goalInsights.ts`, `dayComplete.ts`, `marks.ts` and `sharedGate.ts` from mobile `lib/` at commit `335c672`. Also copy the modules they import transitively that are pure, such as `peakPlan` and `habitMeasurement`, and the type-only parts of `habitsSQLite` and `tasks`.
- Each file's first line is `// Copied from Habyss Mobile lib/<file> @335c672. Keep in sync; do not re-derive rules.`
- Replace mobile-only dependencies (AsyncStorage, `require('./dataStore')`, `require('./supabase')`, `emit`) with explicit function parameters or default arguments. Don't change any rule logic.
- Create: `apps/desktop/src/shared/rows.ts`. Port `rowToTask` from mobile `lib/tasks.ts:109` and the habit row mapping from mobile `lib/habitsSQLite.ts:167`, as `rowToHabit(row:HabitRow):Habit` and `rowToTask(row:TaskRow):Task`.
- Tests: copy the mobile tests `recurrence`, `habitSchedule`, `dayPlan`, `dayFlow`, `habitStatus`, `goalInsights`, `dayComplete`, `marks` and `sharedGate` from `lib/__tests__/` into `apps/desktop/src/shared/__tests__/`. Convert `jest` calls to `vi`. Change only the mocks that the dependency replacement above made unnecessary.

**Interfaces:**
- Produces, for Plan 2, the same exported names as mobile. That includes `isHabitScheduledForDate`, `createHabitRequirement`, `habitStatus`, `goalInsights`, `streakFrom`, the `dayFlow` layout functions, `rowToHabit` and `rowToTask`.

- [ ] **Step 1: Copy the tests first.** Run `bun run test`. Expected: they fail because the modules are missing.
- [ ] **Step 2: Copy the modules and replace the dependencies.**
- [ ] **Step 3: Run** `bun run test`. Expected: every copied test passes, with the same counts as mobile `npx jest lib/__tests__/<those files>`. Then run `bun run check`. Expected: clean.
- [ ] **Step 4: Commit** with the message `feat(shared): mobile rule functions with parity tests`.

---

### Task 9: Account and sync UI in Settings

**Files:**
- Create: `apps/desktop/src/screens/Account.tsx`.
- Modify: `apps/desktop/src/screens/Settings.tsx`. Render `<Account/>` as the first card.
- Modify: `apps/desktop/src/App.tsx`:
  - listen to `sync-status`;
  - show a status dot in the sidebar bottom, next to the tracking control;
  - replace the footer text "No accounts. No uploads." with "Activity stays on this Mac. Habits, goals and tasks sync with your Habyss account." when signed in, and keep the old text when signed out.
- Test: `apps/desktop/src/screens/Account.test.tsx`, using Vitest with mocked `invoke`.

**Behaviour:**
- **Signed out:**
  - an email field;
  - a "Send code" button, then a 6-digit code field and a "Verify" button;
  - a link "Use a password instead", which shows a password field and a "Sign in" button.
- **Signed in:**
  - the email;
  - "Last synced <relative time>";
  - "<n> changes waiting" (shown only if n > 0);
  - "<n> changes couldn't sync" (shown only if refused > 0);
  - the error text, if any;
  - a "Sync now" button and a "Sign out" button.
- **Unconfigured:** "Sync isn't set up in this build."

States `offline` and `error` show the error text from the status.

- [ ] **Step 1: Write failing tests:**
  - `shows_code_field_after_send`.
  - `verify_calls_cloud_verify_code_with_email_and_code`.
  - `signed_in_shows_pending_and_refused_counts`.
  - `unconfigured_shows_not_set_up`.
- [ ] **Step 2: Run** `bun run test`. Expected: fail.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `bun run test` and `bun run check`. Expected: pass.
- [ ] **Step 5: Manual end-to-end with the owner.** Run `bun run dev` and sign in with the email code using the owner's real account. Check:
  - habits, goals and tasks counts in `cloud_data` match the phone;
  - tick a habit on the phone, and within about 5 s `cloud-changed` fires and the row shows on the desktop;
  - a `cloud_set_completion` on the desktop appears on the phone after its next sync;
  - turn Wi-Fi off, tick on the desktop, and see the status `offline` with pending 1; turn Wi-Fi on, and within 30 s pending is 0.
- [ ] **Step 6: Commit** with the message `feat(ui): account and sync status`.

---

Plan 2 (the six tabs: Dashboard, Calendar, Progress, Friends, Profile, Settings) will be written after this plan ships. It builds on `cloud_data`, `cloud_save`, `cloud_set_completion`, `cloud_rpc`, `cloud_action`, the `cloud-changed` and `sync-status` events, and `src/shared/`.
