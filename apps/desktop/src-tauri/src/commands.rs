use crate::{models::{Settings,Snapshot},platform::{self,ActivityCollector},service::Service};
use std::sync::Mutex;
use tauri::{Manager,State};
pub type Shared=Mutex<Service>;
type Result<T>=std::result::Result<T,String>;
fn with<T>(state:State<'_,Shared>,f:impl FnOnce(&mut Service)->crate::storage::Result<T>)->Result<T> { let mut s=state.lock().map_err(|_|"Tracking service lock failed".to_string())?; f(&mut s).map_err(|e|e.to_string()) }
#[tauri::command] pub fn snapshot(state:State<'_,Shared>,from:i64,to:i64)->Result<Snapshot> { if !to.checked_sub(from).is_some_and(|length| (1..=366*86400000i64).contains(&length)) {return Err("Choose a range of up to one year".into());}with(state,|s|s.snapshot(from,to)) }
#[tauri::command] pub fn save_settings(state:State<'_,Shared>,settings:Settings)->Result<()> { let titles=settings.collect_titles;with(state,|s|s.update_settings(settings))?;platform::MacCollector.set_title_collection(titles);Ok(()) }
#[tauri::command] pub fn set_tracking(state:State<'_,Shared>,enabled:bool)->Result<()> {with(state,|s|{let mut settings=s.settings.clone();settings.tracking_enabled=enabled;s.update_settings(settings)})}
#[tauri::command] pub fn start_focus(state:State<'_,Shared>,label:String,minutes:i64)->Result<()> { if !(1..=480).contains(&minutes)||label.trim().is_empty()||label.len()>200{return Err("Enter a label and a duration from 1 to 480 minutes".into());} with(state,|s|{s.store.start_focus(label.trim(),minutes*60000,chrono::Utc::now().timestamp_millis())?;s.publish_widget(chrono::Utc::now().timestamp_millis())}) }
#[tauri::command] pub fn stop_focus(state:State<'_,Shared>)->Result<()> { with(state,|s|{s.store.stop_focus(chrono::Utc::now().timestamp_millis())?;s.publish_widget(chrono::Utc::now().timestamp_millis())}) }
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
