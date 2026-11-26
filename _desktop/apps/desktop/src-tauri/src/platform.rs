//! Native collectors own system observation; the portable engine never imports AppKit.
use crate::models::NativeSample;
pub trait ActivityCollector { fn start(&self); fn set_title_collection(&self, enabled: bool); }
#[cfg(target_os="macos")]
mod macos {
    use super::*;
    use std::{ffi::{c_char,CStr,CString},sync::{mpsc::Sender,OnceLock}};
    static SINK:OnceLock<Sender<NativeSample>>=OnceLock::new();
    extern "C" { fn habyss_start(sink:extern "C" fn(*const c_char)); fn habyss_titles(enabled:bool); fn habyss_permission(); fn habyss_open_permissions(); fn habyss_publish(json:*const c_char)->bool; fn habyss_app_icon(bundle:*const c_char)->*mut c_char; fn habyss_free(p:*mut c_char); fn habyss_save_export(json:*const c_char, reply:extern "C" fn(*mut std::ffi::c_void,*const c_char), context:*mut std::ffi::c_void); }
    extern "C" fn receive(json:*const c_char) {
        if json.is_null() { return; }
        let value=unsafe { CStr::from_ptr(json) };
        if let Ok(sample)=serde_json::from_slice(value.to_bytes()) { if let Some(sink)=SINK.get() { let _=sink.send(sample); } }
    }
    extern "C" fn export_reply(context:*mut std::ffi::c_void, json:*const c_char) {
        if context.is_null() { return; }
        let sender=unsafe { Box::from_raw(context.cast::<std::sync::mpsc::Sender<String>>()) };
        let result=if json.is_null(){"{}".into()}else{unsafe{CStr::from_ptr(json)}.to_string_lossy().into_owned()};
        let _=sender.send(result);
    }
    pub fn save_export(json:String)->std::result::Result<Option<String>,String> {
        let (sender,receiver)=std::sync::mpsc::channel::<String>();
        let value=CString::new(json).map_err(|e|e.to_string())?;
        let context=Box::into_raw(Box::new(sender)).cast();
        unsafe { habyss_save_export(value.as_ptr(),export_reply,context) };
        let result=receiver.recv().map_err(|e|e.to_string())?;
        let decoded:serde_json::Value=serde_json::from_str(&result).map_err(|e|e.to_string())?;
        if let Some(error)=decoded.get("error").and_then(|v|v.as_str()){return Err(error.into());}
        Ok(decoded.get("path").and_then(|v|v.as_str()).map(str::to_owned))
    }
    pub struct MacCollector;
    impl MacCollector { pub fn new(sink:Sender<NativeSample>)->Self { let _=SINK.set(sink);Self } }
    impl ActivityCollector for MacCollector { fn start(&self) { unsafe{habyss_start(receive)} } fn set_title_collection(&self,enabled:bool) { unsafe{habyss_titles(enabled)} } }
    /// The app's icon as a PNG data URL, from the bundle identifier. None for unknown apps and process-only ids.
    pub fn app_icon(bundle:&str)->Option<String> {
        let c=CString::new(bundle).ok()?;
        let ptr=unsafe { habyss_app_icon(c.as_ptr()) };
        if ptr.is_null() { return None; }
        let b64=unsafe { CStr::from_ptr(ptr) }.to_string_lossy().into_owned();
        unsafe { habyss_free(ptr) };
        Some(format!("data:image/png;base64,{b64}"))
    }
    pub fn permission() { unsafe { habyss_permission() } }
    pub fn open_permissions() { unsafe { habyss_open_permissions() } }
    pub fn publish(json:&str)->bool { CString::new(json).is_ok_and(|c|unsafe{habyss_publish(c.as_ptr())}) }
}
#[cfg(target_os="macos")] pub use macos::*;
#[cfg(not(target_os="macos"))] compile_error!("Only the macOS activity adapter is implemented. See WINDOWS_ROADMAP.md.");
