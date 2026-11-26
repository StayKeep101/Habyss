use crate::{engine::{Change, Span}, models::*};
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use std::path::Path;
use uuid::Uuid;
pub type Result<T> = std::result::Result<T, Box<dyn std::error::Error + Send + Sync>>;
pub struct Store { pub conn: Connection, pub current_id: Option<String> }
impl Store {
    pub fn open(path: &Path) -> Result<Self> {
        let mut conn = Connection::open(path)?;
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
        conn.execute_batch(include_str!("../migrations/003_focus.sql"))?;
        conn.execute_batch(include_str!("../migrations/005_depth.sql"))?;
        conn.execute_batch(include_str!("../migrations/006_day_inputs.sql"))?;
        // A habit's anchor (held before or after an event or meal) arrived after cloud_habits existed: added once, in place.
        let habit_cols:Vec<String>=conn.prepare("PRAGMA table_info(cloud_habits)")?.query_map([],|r|r.get::<_,String>(1))?.collect::<rusqlite::Result<_>>()?;
        if !habit_cols.iter().any(|c|c=="anchor") { conn.execute_batch("ALTER TABLE cloud_habits ADD COLUMN anchor TEXT")?; }
        // focus_sessions keeps the seven columns of 001, so older builds that open this file (user_version 1) can still insert
        // positionally; the extras live in focus_session_extras (004). A file that 003 gave the extra columns has them copied
        // across and dropped, all in one transaction.
        let have:Vec<String>=conn.prepare("PRAGMA table_info(focus_sessions)")?.query_map([],|r|r.get::<_,String>(1))?.collect::<rusqlite::Result<_>>()?;
        let old:Vec<&str>=["paused_ms","paused_at","item_id","item_kind"].into_iter().filter(|c|have.iter().any(|h|h==c)).collect();
        let tx=conn.transaction()?;
        tx.execute_batch(include_str!("../migrations/004_focus_extras.sql"))?;
        if !old.is_empty() {
            let col=|name:&str,none:&'static str|if old.contains(&name) {name.to_string()} else {none.to_string()};
            tx.execute(&format!("INSERT OR IGNORE INTO focus_session_extras(session_id,paused_ms,paused_at,item_id,item_kind) SELECT id,COALESCE({},0),{},{},{} FROM focus_sessions",col("paused_ms","0"),col("paused_at","NULL"),col("item_id","NULL"),col("item_kind","NULL")),[])?;
            for name in &old { tx.execute_batch(&format!("ALTER TABLE focus_sessions DROP COLUMN {name}"))?; }
        }
        // Persisted open intervals already end at their last durable heartbeat.
        // Running focus sessions recover at the same observation, never at launch time.
        // An open pause ends there too, so the pause never extends past the observation.
        tx.execute("UPDATE focus_session_extras SET paused_ms=paused_ms+(SELECT MAX(0,MAX(f.started_at,COALESCE((SELECT observed_at FROM checkpoint WHERE id=1),f.started_at))-focus_session_extras.paused_at) FROM focus_sessions f WHERE f.id=focus_session_extras.session_id),paused_at=NULL WHERE paused_at IS NOT NULL AND session_id IN (SELECT id FROM focus_sessions WHERE ended_at IS NULL)",[])?;
        tx.execute("UPDATE focus_sessions SET ended_at=MAX(started_at,COALESCE((SELECT observed_at FROM checkpoint WHERE id=1),started_at)),state='interrupted' WHERE ended_at IS NULL",[])?;
        tx.commit()?;
        Ok(Self { conn, current_id: None })
    }
    pub fn settings(&self) -> Result<Settings> { let json: Option<String> = self.conn.query_row("SELECT json FROM settings WHERE id=1",[],|r|r.get(0)).optional()?; Ok(match json { Some(v) => serde_json::from_str(&v)?, None => Settings::default() }) }
    pub fn save_settings(&self, value: &Settings) -> Result<()> { self.conn.execute("INSERT INTO settings VALUES(1,?1) ON CONFLICT(id) DO UPDATE SET json=excluded.json",[serde_json::to_string(value)?])?; Ok(()) }
    pub fn commit(&mut self, change: &Change, current: Option<&Span>, observed: i64) -> Result<()> {
        let tx = self.conn.transaction()?;
        if let Some(id) = &self.current_id { tx.execute("DELETE FROM interval_details WHERE interval_id=?1",[id])?; tx.execute("DELETE FROM intervals WHERE id=?1",[id])?; }
        if let Some(cut) = change.trim_after {
            // Only observed time is trimmed: a manual entry is the user's own account of the time.
            tx.execute("DELETE FROM interval_details WHERE interval_id IN (SELECT id FROM intervals WHERE state='active' AND source!='manual' AND started_at>=?1)",[cut])?;
            tx.execute("DELETE FROM intervals WHERE state='active' AND source!='manual' AND started_at>=?1",[cut])?;
            tx.execute("UPDATE intervals SET ended_at=?1,updated_at=?2 WHERE state='active' AND source!='manual' AND ended_at>?1 AND started_at<?1",params![cut,observed])?;
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
        let mut q=self.conn.prepare("SELECT i.id,i.application_id,COALESCE(a.display_name,''),a.bundle_id,i.window_title,i.started_at,i.ended_at,i.state,COALESCE(a.category_override,a.category,'uncategorized'),i.availability,COALESCE(i.pid,0),i.window_id,d.url,d.domain,d.document_path,COALESCE(d.typing_ms,0),COALESCE(d.pointer_ms,0),COALESCE(d.meeting_ms,0),COALESCE(d.media_ms,0),a.category_override IS NOT NULL FROM intervals i LEFT JOIN applications a ON a.id=i.application_id LEFT JOIN interval_details d ON d.interval_id=i.id WHERE i.ended_at>?1 AND i.started_at<?2 ORDER BY i.started_at")?;
        let rows=q.query_map(params![from,to],|r|{
            let mut i=Interval { id:r.get(0)?, application_id:r.get(1)?,name:r.get(2)?,bundle_id:r.get(3)?,title:r.get(4)?,start:r.get(5)?,end:r.get(6)?,state:r.get(7)?,category:r.get(8)?,availability:r.get(9)?,pid:r.get(10)?,window_id:r.get(11)?,url:r.get(12)?,domain:r.get(13)?,document:r.get(14)?,typing_ms:r.get(15)?,pointer_ms:r.get(16)?,meeting_ms:r.get(17)?,media_ms:r.get(18)? };
            refine_category(&mut i,r.get(19)?); Ok(i)
        })?;
        Ok(rows.collect::<rusqlite::Result<_>>()?)
    }
    pub fn category_overridden(&self,bundle:Option<&str>)->Result<bool> { let Some(b)=bundle else { return Ok(false) }; Ok(self.conn.query_row("SELECT category_override IS NOT NULL FROM applications WHERE bundle_id=?1",[b],|r|r.get::<_,bool>(0)).optional()?.unwrap_or(false)) }
    pub fn applications(&self) -> Result<Vec<Application>> { let mut q=self.conn.prepare("SELECT id,bundle_id,display_name,COALESCE(category_override,category),first_seen,last_seen FROM applications ORDER BY last_seen DESC")?; let rows=q.query_map([],|r|Ok(Application{id:r.get(0)?,bundle_id:r.get(1)?,name:r.get(2)?,category:r.get(3)?,first_seen:r.get(4)?,last_seen:r.get(5)?}))?; Ok(rows.collect::<rusqlite::Result<_>>()?) }
    fn focus_where(&self,clause:&str)->Result<Vec<FocusSession>> { let mut q=self.conn.prepare(&format!("SELECT f.id,f.label,f.started_at,f.ended_at,f.target_ms,f.state,COALESCE(e.paused_ms,0),e.paused_at,e.item_id,e.item_kind FROM focus_sessions f LEFT JOIN focus_session_extras e ON e.session_id=f.id {clause} ORDER BY f.started_at DESC"))?; let rows=q.query_map([],|r|Ok(FocusSession{id:r.get(0)?,label:r.get(1)?,start:r.get(2)?,end:r.get(3)?,target_ms:r.get(4)?,state:r.get(5)?,paused_ms:r.get(6)?,paused_at:r.get(7)?,item_id:r.get(8)?,item_kind:r.get(9)?}))?; Ok(rows.collect::<rusqlite::Result<_>>()?) }
    pub fn focus(&self) -> Result<Vec<FocusSession>> { self.focus_where("") }
    pub fn running_focus(&self) -> Result<Option<FocusSession>> { Ok(self.focus_where("WHERE f.ended_at IS NULL")?.into_iter().next()) }
    pub fn classifications(&self) -> Result<std::collections::HashMap<String,String>> { let mut q=self.conn.prepare("SELECT id,classification FROM categories")?; let rows=q.query_map([],|r|Ok((r.get(0)?,r.get(1)?)))?; Ok(rows.collect::<rusqlite::Result<_>>()?) }
    pub fn start_focus(&mut self,label:&str,target:i64,now:i64,item_id:Option<String>,item_kind:Option<String>)->Result<()> { let tx=self.conn.transaction()?; let running:i64=tx.query_row("SELECT COUNT(*) FROM focus_sessions WHERE ended_at IS NULL",[],|r|r.get(0))?; if running>0 { return Err("A focus session is already running".into()); } let id=Uuid::new_v4().to_string(); tx.execute("INSERT INTO focus_sessions(id,label,started_at,ended_at,target_ms,state,updated_at) VALUES(?1,?2,?3,NULL,?4,'running',?3)",params![id,label,now,target])?; tx.execute("INSERT INTO focus_session_extras(session_id,item_id,item_kind) VALUES(?1,?2,?3)",params![id,item_id,item_kind])?; tx.commit()?; Ok(()) }
    /// Applies `set` (an assignment and its WHERE) to the running session's extras row, creating the row for a session an older build started.
    fn running_extras(&self,now:i64,set:&str)->Result<()> {
        let tx=self.conn.unchecked_transaction()?;
        tx.execute("INSERT OR IGNORE INTO focus_session_extras(session_id) SELECT id FROM focus_sessions WHERE ended_at IS NULL",[])?;
        if tx.execute(&format!("UPDATE focus_session_extras SET {set} AND session_id IN (SELECT id FROM focus_sessions WHERE ended_at IS NULL)"),[now])?>0 { tx.execute("UPDATE focus_sessions SET updated_at=?1 WHERE ended_at IS NULL",[now])?; }
        tx.commit()?; Ok(())
    }
    pub fn pause_focus(&self,now:i64)->Result<()> { self.running_extras(now,"paused_at=(SELECT MAX(started_at,?1) FROM focus_sessions WHERE id=session_id) WHERE paused_at IS NULL") }
    pub fn resume_focus(&self,now:i64)->Result<()> { self.running_extras(now,"paused_ms=paused_ms+MAX(0,?1-paused_at),paused_at=NULL WHERE paused_at IS NOT NULL") }
    pub fn stop_focus(&self,now:i64)->Result<()> {
        let tx=self.conn.unchecked_transaction()?;
        tx.execute("UPDATE focus_session_extras SET paused_ms=paused_ms+MAX(0,?1-paused_at),paused_at=NULL WHERE paused_at IS NOT NULL AND session_id IN (SELECT id FROM focus_sessions WHERE ended_at IS NULL)",[now])?;
        tx.execute("UPDATE focus_sessions SET ended_at=MAX(started_at,?1),state='completed',updated_at=?1 WHERE ended_at IS NULL",[now])?;
        tx.commit()?; Ok(())
    }
    /// Completes a running (not paused) session whose target is reached, ending it at start + target + pauses.
    pub fn complete_due_focus(&self,now:i64)->Result<bool> { Ok(self.conn.execute("UPDATE focus_sessions SET ended_at=started_at+target_ms+COALESCE((SELECT paused_ms FROM focus_session_extras WHERE session_id=focus_sessions.id),0),state='completed',updated_at=?1 WHERE ended_at IS NULL AND NOT EXISTS(SELECT 1 FROM focus_session_extras WHERE session_id=focus_sessions.id AND paused_at IS NOT NULL) AND started_at+target_ms+COALESCE((SELECT paused_ms FROM focus_session_extras WHERE session_id=focus_sessions.id),0)<=?1",[now])?>0) }
    /// Time logged by hand ("Reading on paper", 14:00–14:30): an active interval marked manual, under its own app name,
    /// or under `bundle` when it was time in a known app. `note` becomes its title.
    pub fn log_time(&self,name:&str,bundle:Option<&str>,start:i64,end:i64,note:Option<&str>,now:i64)->Result<()> {
        let name=name.trim();
        if name.is_empty() || name.chars().count()>200 { return Err("Name the time you are logging".into()); }
        if end<=start || end-start>24*3_600_000 { return Err("Choose an end after the start, within a day".into()); }
        let tx=self.conn.unchecked_transaction()?;
        let key=bundle.map(str::to_string).unwrap_or_else(|| format!("manual:{}",name.to_lowercase()));
        tx.execute("INSERT INTO applications(id,bundle_id,display_name,first_seen,last_seen,category) VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(bundle_id) DO UPDATE SET last_seen=MAX(last_seen,excluded.last_seen)",params![Uuid::new_v4().to_string(),key,name,start,end,crate::categorize::app_category(&key)])?;
        let app:String=tx.query_row("SELECT id FROM applications WHERE bundle_id=?1",[&key],|r|r.get(0))?;
        let title=note.map(str::trim).filter(|n|!n.is_empty()).unwrap_or(name);
        tx.execute("INSERT INTO intervals(id,application_id,window_title,started_at,ended_at,state,source,availability,pid,window_id,updated_at) VALUES(?1,?2,?3,?4,?5,'active','manual','manual',0,NULL,?6)",params![Uuid::new_v4().to_string(),app,title,start,end,now])?;
        tx.commit()?;
        Ok(())
    }
    pub fn erase(&mut self)->Result<()> { let tx=self.conn.transaction()?; tx.execute_batch("DELETE FROM interval_details; DELETE FROM intervals; DELETE FROM applications; DELETE FROM focus_session_extras; DELETE FROM focus_sessions; DELETE FROM checkpoint;")?; tx.commit()?; self.current_id=None; self.conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;")?; Ok(()) }
    /// Old sessions take their extras with them (ON DELETE CASCADE).
    pub fn retention(&self, cutoff:i64)->Result<()> { self.conn.execute("DELETE FROM interval_details WHERE interval_id IN (SELECT id FROM intervals WHERE ended_at<?1)",[cutoff])?; self.conn.execute("DELETE FROM intervals WHERE ended_at<?1",[cutoff])?; self.conn.execute("DELETE FROM focus_sessions WHERE ended_at<?1",[cutoff])?; Ok(()) }
}
fn insert_span(tx:&Transaction<'_>,id:&str,span:&Span,now:i64)->Result<()> {
    if span.end<=span.start { return Ok(()); }
    let c=&span.context;
    let app_id=if let Some(bundle)=&c.app {
        // A built-in category fills in only while the app is still uncategorized; the user's override is a separate column.
        tx.execute("INSERT INTO applications(id,bundle_id,display_name,first_seen,last_seen,category) VALUES(?1,?2,?3,?4,?5,?6) ON CONFLICT(bundle_id) DO UPDATE SET display_name=excluded.display_name,last_seen=MAX(last_seen,excluded.last_seen),category=CASE WHEN category='uncategorized' THEN excluded.category ELSE category END",params![Uuid::new_v4().to_string(),bundle,c.name,span.start,span.end,crate::categorize::app_category(bundle)])?;
        Some(tx.query_row("SELECT id FROM applications WHERE bundle_id=?1",[bundle],|r|r.get::<_,String>(0))?)
    } else { None };
    tx.execute("INSERT INTO intervals(id,application_id,window_title,started_at,ended_at,state,source,availability,pid,window_id,updated_at) VALUES(?1,?2,?3,?4,?5,?6,'macos-native',?7,?8,?9,?10)",params![id,app_id,c.title,span.start,span.end,c.state,c.availability,c.pid,c.window_id,now])?;
    let a=&span.activity;
    if c.url.is_some() || c.document.is_some() || *a!=Default::default() {
        let domain=c.url.as_deref().and_then(crate::categorize::domain);
        tx.execute("INSERT INTO interval_details(interval_id,url,domain,document_path,typing_ms,pointer_ms,meeting_ms,media_ms) VALUES(?1,?2,?3,?4,?5,?6,?7,?8)",params![id,c.url,domain,c.document,a.typing_ms,a.pointer_ms,a.meeting_ms,a.media_ms])?;
    }
    Ok(())
}
/// A known website decides a browser span's category, and a span that is mostly a call is a meeting,
/// unless the user chose the app's category themselves.
pub fn refine_category(i:&mut Interval,overridden:bool) {
    if overridden || i.state!="active" { return; }
    if let Some(c)=i.domain.as_deref().and_then(crate::categorize::domain_category) { i.category=c.into(); }
    if i.meeting_ms*2>=(i.end-i.start).max(1) && i.category!="development" { i.category="meetings".into(); }
}
#[cfg(test)] mod tests {
    use super::*; use crate::engine::Context;
    #[test] fn recovery_and_transaction_rollback() { let dir=tempfile::tempdir().unwrap();let path=dir.path().join("test.sqlite"); let mut s=Store::open(&path).unwrap(); let span=Span{start:100,end:200,context:Context::inactive("idle"),..Default::default()}; s.commit(&Change::default(),Some(&span),200).unwrap(); s.start_focus("Focus",1000,100,None,None).unwrap(); s.conn.execute_batch("CREATE TRIGGER fail_insert BEFORE INSERT ON intervals BEGIN SELECT RAISE(ABORT,'injected failure'); END;").unwrap(); assert!(s.commit(&Change::default(),Some(&Span{end:300,..span}),300).is_err()); assert_eq!(s.intervals(0,1000).unwrap()[0].end,200);drop(s);let s=Store::open(&path).unwrap();assert_eq!(s.focus().unwrap()[0].end,Some(200));assert_eq!(s.intervals(0,1000).unwrap().len(),1); }
    #[test] fn idle_trim_removes_prior_apps() { let mut s=Store::open(Path::new(":memory:")).unwrap();let mut c=Context::inactive("active");c.app=Some("a".into());let span=Span{start:0,end:100,context:c,..Default::default()};s.commit(&Change{completed:vec![span],trim_after:None},None,100).unwrap();s.commit(&Change{completed:vec![],trim_after:Some(30)},None,150).unwrap();assert_eq!(s.intervals(0,200).unwrap()[0].end,30); }
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
        assert_eq!(version(&s), (1, vec![1, 2, 3, 4, 5, 6]));
    }
    #[test]
    fn pre_release_version_2_opens_and_goes_back_to_1() {
        let dir = tempfile::tempdir().unwrap();let path = dir.path().join("db");
        let s = Store::open(&path).unwrap();
        s.conn.execute_batch("DELETE FROM schema_migrations WHERE version IN (2,3,4,5,6); PRAGMA user_version=2;").unwrap();drop(s);
        let s = Store::open(&path).unwrap();
        assert_eq!(version(&s), (1, vec![1, 2, 3, 4, 5, 6]));
        // A 2 from a genuinely newer schema, which records its own migrations, is still refused.
        s.conn.execute_batch("INSERT INTO schema_migrations VALUES(99,0); PRAGMA user_version=2;").unwrap();drop(s);
        assert!(Store::open(&path).is_err());
    }
    #[test]
    fn deleting_history_keeps_preferences_and_removes_checkpoint() {
        let mut store = Store::open(Path::new(":memory:")).unwrap();
        store.save_settings(&Settings::default()).unwrap();
        store.commit(&Change::default(),Some(&Span { start:100,end:200,context:Context::inactive("idle"),..Default::default() }),200).unwrap();
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
        s.commit(&Change::default(),Some(&Span{start:100,end:900,context:Context::inactive("idle"),..Default::default()}),900).unwrap();
        s.start_focus("Intent",60000,100,None,None).unwrap();s.pause_focus(400).unwrap();drop(s);
        let f=&Store::open(&path).unwrap().focus().unwrap()[0];
        assert_eq!((f.end,f.paused_at,f.paused_ms,f.state.as_str()),(Some(900),None,500,"interrupted"));
    }
    #[test]
    fn migrations_003_004_idempotent_and_keep_user_version_1() {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("db");
        drop(Store::open(&path).unwrap());drop(Store::open(&path).unwrap());
        let s=Store::open(&path).unwrap();assert_eq!(version(&s),(1,vec![1,2,3,4,5,6]));
        // A file recorded without 003 or 004 (side table already present) is repaired without error.
        s.conn.execute("DELETE FROM schema_migrations WHERE version IN (3,4)",[]).unwrap();drop(s);
        let s=Store::open(&path).unwrap();assert_eq!(version(&s),(1,vec![1,2,3,4,5,6]));
    }
    /// The insert every build up to c259b9d makes: seven positional values.
    const OLDER_BUILD_INSERT: &str = "INSERT INTO focus_sessions VALUES(?1,?2,?3,NULL,?4,'running',?3)";
    fn columns(s:&Store,table:&str)->Vec<String> { s.conn.prepare(&format!("PRAGMA table_info({table})")).unwrap().query_map([],|r|r.get::<_,String>(1)).unwrap().collect::<rusqlite::Result<_>>().unwrap() }
    #[test]
    fn older_build_insert_still_works_and_reads_zero_pauses() {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("db");
        let s=Store::open(&path).unwrap();
        assert_eq!(columns(&s,"focus_sessions"),["id","label","started_at","ended_at","target_ms","state","updated_at"]);
        s.conn.execute(OLDER_BUILD_INSERT,params!["old","Old",1000,60000]).unwrap();
        let f=&s.focus().unwrap()[0];
        assert_eq!((f.paused_ms,f.paused_at,f.item_id.clone(),f.end),(0,None,None,None));
        // This build can pause, resume and stop a session an older build started.
        s.pause_focus(2000).unwrap();s.resume_focus(2500).unwrap();s.pause_focus(3000).unwrap();s.stop_focus(4000).unwrap();
        let f=&s.focus().unwrap()[0];
        assert_eq!((f.end,f.paused_at,f.paused_ms,f.state.as_str()),(Some(4000),None,1500,"completed"));
        // And an older build can still finish a session this build started.
        drop(s);let mut s=Store::open(&path).unwrap();
        s.start_focus("New",60000,5000,Some("h1".into()),Some("habit".into())).unwrap();
        s.conn.execute("UPDATE focus_sessions SET ended_at=?1,state='completed',updated_at=?1 WHERE ended_at IS NULL",[9000]).unwrap();
        assert_eq!(s.focus().unwrap()[0].item_id.as_deref(),Some("h1"));
    }
    /// The owner's dev database: 003 put the extras on focus_sessions itself.
    fn as_003(path:&Path,rows:&str) {
        let s=Store::open(path).unwrap();
        s.conn.execute_batch(&format!("DROP TABLE focus_session_extras; DELETE FROM schema_migrations WHERE version=4; ALTER TABLE focus_sessions ADD COLUMN paused_ms INTEGER NOT NULL DEFAULT 0; ALTER TABLE focus_sessions ADD COLUMN paused_at INTEGER; ALTER TABLE focus_sessions ADD COLUMN item_id TEXT; ALTER TABLE focus_sessions ADD COLUMN item_kind TEXT; {rows}")).unwrap();
    }
    #[test]
    fn migration_004_moves_003_columns_into_the_side_table() {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("db");
        as_003(&path,"INSERT INTO focus_sessions VALUES('done','Done',0,5000,1000,'completed',5000,700,NULL,'t1','task'); INSERT INTO focus_sessions(id,label,started_at,ended_at,target_ms,state,updated_at) VALUES('plain','Plain',0,500,1000,'completed',500);");
        let s=Store::open(&path).unwrap();
        assert_eq!(columns(&s,"focus_sessions"),["id","label","started_at","ended_at","target_ms","state","updated_at"]);
        assert_eq!(version(&s),(1,vec![1,2,3,4,5,6]));
        let all=s.focus().unwrap();
        let done=all.iter().find(|f|f.id=="done").unwrap();
        assert_eq!((done.paused_ms,done.item_id.as_deref(),done.item_kind.as_deref()),(700,Some("t1"),Some("task")));
        let plain=all.iter().find(|f|f.id=="plain").unwrap();
        assert_eq!((plain.paused_ms,plain.paused_at,plain.item_id.clone()),(0,None,None));
        s.conn.execute(OLDER_BUILD_INSERT,params!["old","Old",1000,60000]).unwrap();
        drop(s);let s=Store::open(&path).unwrap();assert_eq!(version(&s),(1,vec![1,2,3,4,5,6]));
    }
    #[test]
    fn migration_004_recovers_an_open_pause_from_003_columns() {
        let dir=tempfile::tempdir().unwrap();let path=dir.path().join("db");
        let mut s=Store::open(&path).unwrap();
        s.commit(&Change::default(),Some(&Span{start:100,end:900,context:Context::inactive("idle"),..Default::default()}),900).unwrap();drop(s);
        as_003(&path,"INSERT INTO focus_sessions VALUES('open','Open',100,NULL,60000,'running',100,50,400,NULL,NULL);");
        let s=Store::open(&path).unwrap();
        let all=s.focus().unwrap();let f=all.iter().find(|f|f.id=="open").unwrap();
        assert_eq!((f.end,f.paused_at,f.paused_ms,f.state.as_str()),(Some(900),None,550,"interrupted"));
    }
    #[test]
    fn erase_and_retention_clear_extras() {
        let mut s=Store::open(Path::new(":memory:")).unwrap();
        let extras=|s:&Store|s.conn.query_row("SELECT COUNT(*) FROM focus_session_extras",[],|r|r.get::<_,i64>(0)).unwrap();
        s.start_focus("A",1000,0,Some("h1".into()),Some("habit".into())).unwrap();s.stop_focus(100).unwrap();
        s.start_focus("B",1000,5000,None,None).unwrap();s.stop_focus(6000).unwrap();
        assert_eq!(extras(&s),2);
        s.retention(1000).unwrap();assert_eq!((s.focus().unwrap().len(),extras(&s)),(1,1));
        s.erase().unwrap();assert_eq!(extras(&s),0);
    }
    #[test]
    fn snapshot_includes_classifications() {
        let dir=tempfile::tempdir().unwrap();let s=crate::service::Service::open(dir.path().into()).unwrap();
        s.store.conn.execute("UPDATE categories SET classification='productive' WHERE id='development'",[]).unwrap();
        let c=s.snapshot(0,10).unwrap().classifications;
        assert_eq!(c.get("development").map(String::as_str),Some("productive"));assert_eq!(c.get("personal").map(String::as_str),Some("neutral"));
    }


    #[test]
    fn manual_entry_is_stored_and_never_overlaps_trimmed() {
        let mut s=Store::open(Path::new(":memory:")).unwrap();
        s.log_time("Reading on paper",None,1_000,61_000,Some("Chapter 3"),100).unwrap();
        let rows=s.intervals(0,100_000).unwrap();
        assert_eq!(rows.len(),1);
        assert_eq!((rows[0].name.as_str(),rows[0].title.as_deref(),rows[0].state.as_str(),rows[0].availability.as_str()),("Reading on paper",Some("Chapter 3"),"active","manual"));
        // Idle detection trims tracked time back to the last input; a manual entry is the user's word and stays whole.
        s.commit(&Change{completed:vec![],trim_after:Some(30_000)},None,200).unwrap();
        assert_eq!(s.intervals(0,100_000).unwrap()[0].end,61_000);
        assert!(s.log_time("x",None,5,5,None,1).is_err());
        assert!(s.log_time("x",None,0,25*3_600_000,None,1).is_err());
        assert!(s.log_time("  ",None,0,60_000,None,1).is_err());
    }
}
