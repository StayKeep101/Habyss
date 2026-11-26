use crate::models::{FocusSession, Settings};
/// Active milliseconds: wall time minus accumulated pauses and any pause still open.
pub fn focus_elapsed(s:&FocusSession,now:i64)->i64 { let open=s.paused_at.map_or(0,|p|(now-p).max(0)); (s.end.unwrap_or(now)-s.start-s.paused_ms-open).max(0) }
pub fn focus_remaining(s:&FocusSession,now:i64)->i64 { (s.target_ms-focus_elapsed(s,now)).max(0) }
/// Menu bar text: "" when idle or disabled, else the time left as the phone shows it, "⏸ " when paused, " · label" when enabled.
pub fn tray_title(s:Option<&FocusSession>,now:i64,settings:&Settings)->String {
    let Some(s)=s.filter(|s|s.end.is_none()&&settings.menu_bar_timer) else { return String::new() };
    let text=format!("{}{}",if s.paused_at.is_some(){"⏸ "}else{""},crate::pill::clock(focus_remaining(s,now)));
    crate::pill::with_title(text,&s.label,settings)
}
#[cfg(test)] mod tests {
    use super::*;
    fn session(paused_ms:i64,paused_at:Option<i64>)->FocusSession { FocusSession{id:"f".into(),label:"Deep Work".into(),start:0,end:None,target_ms:1_500_000,state:"running".into(),paused_ms,paused_at,item_id:None,item_kind:None} }
    #[test] fn elapsed_excludes_pauses() { assert_eq!(focus_elapsed(&session(60000,None),300000),240000); }
    #[test] fn paused_session_stops_counting() { assert_eq!(focus_elapsed(&session(0,Some(100000)),400000),100000); }
    #[test] fn elapsed_is_floored_and_uses_end() { assert_eq!(focus_elapsed(&session(999999,None),10),0); let mut s=session(0,None);s.end=Some(50);assert_eq!(focus_elapsed(&s,900),50); }
    #[test] fn title_formats() {
        let st=Settings::default();
        assert_eq!(tray_title(Some(&session(0,None)),0,&st),"25:00 · Deep Work");
        assert_eq!(tray_title(Some(&session(0,None)),0,&Settings{menu_bar_task:false,..st.clone()}),"25:00");
        assert_eq!(tray_title(Some(&session(0,Some(0))),0,&st),"⏸ 25:00 · Deep Work");
        assert_eq!(tray_title(None,0,&st),"");
        assert_eq!(tray_title(Some(&session(0,None)),0,&Settings{menu_bar_timer:false,..st.clone()}),"");
        assert_eq!(tray_title(Some(&session(0,None)),1_499_001,&st),"0:01 · Deep Work");
    }
    #[test] fn long_label_truncates() {
        let mut s=session(0,None);s.label="abcdefghijklmnopqrstuvwxyz0123".into();
        assert_eq!(tray_title(Some(&s),0,&Settings::default()),"25:00 · abcdefghijklmnopqrstuvw…");
        s.label="x".repeat(24);assert_eq!(tray_title(Some(&s),0,&Settings::default()),format!("25:00 · {}","x".repeat(24)));
        s.label="  ".into();assert_eq!(tray_title(Some(&s),0,&Settings::default()),"25:00");
    }
}
