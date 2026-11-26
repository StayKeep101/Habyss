use crate::{models::{Settings,Snapshot},platform::{self,ActivityCollector},service::Service};
use std::sync::Mutex;
use tauri::{Manager,State};
pub type Shared=Mutex<Service>;
type Result<T>=std::result::Result<T,String>;
fn with<T>(state:State<'_,Shared>,f:impl FnOnce(&mut Service)->crate::storage::Result<T>)->Result<T> { let mut s=state.lock().map_err(|_|"Tracking service lock failed".to_string())?; f(&mut s).map_err(|e|e.to_string()) }
#[tauri::command] pub fn snapshot(state:State<'_,Shared>,from:i64,to:i64)->Result<Snapshot> { if !to.checked_sub(from).is_some_and(|length| (1..=366*86400000i64).contains(&length)) {return Err("Choose a range of up to one year".into());}with(state,|s|s.snapshot(from,to)) }
#[tauri::command] pub fn save_settings(state:State<'_,Shared>,settings:Settings)->Result<()> { let titles=settings.collect_titles;with(state,|s|s.update_settings(settings))?;platform::MacCollector.set_title_collection(titles);Ok(()) }
#[tauri::command] pub fn set_tracking(state:State<'_,Shared>,enabled:bool)->Result<()> {with(state,|s|{let mut settings=s.settings.clone();settings.tracking_enabled=enabled;s.update_settings(settings)})}
fn now_ms()->i64 { chrono::Utc::now().timestamp_millis() }
#[tauri::command] pub fn start_focus(state:State<'_,Shared>,label:String,minutes:i64,item_id:Option<String>,item_kind:Option<String>)->Result<()> { if !(1..=480).contains(&minutes)||label.trim().is_empty()||label.len()>200{return Err("Enter a label and a duration from 1 to 480 minutes".into());} if item_kind.as_deref().is_some_and(|k|k!="habit"&&k!="task")||item_id.as_ref().is_some_and(|i|i.len()>64){return Err("Invalid linked item".into());} with(state,|s|{s.store.start_focus(label.trim(),minutes*60000,now_ms(),item_id,item_kind)?;s.publish_widget(now_ms())}) }
#[tauri::command] pub fn pause_focus(state:State<'_,Shared>)->Result<()> { with(state,|s|{s.store.pause_focus(now_ms())?;s.publish_widget(now_ms())}) }
#[tauri::command] pub fn resume_focus(state:State<'_,Shared>)->Result<()> { with(state,|s|{s.store.resume_focus(now_ms())?;s.publish_widget(now_ms())}) }
#[tauri::command] pub fn stop_focus(state:State<'_,Shared>)->Result<()> { with(state,|s|{s.store.stop_focus(now_ms())?;s.publish_widget(now_ms())}) }
#[tauri::command] pub fn categorize(state:State<'_,Shared>,id:String,category:String)->Result<()> { with(state,|s|{s.store.conn.execute("UPDATE applications SET category_override=?1 WHERE id=?2",rusqlite::params![category,id])?;Ok(())}) }
#[tauri::command] pub fn request_permission() {platform::permission();}
#[tauri::command] pub fn open_permissions() {platform::open_permissions();}
#[tauri::command] pub fn erase_history(state:State<'_,Shared>,confirmation:String)->Result<()> { if confirmation!="DELETE" {return Err("Type DELETE to confirm".into());}with(state,|s|{s.store.erase()?;s.engine.reset();s.last_sample=None;s.publish_widget(chrono::Utc::now().timestamp_millis())}) }
#[tauri::command] pub fn export_history(state:State<'_,Shared>)->Result<String> {with(state,|s|{s.flush()?;Ok(serde_json::to_string_pretty(&serde_json::json!({"schema_version":1,"exported_at":chrono::Utc::now().to_rfc3339(),"applications":s.store.applications()?,"intervals":s.store.intervals(0,i64::MAX)?,"focus_sessions":s.store.focus()?}))?)})}
#[tauri::command] pub fn open_dashboard(app:tauri::AppHandle,screen:Option<String>)->Result<()> { use tauri::Emitter;if let Some(w)=app.get_webview_window("main") {w.show().map_err(|e|e.to_string())?;w.set_focus().map_err(|e|e.to_string())?;if let Some(screen)=screen{w.emit("navigate",screen).map_err(|e|e.to_string())?;}}if let Some(p)=app.get_webview_window("panel"){let _=p.hide();}Ok(()) }
#[tauri::command] pub fn quit(app:tauri::AppHandle,state:State<'_,Shared>)->Result<()> {with(state,|s|s.shutdown())?;app.exit(0);Ok(())}

#[tauri::command]
pub async fn export_to_file(state:State<'_,Shared>)->Result<Option<String>> {
    let json=export_history(state)?;
    tauri::async_runtime::spawn_blocking(move || platform::save_export(json)).await.map_err(|e|e.to_string())?
}

static APP_ICONS:std::sync::LazyLock<Mutex<std::collections::HashMap<String,Option<String>>>>=std::sync::LazyLock::new(Default::default);
static SITE_ICONS:std::sync::LazyLock<Mutex<std::collections::HashMap<String,Option<String>>>>=std::sync::LazyLock::new(Default::default);
/// An installed app's icon as a data URL, cached for the life of the process.
#[tauri::command] pub fn app_icon(bundle:String)->Option<String> {
    if bundle.starts_with("process:") || bundle.len()>255 { return None; }
    if let Some(v)=APP_ICONS.lock().ok()?.get(&bundle) { return v.clone(); }
    let icon=platform::app_icon(&bundle);
    APP_ICONS.lock().ok()?.insert(bundle,icon.clone());
    icon
}
/// A public website's own favicon as a data URL. The request goes only to the site itself (one you already visited),
/// never to a third-party icon service. Local, private and malformed hosts are refused.
#[tauri::command] pub async fn site_icon(domain:String)->Option<String> {
    if !crate::categorize::public_host(&domain) { return None; }
    if let Some(v)=SITE_ICONS.lock().ok()?.get(&domain) { return v.clone(); }
    let client=reqwest::Client::builder().timeout(std::time::Duration::from_secs(4)).redirect(reqwest::redirect::Policy::limited(3)).build().ok()?;
    let mut icon=None;
    for path in ["favicon.ico","apple-touch-icon.png"] {
        let Ok(r)=client.get(format!("https://{domain}/{path}")).send().await else { continue };
        if !r.status().is_success() { continue; }
        let kind=r.headers().get("content-type").and_then(|v|v.to_str().ok()).unwrap_or("").split(';').next().unwrap_or("").trim().to_string();
        if !kind.starts_with("image/") || kind.contains("svg") { continue; }
        let Ok(body)=r.bytes().await else { continue };
        if body.is_empty() || body.len()>256*1024 { continue; }
        use base64::Engine;
        icon=Some(format!("data:{kind};base64,{}",base64::engine::general_purpose::STANDARD.encode(&body)));
        break;
    }
    SITE_ICONS.lock().ok()?.insert(domain,icon.clone());
    icon
}

/// Today's timeline from the webview, for the menu bar pill (src/pill.rs). Sent when it changes and once a minute.
#[tauri::command] pub fn set_day_plan(state:State<'_,Shared>,slots:Vec<crate::pill::PlanSlot>)->Result<()> { if slots.len()>500 {return Err("Too many slots".into());} with(state,|s|{s.plan=slots;Ok(())}) }
/// Time logged by hand from the menu bar ("+ Log time").
#[tauri::command] pub fn log_time(state:State<'_,Shared>,name:String,bundle:Option<String>,start:i64,end:i64,note:Option<String>)->Result<()> { with(state,|s|s.store.log_time(&name,bundle.as_deref(),start,end,note.as_deref(),now_ms())) }
/// Opens one System Settings pane (an allowlist, never a URL from the page): where the mirrored iPhone Live Activity is hidden.
#[tauri::command] pub fn open_system_settings(pane:String)->Result<()> {
    let url=match pane.as_str() { "menu_bar"=>"x-apple.systempreferences:com.apple.ControlCenter-Settings.extension", "notifications"=>"x-apple.systempreferences:com.apple.Notifications-Settings.extension", _=>return Err("Unknown settings pane".into()) };
    std::process::Command::new("open").arg(url).spawn().map(|_|()).map_err(|e|e.to_string())
}
