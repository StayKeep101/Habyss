//! Platform-independent accounting. Milliseconds, UTC wall time plus monotonic samples.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Context {
    pub app: Option<String>,
    pub name: String,
    pub title: Option<String>,
    pub pid: i32,
    pub window_id: Option<String>,
    pub availability: String,
    pub state: String,
}
impl Context {
    pub fn inactive(state: &str) -> Self { Self { app: None, name: String::new(), title: None, pid: 0, window_id: None, availability: "unavailable".into(), state: state.into() } }
}
#[derive(Clone, Debug)]
pub struct Sample { pub utc: i64, pub mono: i64, pub idle_ms: i64, pub context: Context }
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Span { pub start: i64, pub end: i64, pub context: Context }
#[derive(Clone, Debug, Default)]
pub struct Change { pub completed: Vec<Span>, pub trim_after: Option<i64> }
#[derive(Clone, Debug, Default)]
pub struct Engine { pub current: Option<Span>, last: Option<Sample>, observed_start: Option<i64> }
impl Engine {
    pub fn observe(&mut self, mut sample: Sample, enabled: bool, threshold_ms: i64) -> Change {
        let mut out = Change::default();
        let Some(last) = self.last.clone() else {
            self.observed_start = Some(sample.utc);
            if !enabled { sample.context = Context::inactive("paused"); }
            else if sample.context.state == "active" && sample.idle_ms >= threshold_ms { sample.context = Context::inactive("idle"); }
            self.current = Some(Span { start: sample.utc, end: sample.utc, context: sample.context.clone() });
            self.last = Some(sample); return out;
        };
        // Duplicate/out-of-order monotonic events cannot create time.
        if sample.mono <= last.mono { return out; }
        let elapsed = sample.mono - last.mono;
        let wall_elapsed = sample.utc - last.utc;
        // Missing delivery / suspension / clock discontinuity: close at last observation.
        // After backwards wall jumps, suppress attribution until UTC catches up.
        if elapsed > 5000 || (wall_elapsed - elapsed).abs() > 1500 || sample.utc < last.utc {
            if let Some(span) = self.current.take() { if span.end > span.start { out.completed.push(span); } }
            if sample.utc < last.utc { return out; }
            self.observed_start = Some(sample.utc);
        }
        if self.current.as_ref().is_some_and(|s| s.context.state != "active" && s.context.state != "idle") && sample.context.state == "active" { self.observed_start = Some(sample.utc); }
        if !enabled { sample.context = Context::inactive("paused"); }
        else if sample.context.state == "active" && sample.idle_ms >= threshold_ms {
            sample.context = Context::inactive("idle");
            if self.current.as_ref().is_some_and(|s| s.context.state == "active") {
                let cutoff = (sample.utc - sample.idle_ms.max(0)).max(self.observed_start.unwrap_or(sample.utc));
                out.trim_after = Some(cutoff);
                if let Some(mut span) = self.current.take() { span.end = cutoff.min(sample.utc); if span.end > span.start { out.completed.push(span); } }
                self.current = Some(Span { start: cutoff, end: sample.utc, context: sample.context.clone() });
            }
        }
        if let Some(mut span) = self.current.take() {
            span.end = sample.utc;
            if span.context == sample.context { self.current = Some(span); }
            else { if span.end > span.start { out.completed.push(span); } self.current = Some(Span { start: sample.utc, end: sample.utc, context: sample.context.clone() }); }
        } else { self.current = Some(Span { start: sample.utc, end: sample.utc, context: sample.context.clone() }); }
        self.last = Some(sample);
        out
    }
    pub fn reset(&mut self) { *self = Self::default(); }
}
pub fn overlap(start: i64, end: i64, from: i64, to: i64) -> i64 { (end.min(to) - start.max(from)).max(0) }
#[cfg(test)]
mod tests {
    use super::*;
    fn s(t: i64, name: &str) -> Sample { Sample { utc: 1_000_000 + t, mono: t + 1, idle_ms: 0, context: Context { app: Some(name.into()), name: name.into(), title: None, pid: 1, window_id: None, availability: "app_only".into(), state: "active".into() } } }
    #[test] fn switches_and_duplicates() { let mut e = Engine::default(); e.observe(s(0,"A"),true,120000); assert_eq!(e.observe(s(1000,"B"),true,120000).completed[0].end,1_001_000); assert!(e.observe(s(1000,"B"),true,120000).completed.is_empty()); assert_eq!(e.observe(s(1100,"C"),true,120000).completed[0].start,1_001_000); }
    #[test] fn title_changes_and_missing_permission() { let mut e=Engine::default(); e.observe(s(0,"A"),true,120000); let mut v=s(1000,"A"); v.context.title=Some("Document".into()); assert_eq!(e.observe(v,true,120000).completed.len(),1); assert_eq!(e.observe(s(2000,"A"),true,120000).completed.len(),1); }
    #[test] fn idle_retroactive_across_switches() { let mut e=Engine::default(); for t in (0..120000).step_by(1000) { let mut v=s(t,if t<60000 {"A"} else {"B"}); v.idle_ms=t; e.observe(v,true,120000); } let mut v=s(120000,"B"); v.idle_ms=120000; let out=e.observe(v,true,120000); assert_eq!(out.trim_after,Some(1_000_000)); assert_eq!(e.current.unwrap().context.state,"idle"); }
    #[test] fn pause_resume_and_sleep() { let mut e=Engine::default(); e.observe(s(0,"A"),true,120000); e.observe(s(1000,"A"),false,120000); assert_eq!(e.current.as_ref().unwrap().context.state,"paused"); e.observe(s(2000,"A"),true,120000); let result=e.observe(s(600000,"A"),true,120000); assert!(result.completed.is_empty()); assert_eq!(e.current.unwrap().start,1_600_000); }
    #[test] fn wall_clock_backwards_does_not_overlap() { let mut e=Engine::default(); e.observe(s(0,"A"),true,120000); e.observe(s(1000,"A"),true,120000); let mut v=s(2000,"A"); v.utc-=3000; let out=e.observe(v,true,120000); assert_eq!(out.completed[0].end,1_001_000); assert!(e.current.is_none()); e.observe(s(3000,"A"),true,120000); assert_eq!(e.current.unwrap().start,1_003_000); }
    #[test] fn forward_clock_gap_is_unknown() { let mut e=Engine::default(); e.observe(s(0,"A"),true,120000); e.observe(s(1000,"A"),true,120000); let mut v=s(2000,"A"); v.utc+=3600000; let out=e.observe(v,true,120000); assert_eq!(out.completed[0].end-out.completed[0].start,1000); }
    #[test] fn midnight_dst_timezone_are_range_queries() { assert_eq!(overlap(0,48*3600000,12*3600000,35*3600000),23*3600000); assert_eq!(overlap(0,48*3600000,12*3600000,37*3600000),25*3600000); assert_eq!(overlap(0,2000,1000,3000),1000); assert_eq!(overlap(0,1000,2000,3000),0); }
    #[test] fn random_sequence_has_no_overlaps() { let mut e=Engine::default(); let mut spans=vec![]; for t in (0..100000).step_by(37) { spans.extend(e.observe(s(t,&format!("App{}",t%3)),true,120000).completed); } for w in spans.windows(2) { assert!(w[0].end<=w[1].start); } }
    #[test] fn lock_and_wake() { let mut e=Engine::default(); e.observe(s(0,"A"),true,120000); let mut v=s(1000,"A");v.context=Context::inactive("locked"); e.observe(v,true,120000); assert_eq!(e.current.as_ref().unwrap().context.state,"locked"); e.observe(s(2000,"B"),true,120000); assert_eq!(e.current.unwrap().context.name,"B"); }
    #[test]
    fn resumed_idle_cannot_rewrite_paused_time() {
        let mut e = Engine::default();
        e.observe(s(0, "A"), false, 15000);
        for t in (1000..20000).step_by(1000) { e.observe(s(t, "A"), false, 15000); }
        let mut v = s(20000, "A"); v.idle_ms = 20000;
        let out = e.observe(v, true, 15000);
        assert!(out.trim_after.is_none());
        assert_eq!(e.current.unwrap().start, 1_020_000);
    }
    #[test]
    fn unavailable_application_is_not_active() {
        let mut e = Engine::default(); let mut v = s(0, "A");
        v.context = Context::inactive("unknown");
        e.observe(v, true, 120000);
        let result = e.observe(s(1000, "B"), true, 120000);
        assert_eq!(result.completed[0].context.state, "unknown");
    }
    #[test]
    fn startup_while_idle_never_backfills_history() {
        let mut e = Engine::default(); let mut v = s(100000, "A");v.idle_ms = 900000;
        let result = e.observe(v, true, 120000);
        assert!(result.completed.is_empty());assert!(result.trim_after.is_none());
        assert_eq!(e.current.unwrap().start, 1_100_000);
    }
    #[test]
    fn midnight_does_not_split_or_duplicate_a_context() {
        let mut e = Engine::default(); let mut v = s(0, "A");v.utc = 86_399_000;
        e.observe(v, true, 120000);let mut v = s(2000, "A");v.utc = 86_401_000;
        assert!(e.observe(v, true, 120000).completed.is_empty());
        let c = e.current.unwrap();assert_eq!(overlap(c.start,c.end,0,86_400_000),1000);
        assert_eq!(overlap(c.start,c.end,86_400_000,172_800_000),1000);
    }

}
