use crate::{engine::{Context, Engine, Sample, Signals}, models::*, platform, storage::{Result,Store}};
use chrono::{Local,TimeZone};
use std::{fs::{File,OpenOptions},path::PathBuf};
use fs2::FileExt;
pub struct Service {
    pub store: Store, pub engine: Engine, pub settings: Settings, pub trusted: bool,
    pub error: Option<String>, pub widget_available: bool, pub path: PathBuf,
    pub last_sample: Option<NativeSample>, last_commit: i64, last_widget: i64, last_retention: i64,
    _lock: File,
}
impl Service {
    pub fn open(dir:PathBuf)->Result<Self> {
        std::fs::create_dir_all(&dir)?;
        #[cfg(unix)] { use std::os::unix::fs::PermissionsExt;std::fs::set_permissions(&dir,std::fs::Permissions::from_mode(0o700))?; }
        let lock=OpenOptions::new().read(true).write(true).create(true).truncate(false).open(dir.join("writer.lock"))?;
        lock.try_lock_exclusive().map_err(|_|"Another Habyss process owns the database")?;
        let path=dir.join("habyss.sqlite3");let store=Store::open(&path)?;let settings=store.settings()?;
        Ok(Self{store,settings,path,engine:Engine::default(),trusted:false,error:None,widget_available:false,last_sample:None,last_commit:0,last_widget:0,last_retention:0,_lock:lock})
    }
    pub fn observe(&mut self,n:NativeSample)->Result<()> {
        self.trusted=n.trusted;
        let excluded=n.bundle.as_ref().is_some_and(|b|self.settings.excluded_apps.contains(b)) || n.title.as_ref().is_some_and(|title|self.settings.excluded_title_patterns.iter().any(|p|regex::Regex::new(p).is_ok_and(|r|r.is_match(title))));
        let context=if excluded { Context::inactive("excluded") } else if n.state!="active" { Context::inactive(&n.state) } else { Context{app:n.bundle.clone(),name:n.name.clone(),title:if self.settings.collect_titles {n.title.clone()}else{None},pid:n.pid,window_id:n.window_id.clone(),availability:n.availability.clone(),state:n.state.clone(),
            url:if self.settings.collect_titles {n.url.as_deref().and_then(crate::categorize::sanitize_url)}else{None},
            document:if self.settings.collect_titles {n.document.as_deref().map(|d|d.strip_prefix("file://").map(|p|urlencoding_decode(p)).unwrap_or_else(||d.to_string()))}else{None}} };
        // Input counted for a tick when it happened since the previous sample (never what was typed).
        let tick=self.last_sample.as_ref().map_or(1000,|l|(n.mono-l.mono).clamp(1000,5000));
        let signals=Signals{typing:n.key_idle_ms<tick,pointer:n.pointer_idle_ms<tick,meeting:n.mic,media:n.media};
        let mut next=self.engine.clone();
        let change=next.observe(Sample{utc:n.utc,mono:n.mono,idle_ms:n.idle_ms,context,signals},self.settings.tracking_enabled,self.settings.idle_threshold*1000);
        if !change.completed.is_empty() || change.trim_after.is_some() || n.utc-self.last_commit>=15000 {
            self.store.commit(&change,next.current.as_ref(),n.utc)?;
            self.last_commit=n.utc;
        }
        let before=self.engine.current.as_ref().map(|s|s.context.state.as_str()).unwrap_or("starting");
        let after=next.current.as_ref().map(|s|s.context.state.as_str()).unwrap_or("unknown");
        if before!=after { eprintln!("Tracking lifecycle: {before} -> {after}"); }
        self.engine=next;
        self.last_sample=Some(n.clone());
        self.error=None;
        if n.utc-self.last_retention>3600000 && self.settings.retention_days>0 {self.store.retention(n.utc-self.settings.retention_days*86400000)?;self.last_retention=n.utc;}
        if n.utc-self.last_widget>=300000 {self.publish_widget(n.utc)?;self.last_widget=n.utc;}
        Ok(())
    }
    /// One ticker step: completes a due session (publishing the widget) and returns the menu bar title plus whether a session ended.
    pub fn focus_tick(&mut self,now:i64)->Result<(String,bool)> {
        let ended=self.store.complete_due_focus(now)?;
        if ended { self.publish_widget(now)?; }
        Ok((crate::focus::tray_title(self.store.running_focus()?.as_ref(),now,&self.settings),ended))
    }
    pub fn shutdown(&mut self)->Result<()> {
        self.flush()?;
        let now=chrono::Utc::now().timestamp_millis();
        self.store.stop_focus(now)?;
        self.engine.reset();
        self.store.current_id=None;
        self.publish_widget(now)
    }
    pub fn flush(&mut self)->Result<()> { if let Some(n)=&self.last_sample { self.store.commit(&Default::default(),self.engine.current.as_ref(),n.utc)?; } Ok(()) }
    pub fn snapshot(&self,from:i64,to:i64)->Result<Snapshot> {
        let mut intervals=self.store.intervals(from,to)?;
        if let Some(current)=&self.engine.current {
            if let Some(id)=&self.store.current_id { intervals.retain(|i|&i.id!=id); }
            if current.end>from && current.start<to && current.end>current.start {
                let c=&current.context;
                let apps=self.store.applications()?;
                let app=apps.iter().find(|a|Some(&a.bundle_id)==c.app.as_ref());
                let a=&current.activity;
                let mut live=Interval{id:"current".into(),application_id:app.map(|a|a.id.clone()),name:c.name.clone(),bundle_id:c.app.clone(),title:c.title.clone(),start:current.start,end:current.end,state:c.state.clone(),category:app.map(|a|a.category.clone()).or_else(||c.app.as_deref().map(|b|crate::categorize::app_category(b).to_string())).unwrap_or("uncategorized".into()),availability:c.availability.clone(),pid:c.pid,window_id:c.window_id.clone(),
                    url:c.url.clone(),domain:c.url.as_deref().and_then(crate::categorize::domain),document:c.document.clone(),typing_ms:a.typing_ms,pointer_ms:a.pointer_ms,meeting_ms:a.meeting_ms,media_ms:a.media_ms};
                let overridden=self.store.category_overridden(c.app.as_deref())?;
                crate::storage::refine_category(&mut live,overridden);
                intervals.push(live);
            }
        }
        intervals.sort_by_key(|i|i.start);
        Ok(Snapshot{settings:self.settings.clone(),intervals,applications:self.store.applications()?,focus:self.store.focus()?,trusted:self.trusted,current_app:self.engine.current.as_ref().filter(|s|s.context.state=="active").map(|s|s.context.name.clone()),current_since:self.engine.current.as_ref().map(|s|s.start),state:self.engine.current.as_ref().map(|s|s.context.state.clone()).unwrap_or("starting".into()),error:self.error.clone(),widget_available:self.widget_available,database_path:self.path.display().to_string(),version:env!("CARGO_PKG_VERSION"),classifications:self.store.classifications()?})
    }
    pub fn update_settings(&mut self,settings:Settings)->Result<()> {
        settings.validate().map_err(std::io::Error::other)?;
        self.flush()?;
        self.store.save_settings(&settings)?;
        self.settings=settings;
        // Break attribution at the last observation; changes never expose an excluded current title.
        self.engine.reset();self.store.current_id=None;
        self.publish_widget(chrono::Utc::now().timestamp_millis())?;
        Ok(())
    }
    pub fn publish_widget(&mut self,now:i64)->Result<()> {
        let date=Local::now().date_naive();
        let from=Local.from_local_datetime(&date.and_hms_opt(0,0,0).ok_or("Invalid midnight")?).earliest().ok_or("Local midnight unavailable")?.timestamp_millis();
        let snap=self.snapshot(from,now+1)?;
        let active:i64=snap.intervals.iter().filter(|i|i.state=="active").map(|i|crate::engine::overlap(i.start,i.end,from,now)).sum();
        // Paused time is a per-session total, so it is spread evenly over the session.
        let focus_ms:i64=snap.focus.iter().map(|f|{let end=f.end.unwrap_or(now);let span=(end-f.start).max(1);crate::engine::overlap(f.start,end,from,now)*crate::focus::focus_elapsed(f,now)/span}).sum();
        let running=snap.focus.iter().find(|f|f.end.is_none());
        let json=serde_json::json!({"generated_at":now,"active_ms":active,"focus_ms":focus_ms,"state":if !self.settings.tracking_enabled {"paused"}else if self.engine.current.is_none(){"not_running"}else{snap.state.as_str()},"focus_label":running.map(|f|f.label.as_str()),"focus_start":running.map(|f|f.start),"focus_target_ms":running.map(|f|f.target_ms),"focus_paused_ms":running.map(|f|f.paused_ms),"focus_paused_at":running.and_then(|f|f.paused_at)});
        self.widget_available=platform::publish(&json.to_string());Ok(())
    }
}
#[cfg(test)] mod tests {
    use super::*;
    #[test] fn duplicate_writer_is_rejected() { let d=tempfile::tempdir().unwrap();let a=Service::open(d.path().into()).unwrap();assert!(Service::open(d.path().into()).is_err());drop(a);assert!(Service::open(d.path().into()).is_ok()); }
    fn observation(utc:i64)->NativeSample {
        NativeSample {utc,mono:utc,idle_ms:0,bundle:Some("test.private".into()),name:"Private App".into(),title:Some("Secret document".into()),pid:1,window_id:Some("window".into()),state:"active".into(),trusted:true,availability:"available".into(),url:None,document:None,key_idle_ms:i64::MAX,pointer_idle_ms:i64::MAX,mic:false,media:false}
    }
    #[test]
    fn exclusions_remove_sensitive_context_before_storage() {
        let dir=tempfile::tempdir().unwrap();let mut s=Service::open(dir.path().into()).unwrap();
        s.settings.tracking_enabled=true;s.settings.collect_titles=true;
        s.settings.excluded_title_patterns=vec!["Secret".into()];
        s.observe(observation(1000)).unwrap();s.observe(observation(2000)).unwrap();s.flush().unwrap();
        let rows=s.store.intervals(0,3000).unwrap();assert_eq!(rows.len(),1);
        assert_eq!(rows[0].state,"excluded");assert!(rows[0].title.is_none());assert!(rows[0].application_id.is_none());assert!(s.store.applications().unwrap().is_empty());
    }
    #[test]
    fn focus_tick_titles_then_completes_the_due_session() {
        let dir=tempfile::tempdir().unwrap();let mut s=Service::open(dir.path().into()).unwrap();
        s.store.start_focus("Deep Work",1000,0,None,None).unwrap();
        assert_eq!(s.focus_tick(500).unwrap(),("00:01 · Deep Work".to_string(),false));
        assert_eq!(s.focus_tick(1000).unwrap(),(String::new(),true));
        assert_eq!(s.focus_tick(2000).unwrap(),(String::new(),false));
    }
    #[test]
    fn title_preference_is_enforced_in_rust_as_well_as_native() {
        let dir=tempfile::tempdir().unwrap();let mut s=Service::open(dir.path().into()).unwrap();
        s.settings.tracking_enabled=true;s.settings.collect_titles=false;
        s.observe(observation(1000)).unwrap();s.observe(observation(2000)).unwrap();s.flush().unwrap();
        assert!(s.store.intervals(0,3000).unwrap()[0].title.is_none());
    }

}

/// Percent-decodes a file path from AXDocument (`/Users/me/My%20File.txt` → `/Users/me/My File.txt`).
fn urlencoding_decode(p:&str)->String {
    let b=p.as_bytes(); let mut out=Vec::with_capacity(b.len()); let mut i=0;
    while i<b.len() { if b[i]==b'%' && i+2<b.len() { if let Ok(v)=u8::from_str_radix(&p[i+1..i+3],16) { out.push(v); i+=3; continue; } } out.push(b[i]); i+=1; }
    String::from_utf8_lossy(&out).into_owned()
}
#[cfg(test)] mod depth_tests {
    use super::*;
    fn browse(utc:i64,url:&str)->NativeSample { NativeSample{utc,mono:utc,idle_ms:0,bundle:Some("com.google.Chrome".into()),name:"Chrome".into(),title:Some(url.into()),pid:1,window_id:None,state:"active".into(),trusted:true,availability:"available".into(),url:Some(url.into()),document:None,key_idle_ms:0,pointer_idle_ms:9999,mic:false,media:false} }
    #[test]
    fn websites_are_stored_sanitized_categorized_and_counted() {
        let dir=tempfile::tempdir().unwrap();let mut s=Service::open(dir.path().into()).unwrap();
        s.settings.tracking_enabled=true;s.settings.collect_titles=true;
        for t in [1000,2000,3000] { s.observe(browse(t,"https://www.youtube.com/watch?v=secret")).unwrap(); }
        s.observe(browse(4000,"https://github.com/a/b")).unwrap();s.observe(browse(5000,"https://github.com/a/b")).unwrap();s.flush().unwrap();
        let rows=s.store.intervals(0,10000).unwrap();
        let yt=&rows[0];
        assert_eq!(yt.url.as_deref(),Some("https://www.youtube.com/watch"));
        assert_eq!(yt.domain.as_deref(),Some("youtube.com"));
        assert_eq!(yt.category,"entertainment");
        assert_eq!((yt.typing_ms,yt.pointer_ms),(3000,0));
        assert_eq!(s.snapshot(0,10000).unwrap().intervals.last().unwrap().category,"development");
    }
    #[test]
    fn urls_are_never_kept_without_the_titles_opt_in() {
        let dir=tempfile::tempdir().unwrap();let mut s=Service::open(dir.path().into()).unwrap();
        s.settings.tracking_enabled=true;
        s.observe(browse(1000,"https://a.com/")).unwrap();s.observe(browse(2000,"https://b.com/")).unwrap();s.flush().unwrap();
        assert!(s.store.intervals(0,10000).unwrap().iter().all(|i|i.url.is_none()&&i.domain.is_none()));
    }
    #[test] fn document_paths_are_decoded() { assert_eq!(urlencoding_decode("/Users/me/My%20File.txt"),"/Users/me/My File.txt"); assert_eq!(urlencoding_decode("/a%2"),"/a%2"); }
}
