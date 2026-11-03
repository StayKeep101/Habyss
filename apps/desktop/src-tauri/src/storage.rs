use crate::{engine::{Change, Span}, models::*};
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use std::path::Path;
use uuid::Uuid;
pub type Result<T> = std::result::Result<T, Box<dyn std::error::Error + Send + Sync>>;
pub struct Store { pub conn: Connection, pub current_id: Option<String> }
impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.busy_timeout(std::time::Duration::from_secs(2))?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;")?;
        // user_version only rises for a change older builds cannot read; additive migrations are recorded in schema_migrations.
        // Pre-release cloud builds set it to 2 without recording anything past 1: that file is ours, and 001 puts it back to 1.
        // So a future breaking change must use 3 or more.
        let version: i64=conn.pragma_query_value(None,"user_version",|r|r.get(0))?;
        let ours=version==2 && conn.query_row("SELECT MAX(version) FROM schema_migrations",[],|r|r.get::<_,Option<i64>>(0)).ok().flatten()==Some(1);
        if version>1 && !ours { return Err("Database was created by a newer Habyss version".into()); }
        conn.execute_batch(include_str!("../migrations/001_initial.sql"))?;
        conn.execute_batch(include_str!("../migrations/002_cloud.sql"))?;
        // 003 adds columns, which SQLite cannot guard in SQL: check the table first, then record the migration.
        let have:Vec<String>=conn.prepare("PRAGMA table_info(focus_sessions)")?.query_map([],|r|r.get::<_,String>(1))?.collect::<rusqlite::Result<_>>()?;
        for (name,ddl) in [("paused_ms","INTEGER NOT NULL DEFAULT 0"),("paused_at","INTEGER"),("item_id","TEXT"),("item_kind","TEXT")] {
            if !have.iter().any(|c|c==name) { conn.execute_batch(&format!("ALTER TABLE focus_sessions ADD COLUMN {name} {ddl}"))?; }
        }
        conn.execute_batch(include_str!("../migrations/003_focus.sql"))?;
        // Persisted open intervals already end at their last durable heartbeat.
        // Running focus sessions recover at the same observation, never at launch time.
        // An open pause ends there too, so the pause never extends past the observation.
        conn.execute("UPDATE focus_sessions SET paused_ms=paused_ms+COALESCE(MAX(0,MAX(started_at,COALESCE((SELECT observed_at FROM checkpoint WHERE id=1),started_at))-paused_at),0),paused_at=NULL,ended_at=MAX(started_at,COALESCE((SELECT observed_at FROM checkpoint WHERE id=1),started_at)),state='interrupted' WHERE ended_at IS NULL",[])?;
        Ok(Self { conn, current_id: None })
    }
    pub fn settings(&self) -> Result<Settings> { let json: Option<String> = self.conn.query_row("SELECT json FROM settings WHERE id=1",[],|r|r.get(0)).optional()?; Ok(match json { Some(v) => serde_json::from_str(&v)?, None => Settings::default() }) }
    pub fn save_settings(&self, value: &Settings) -> Result<()> { self.conn.execute("INSERT INTO settings VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET json=excluded.json",[serde_json::to_string(value)?])?; Ok(()) }
    pub fn commit(&mut self, change: &Change, current: Option<&Span>, observed: i64) -> Result<()> {
        let tx = self.conn.transaction()?;
        if let Some(id) = &self.current_id { tx.execute("DELETE FROM intervals WHERE id=?1",[id])?; }
        if let Some(cut) = change.trim_after {
            tx.execute("DELETE FROM intervals WHERE state='active' AND started_at>=?1",[cut])?;
            tx.execute("UPDATE intervals SET ended_at=?1,updated_at=?2 WHERE state='active' AND ended_at>?1 AND started_at<?1",params![cut,observed])?;
        }
        for span in &change.completed { insert_span(&tx,&Uuid::new_v4().to_string(),span,observed)?; }
        let new_id=current.map(|_|Uuid::new_v4().to_string());
        if let (Some(span),Some(id))=(current,&new_id) { insert_span(&tx,id,span,observed)?; }
        tx.execute("INSERT INTO checkpoint VALUES(1,?1,?2) ON CONFLICT(id) DO UPDATE SET interval_id=excluded.interval_id,observed_at=excluded.observed_at",params![new_id,observed])?;
        tx.commit()?;
        self.current_id=new_id;
        Ok(())
    }
    pub fn intervals(&self, from: i64, to: i64) -> Result<Vec<Interval>> {
        let mut q=self.conn.prepare("SELECT i.id,i.application_id,COALESCE(a.display_name,''),a.bundle_id,i.window_title,i.started_at,i.ended_at,i.state,COALESCE(a.category_override,a.category,'uncategorized'),i.availability,COALESCE(i.pid,0),i.window_id FROM intervals i LEFT JOIN applications a ON a.id=i.application_id WHERE i.ended_at>?1 AND i.started_at<?2 ORDER BY i.started_at")?;
        let rows=q.query_map(params![from,to],|r|Ok(Interval { id:r.get(0)?, application_id:r.get(1)?,name:r.get(2)?,bundle_id:r.get(3)?,title:r.get(4)?,start:r.get(5)?,end:r.get(6)?,state:r.get(7)?,category:r.get(8)?,availability:r.get(9)?,pid:r.get(10)?,window_id:r.get(11)? }))?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }
    pub fn applications(&self) -> Result<Vec<Application>> { let mut q=self.conn.prepare("SELECT id,bundle_id,display_name,COALESCE(category_override,category),first_seen,last_seen FROM applications ORDER BY last_seen DESC")?; let rows=q.query_map([],|r|Ok(Application{id:r.get(0)?,bundle_id:r.get(1)?,name:r.get(2)?,category:r.get(3)?,first_seen:r.get(4)?,last_seen:r.get(5)?}))?; Ok(rows.collect::<rusqlite::Result<_>>()?) }
    fn focus_where(&self,clause:&str)->Result<Vec<FocusSession>> { let mut q=self.conn.prepare(&format!("SELECT id,label,started_at,ended_at,target_ms,state,paused_ms,paused_at,item_id,item_kind FROM focus_sessions {clause} ORDER BY started_at DESC"))?; let rows=q.query_map([],|r|Ok(FocusSession{id:r.get(0)?,label:r.get(1)?,start:r.get(2)?,end:r.get(3)?,target_ms:r.get(4)?,state:r.get(5)?,paused_ms:r.get(6)?,paused_at:r.get(7)?,item_id:r.get(8)?,item_kind:r.get(9)?}))?; Ok(rows.collect::<rusqlite::Result<_>>()?) }
    pub fn focus(&self) -> Result<Vec<FocusSession>> { self.focus_where("") }
    pub fn running_focus(&self) -> Result<Option<FocusSession>> { Ok(self.focus_where("WHERE ended_at IS NULL")?.into_iter().next()) }
    pub fn classifications(&self) -> Result<std::collections::HashMap<String,String>> { let mut q=self.conn.prepare("SELECT id,classification FROM categories")?; let rows=q.query_map([],|r|Ok((r.get(0)?,r.get(1)?)))?; Ok(rows.collect::<rusqlite::Result<_>>()?) }
    pub fn start_focus(&mut self,label:&str,target:i64,now:i64,item_id:Option<String>,item_kind:Option<String>)->Result<()> { let tx=self.conn.transaction()?; let running:i64=tx.query_row("SELECT COUNT(*) FROM focus_sessions WHERE ended_at IS NULL",[],|r|r.get(0))?; if running>0 { return Err("A focus session is already running".into()); } tx.execute("INSERT INTO focus_sessions(id,label,started_at,ended_at,target_ms,state,updated_at,item_id,item_kind) VALUES(?1,?2,?3,NULL,?4,'running',?3,?5,?6)",params![Uuid::new_v4().to_string(),label,now,target,item_id,item_kind])?; tx.commit()?; Ok(()) }
    pub fn pause_focus(&self,now:i64)->Result<()> { self.conn.execute("UPDATE focus_sessions SET paused_at=MAX(started_at,?1),updated_at=?1 WHERE ended_at IS NULL AND paused_at IS NULL",[now])?; Ok(()) }
    pub fn resume_focus(&self,now:i64)->Result<()> { self.conn.execute("UPDATE focus_sessions SET paused_ms=paused_ms+MAX(0,?1-paused_at),paused_at=NULL,updated_at=?1 WHERE ended_at IS NULL AND paused_at IS NOT NULL",[now])?; Ok(()) }
    pub fn stop_focus(&self,now:i64)->Result<()> { self.conn.execute("UPDATE focus_sessions SET paused_ms=paused_ms+COALESCE(MAX(0,?1-paused_at),0),paused_at=NULL,ended_at=MAX(started_at,?1),state='completed',updated_at=?1 WHERE ended_at IS NULL",[now])?; Ok(()) }
    /// Completes a running (not paused) session whose target is reached, ending it at start + target + pauses.
    pub fn complete_due_focus(&self,now:i64)->Result<bool> { Ok(self.conn.execute("UPDATE focus_sessions SET ended_at=started_at+target_ms+paused_ms,state='completed',updated_at=?1 WHERE ended_at IS NULL AND paused_at IS NULL AND started_at+target_ms+paused_ms<=?1",[now])?>0) }
    pub fn erase(&mut self)->Result<()> { let tx=self.conn.transaction()?; tx.execute_batch("DELETE FROM intervals; DELETE FROM applications; DELETE FROM focus_sessions; DELETE FROM checkpoint;")?; tx.commit()?; self.current_id=None; self.conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;")?; Ok(()) }
    pub fn retention(&self, cutoff:i64)->Result<()> { self.conn.execute("DELETE FROM intervals WHERE ended_at<?1",[cutoff])?; self.conn.execute("DELETE FROM focus_sessions WHERE ended_at<?1",[cutoff])?; Ok(()) }
}
fn insert_span(tx:&Transaction<'_>,id:&str,span:&Span,now:i64)->Result<()> {
    if span.end<=span.start { return Ok(()); }
    let c=&span.context;
    let app_id=if let Some(bundle)=&c.app {
        tx.execute("INSERT INTO applications(id,bundle_id,display_name,first_seen,last_seen) VALUES(?1,?2,?3,?4,?5) ON CONFLICT(bundle_id) DO UPDATE SET display_name=excluded.display_name,last_seen=MAX(last_seen,excluded.last_seen)",params![Uuid::new_v4().to_string(),bundle,c.name,span.start,span.end])?;
        Some(tx.query_row("SELECT id FROM applications WHERE bundle_id=?1",[bundle],|r|r.get::<_,String>(0))?)
    } else { None };
    tx.execute("INSERT INTO intervals(id,application_id,window_title,started_at,ended_at,state,source,availability,pid,window_id,updated_at) VALUES(?1,?2,?3,?4,?5,?6,'macos-native',?7,?8,?9,?10)",params![id,app_id,c.title,span.start,span.end,c.state,c.availability,c.pid,c.window_id,now])?;
    Ok(())
}
#[cfg(test)] mod tests {
    use super::*; use crate::engine::Context;
    #[test] fn recovery_and_transaction_rollback() { let dir=tempfile::tempdir().unwrap();let path=dir.path().join("test.sqlite"); let mut s=Store::open(&path).unwrap(); let span=Span{start:100,end:200,context:Context::inactive("idle")}; s.commit(&Change::default(),Some(&span),200).unwrap(); s.start_focus("Focus",1000,100,None,None).unwrap(); s.conn.execute_batch("CREATE TRIGGER fail_insert BEFORE INSERT ON intervals BEGIN SELECT RAISE(ABORT,'injected failure'); END;").unwrap(); assert!(s.commit(&Change::default(),Some(&Span{end:300,..span}),300).is_err()); assert_eq!(s.intervals(0,1000).unwrap()[0].end,200);drop(s);let s=Store::open(&path).unwrap();assert_eq!(s.focus().unwrap()[0].end,Some(200));assert_eq!(s.intervals(0,1000).unwrap().len(),1); }
    #[test] fn idle_trim_removes_prior_apps() { let mut s=Store::open(Path::new(":memory:")).unwrap();let mut c=Context::inactive("active");c.app=Some("a".into());let span=Span{start:0,end:100,context:c};s.commit(&Change{completed:vec![span],trim_after:None},None,100).unwrap();s.commit(&Change{completed:vec![],trim_after:Some(30)},None,150).unwrap();assert_eq!(s.intervals(0,200).unwrap()[0].end,30); }
    #[test]
    fn migrations_are_idempotent_and_future_versions_are_rejected() {
        let dir = tempfile::tempdir().unwrap();let path = dir.path().join("db");
        let store = Store::open(&path).unwrap();
        store.save_settings(&Settings { collect_titles: true, ..Settings::default() }).unwrap();
        drop(store);let store = Store::open(&path).unwrap();assert!(store.settings().unwrap().collect_titles);
        store.conn.pragma_update(None, "user_version", 999).unwrap();drop(store);
        assert!(Store::open(&path).is_err());
    }
    fn version(s: &Store) -> (i64, Vec<i64>) {
        let v = s.conn.pragma_query_value(None, "user_version", |r| r.get(0)).unwrap();
        let mut q = s.conn.prepare("SELECT version FROM schema_migrations ORDER BY version").unwrap();
        (v, q.query_map([], |r| r.get(0)).unwrap().collect::<rusqlite::Result<_>>().unwrap())
    }
    #[test]
    fn cloud_migration_keeps_the_file_readable_by_older_builds() {
        let dir = tempfile::tempdir().unwrap();let path = dir.path().join("db");
        drop(Store::open(&path).unwrap());
        let s = Store::open(&path).unwrap();
        // Older builds open anything up to user_version 1.
        assert_eq!(version(&s), (1, vec![1, 2, 3]));
    }
    #[test]
    fn pre_release_version_2_opens_and_goes_back_to_1() {
        let dir = tempfile::tempdir().unwrap();let path = dir.path().join("db");
        let s = Store::open(&path).unwrap();
        s.conn.execute_batch("DELETE FROM schema_migrations WHERE version IN (2,3); PRAGMA user_version=2;").unwrap();drop(s);
        let s = Store::open(&path).unwrap();
        assert_eq!(version(&s), (1, vec![1, 2, 3]));
        // A 2 from a genuinely newer schema, which records its own migrations, is still refused.
        s.conn.execute_batch("INSERT INTO schema_migrations VALUES(4,0); PRAGMA user_version=2;").unwrap();drop(s);
        assert!(Store::open(&path).is_err());
    }
    #[test]
    fn deleting_history_keeps_preferences_and_removes_checkpoint() {
        let mut store = Store::open(Path::new(":memory:")).unwrap();
        store.save_settings(&Settings::default()).unwrap();
        store.commit(&Change::default(),Some(&Span { start:100,end:200,context:Context::inactive("idle") }),200).unwrap();
        store.start_focus("Intent",1000,100,None,None).unwrap();store.erase().unwrap();
        assert!(store.intervals(0,1000).unwrap().is_empty());assert!(store.focus().unwrap().is_empty());
        assert_eq!(store.conn.query_row("SELECT COUNT(*) FROM checkpoint",[],|r|r.get::<_,i64>(0)).unwrap(),0);
        assert_eq!(store.settings().unwrap().idle_threshold,120);
    }

    #[test]
    fn focus_rejects_competing_sessions_and_stops_once() {
        let mut s=Store::open(Path::new(":memory:")).unwrap();
        s.start_focus("Intent",60000,100,None,None).unwrap();assert!(s.start_focus("Duplicate",60000,200,None,None).is_err());
        s.stop_focus(500).unwrap();s.stop_focus(600).unwrap();
        let sessions=s.focus().unwrap();assert_eq!(sessions.len(),1);assert_eq!(sessions[0].end,Some(500));
    }

    #[test]
    fn pause_resume_accumulates() {
        let mut s=Store::open(Path::new(":memory:")).unwrap();
        s.start_focus("Intent",600000,0,Some("h1".into()),Some("habit".into())).unwrap();
        s.pause_focus(1000).unwrap();s.pause_focus(1500).unwrap();
        let f=&s.focus().unwrap()[0];assert_eq!((f.paused_at,f.paused_ms),(Some(1000),0));
        s.resume_focus(4000).unwrap();s.resume_focus(4500).unwrap();s.pause_focus(5000).unwrap();s.resume_focus(5500).unwrap();
        let f=&s.focus().unwrap()[0];assert_eq!((f.paused_at,f.paused_ms),(None,3500));
        assert_eq!((f.item_id.as_deref(),f.item_kind.as_deref()),(Some("h1"),Some("habit")));
    }
    #[test]
    fn stop_while_paused_closes_pause() {
        let mut s=Store::open(Path::new(":memory:")).unwrap();
        s.start_focus("Intent",600000,0,None,None).unwrap();s.pause_focus(1000).unwrap();s.stop_focus(4000).unwrap();
        let f=&s.focus().unwrap()[0];assert_eq!((f.end,f.paused_at,f.paused_ms,f.state.as_str()),(Some(4000),None,3000,"completed"));
    }
    #[test]
    fn due_sessions_complete_at_target_plus_pauses() {
        let mut s=Store::open(Path::new(":memory:")).unwrap();
        s.start_focus("Intent",1000,0,None,None).unwrap();s.pause_focus(200).unwrap();s.resume_focus(500).unwrap();
        assert!(!s.complete_due_focus(1200).unwrap());
        assert!(s.complete_due_focus(9000).unwrap());
        let f=&s.focus().unwrap()[0];assert_eq!((f.end,f.state.as_str()),(Some(1300),"completed"));
        s.start_focus("Paused",1000,10000,None,None).unwrap();s.pause_focus(10100).unwrap();
        assert!(!s.complete_due_focus(99999).unwrap());
    }
    #[test]
    fn recovery_closes_open_pause_at_checkpoint() {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("db");
        let mut s=Store::open(&path).unwrap();
        s.commit(&Change::default(),Some(&Span{start:100,end:900,context:Context::inactive("idle")}),900).unwrap();
        s.start_focus("Intent",60000,100,None,None).unwrap();s.pause_focus(400).unwrap();drop(s);
        let f=&Store::open(&path).unwrap().focus().unwrap()[0];
        assert_eq!((f.end,f.paused_at,f.paused_ms,f.state.as_str()),(Some(900),None,500,"interrupted"));
    }
    #[test]
    fn migration_003_idempotent_records_3_and_keeps_user_version_1() {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("db");
        drop(Store::open(&path).unwrap());drop(Store::open(&path).unwrap());
        let s=Store::open(&path).unwrap();assert_eq!(version(&s),(1,vec![1,2,3]));
        // A file recorded without 003 (columns already present) is repaired without error.
        s.conn.execute("DELETE FROM schema_migrations WHERE version=3",[]).unwrap();drop(s);
        let s=Store::open(&path).unwrap();assert_eq!(version(&s),(1,vec![1,2,3]));
    }
    #[test]
    fn old_rows_get_zero_paused_ms() {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("db");
        let s=Store::open(&path).unwrap();
        s.conn.execute_batch("ALTER TABLE focus_sessions DROP COLUMN paused_ms; ALTER TABLE focus_sessions DROP COLUMN paused_at; ALTER TABLE focus_sessions DROP COLUMN item_id; ALTER TABLE focus_sessions DROP COLUMN item_kind; DELETE FROM schema_migrations WHERE version=3; INSERT INTO focus_sessions VALUES('old','Old',0,500,1000,'completed',500);").unwrap();drop(s);
        let f=&Store::open(&path).unwrap().focus().unwrap()[0];
        assert_eq!((f.paused_ms,f.paused_at,f.item_id.clone()),(0,None,None));
    }
    #[test]
    fn snapshot_includes_classifications() {
        let dir=tempfile::tempdir().unwrap();let s=crate::service::Service::open(dir.path().into()).unwrap();
        s.store.conn.execute("UPDATE categories SET classification='productive' WHERE id='development'",[]).unwrap();
        let c=s.snapshot(0,10).unwrap().classifications;
        assert_eq!(c.get("development").map(String::as_str),Some("productive"));assert_eq!(c.get("personal").map(String::as_str),Some("neutral"));
    }

}
