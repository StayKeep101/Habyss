mod cloud;
mod categorize;
mod commands;
pub mod engine;
mod focus;
mod models;
mod pill;
mod panel_place;
mod platform;
mod service;
mod storage;
use commands::*;
use platform::ActivityCollector;
use tauri::{Emitter,Manager};
use std::sync::{Arc,Mutex};
/// The menu bar panel's size in points, when the display has room for it.
const PANEL_WIDTH:f64=660.0;
const PANEL_HEIGHT:f64=720.0;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app,_,_|{let _=open_dashboard(app.clone(),None);}))
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent,Some(vec!["--autostart"])))
        .invoke_handler(tauri::generate_handler![snapshot,save_settings,set_tracking,start_focus,pause_focus,resume_focus,stop_focus,categorize,request_permission,open_permissions,erase_history,export_history,export_to_file,open_dashboard,quit,haptic,app_icon,site_icon,set_day_plan,log_time,open_system_settings,
            cloud::commands::cloud_status,cloud::commands::cloud_send_code,cloud::commands::cloud_verify_code,cloud::commands::cloud_sign_in_password,cloud::commands::cloud_sign_in_with,cloud::commands::cloud_sign_out,cloud::commands::cloud_sync_now,cloud::commands::cloud_data,cloud::commands::cloud_save,cloud::commands::cloud_delete,cloud::commands::cloud_set_completion,cloud::commands::cloud_set_task_done,cloud::commands::cloud_set_day_input,cloud::commands::cloud_rpc,cloud::commands::cloud_action,cloud::commands::cloud_delete_account])
        .setup(|app| {
            let service=service::Service::open(app.path().app_data_dir()?).map_err(|e|std::io::Error::other(e.to_string()))?;
            let minimized=service.settings.start_minimized || std::env::args().any(|a|a=="--autostart");
            let titles=service.settings.collect_titles;
            app.manage(Mutex::new(service));
            if let Some(config)=cloud::client::Config::from_build() {
                let client=Arc::new(cloud::client::Client::new(config));
                let auth=Arc::new(cloud::auth::Auth::new(client.clone(),Arc::new(cloud::auth::Keychain)));
                let (cloud,nudges)=cloud::runner::Cloud::new(client,auth);
                if let Ok(s)=app.state::<Shared>().lock() { cloud.launch(&s.store.conn); }
                app.manage(cloud.clone());
                tauri::async_runtime::spawn(cloud::runner::run(app.handle().clone(),cloud,nudges));
            }
            let (sender,receiver)=std::sync::mpsc::channel();
            let collector=platform::MacCollector::new(sender);collector.start();collector.set_title_collection(titles);
            let handle=app.handle().clone();
            std::thread::Builder::new().name("habyss-tracking".into()).spawn(move || {
                let mut last_emit=0;
                for sample in receiver {
                    let now=sample.utc;
                    let state=handle.state::<Shared>();
                    if let Ok(mut service)=state.lock() {if let Err(error)=service.observe(sample) {eprintln!("Tracking persistence failed: {error}");service.error=Some(error.to_string());}}
                    if now-last_emit>=5000 {for label in ["main","panel"] {if let Some(w)=handle.get_webview_window(label) {if w.is_visible().unwrap_or(false){let _=w.emit("activity-updated",());}}}last_emit=now;}
                }
            })?;
            let handle=app.handle().clone();
            std::thread::Builder::new().name("habyss-tray".into()).spawn(move || {
                let (mut shown,mut poisoned)=(String::new(),false);
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(1));
                    // The lock is held only for the database step; Tauri is called after it is released.
                    // A poisoned lock is dropped inside the block too: set_title waits on the main thread, which may want this lock.
                    let step={let state=handle.state::<Shared>();let locked=state.lock();match locked {Ok(mut service)=>Some(service.focus_tick(chrono::Utc::now().timestamp_millis())),Err(poison)=>{drop(poison);None}}};
                    let Some(step)=step else {
                        if !poisoned{eprintln!("Focus ticker: service lock poisoned");poisoned=true;}
                        if !shown.is_empty() { if let Some(tray)=handle.tray_by_id("habyss") { if tray.set_title(None::<&str>).is_ok() { shown.clear(); } } }
                        continue
                    };
                    let (title,ended)=match step {Ok(v)=>v,Err(error)=>{eprintln!("Focus tick failed: {error}");continue}};
                    if ended {for label in ["main","panel"] {if let Some(w)=handle.get_webview_window(label) {let _=w.emit("activity-updated",());}}}
                    if title!=shown { if let Some(tray)=handle.tray_by_id("habyss") { if tray.set_title(Some(title.as_str())).is_ok() { shown=title; } } }
                }
            })?;
            let menu=tauri::menu::Menu::with_items(app,&[
                &tauri::menu::MenuItem::with_id(app,"open","Open Habyss",true,None::<&str>)?,
                &tauri::menu::MenuItem::with_id(app,"settings","Settings…",true,None::<&str>)?,
                &tauri::menu::MenuItem::with_id(app,"quit","Quit Habyss",true,None::<&str>)?,
            ])?;
            tauri::tray::TrayIconBuilder::with_id("habyss")
                .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?)
                .icon_as_template(true).tooltip("Habyss • Local activity tracking").menu(&menu).show_menu_on_left_click(false)
                .on_menu_event(|app,event|match event.id.as_ref(){"open"=>{let _=open_dashboard(app.clone(),None);},"settings"=>{let _=open_dashboard(app.clone(),Some("Settings".into()));},"quit"=>{if let Err(e)=quit(app.clone(),app.state()){eprintln!("Quit failed: {e}");}},_=>{}})
                .on_tray_icon_event(|tray,event| {
                    if let tauri::tray::TrayIconEvent::Click{button:tauri::tray::MouseButton::Left,button_state:tauri::tray::MouseButtonState::Up,rect,..}=event {
                        if let Some(panel)=tray.app_handle().get_webview_window("panel") {
                            if panel.is_visible().unwrap_or(false){let _=panel.hide();return;}
                            // On the display whose menu bar was clicked, under it, inside it (panel_place.rs).
                            let displays:Vec<panel_place::Display>=panel.available_monitors().unwrap_or_default().iter().map(|m|panel_place::Display{x:m.position().x as f64,y:m.position().y as f64,width:m.size().width as f64,height:m.size().height as f64,scale:m.scale_factor(),work_top:m.work_area().position.y as f64}).collect();
                            let click=panel_place::pointer(&displays).unwrap_or_else(||{let s=panel.scale_factor().unwrap_or(1.0);let p=rect.position.to_logical::<f64>(s);let z=rect.size.to_logical::<f64>(s);(p.x+z.width/2.0,p.y+z.height/2.0)});
                            if let Some(p)=panel_place::place(&displays,click,(PANEL_WIDTH,PANEL_HEIGHT)){let _=panel.set_size(tauri::LogicalSize::new(p.width,p.height));let _=panel.set_position(tauri::LogicalPosition::new(p.x,p.y));}
                            let _=panel.show();let _=panel.set_focus();
                        }
                    }
                }).build(app)?;
            if minimized {if let Some(w)=app.get_webview_window("main"){w.hide()?;}}
            Ok(())
        })
        .on_window_event(|window,event|match event {
            tauri::WindowEvent::CloseRequested{api,..}=>{api.prevent_close();let _=window.hide();},
            tauri::WindowEvent::Focused(false) if window.label()=="panel"=>{let _=window.hide();},
            tauri::WindowEvent::Focused(true) if window.label()=="main"=>{if let Some(c)=window.app_handle().try_state::<Arc<cloud::runner::Cloud>>(){c.nudge(cloud::runner::Nudge::Focus);}},_=>{}
        })
        .build(tauri::generate_context!()).expect("Habyss initialization failed")
        .run(|app,event|match event {
            tauri::RunEvent::Exit=>{let state=app.state::<Shared>();if let Ok(mut s)=state.lock(){if let Err(e)=s.shutdown(){eprintln!("Final checkpoint failed: {e}");}};},
            tauri::RunEvent::Opened{..}=>{let _=open_dashboard(app.clone(),Some("Dashboard".into()));},_=>{}
        });
}
