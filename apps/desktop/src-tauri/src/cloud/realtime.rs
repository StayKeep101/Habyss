//! Supabase Realtime (Phoenix protocol, vsn 1.0.0): a change to the account's rows only nudges the runner. It never writes data.
//! Logs never include the socket URL, tokens or row contents.
use super::{auth::Auth, client::{Config, CloudError}, mirror::Table};
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::{sync::Arc, time::{Duration, Instant}};
use tokio::{sync::Notify, time::sleep};
use tokio_tungstenite::tungstenite::{Error as WsError, Message};

const TOPIC: &str = "realtime:habyss-desktop";
const HEARTBEAT: Duration = Duration::from_secs(25);
/// No frame for this long (heartbeat replies included) means the connection is dead.
const SILENCE: Duration = Duration::from_secs(60);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(20);
/// How often the session is checked for a refreshed token, and how long to wait while signed out.
const RECHECK: Duration = Duration::from_secs(60);
const MAX_BACKOFF: u64 = 60;
/// A joined connection that lasted this long counts as healthy: the next retry starts again at 1 s.
const STABLE_MS: i64 = 30_000;

fn socket_url(config: &Config) -> String {
    let host = config.url.replacen("https://", "wss://", 1).replacen("http://", "ws://", 1);
    format!("{host}/realtime/v1/websocket?apikey={}&vsn=1.0.0", config.key)
}

/// Join payload: changes to the mirrored tables and the day's settings, only for this user's rows.
pub fn join_payload(user_id: &str, token: &str) -> Value {
    let changes: Vec<Value> = Table::ALL.iter().map(|t| t.remote()).chain(["day_inputs"]).map(|t| json!({"event": "*", "schema": "public", "table": t, "filter": format!("user_id=eq.{user_id}")})).collect();
    json!({"config": {"broadcast": {"self": false}, "presence": {"key": ""}, "postgres_changes": changes}, "access_token": token})
}

/// Seconds to wait before reconnecting, given the previous wait (0 at first). A connection that joined and stayed up
/// for 30 s resets it to 1; anything else (a failed connect or join, or a join the server drops at once) doubles it, up to 60.
pub fn next_backoff(prev: u64, uptime_ms: i64, ok: bool) -> u64 { if ok && uptime_ms >= STABLE_MS { 1 } else { (prev * 2).clamp(1, MAX_BACKOFF) } }

fn offline<E>(_: E) -> CloudError { CloudError::Offline }
fn refused(why: &str) -> CloudError { CloudError::Server { status: 0, code: "realtime".into(), message: why.into() } }
fn frame(event: &str, payload: Value, n: u64) -> Message { Message::text(json!({"topic": if event == "heartbeat" { "phoenix" } else { TOPIC }, "event": event, "payload": payload, "ref": n.to_string()}).to_string()) }

/// One connection: join, heartbeat, and call `on_change` once joined and for every `postgres_changes` message.
/// `Err` when the connection or the join failed; `Ok` when a joined connection later ended.
pub async fn realtime(config: Config, token: String, user_id: String, on_change: impl Fn()) -> Result<(), CloudError> {
    let (mut ws, _) = match tokio::time::timeout(CONNECT_TIMEOUT, tokio_tungstenite::connect_async(socket_url(&config))).await {
        Err(_) => return Err(CloudError::Offline),
        Ok(Err(WsError::Http(r))) => return Err(CloudError::Server { status: r.status().as_u16(), code: "realtime".into(), message: "handshake refused".into() }),
        Ok(r) => r.map_err(offline)?,
    };
    let mut n = 1;
    ws.send(frame("phx_join", join_payload(&user_id, &token), n)).await.map_err(offline)?;
    let (mut joined, mut seen) = (false, Instant::now());
    let mut beat = tokio::time::interval_at(tokio::time::Instant::now() + HEARTBEAT, HEARTBEAT);
    loop {
        tokio::select! {
            _ = beat.tick() => {
                if seen.elapsed() > SILENCE { break; }
                n += 1;
                if ws.send(frame("heartbeat", json!({}), n)).await.is_err() { break; }
            }
            msg = ws.next() => {
                let Some(Ok(msg)) = msg else { break };
                seen = Instant::now();
                let Message::Text(text) = msg else { continue };
                let v: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
                match (v["topic"].as_str(), v["event"].as_str()) {
                    (Some(TOPIC), Some("phx_reply")) if !joined && v["ref"] == "1" => {
                        if v["payload"]["status"] != "ok" { return Err(refused("join refused")); }
                        joined = true;
                        // Changes made while there was no connection (a drop, a token change, the Mac asleep) sent no message.
                        on_change();
                    }
                    (Some(TOPIC), Some("postgres_changes")) => on_change(),
                    (Some(TOPIC), Some("phx_error" | "phx_close")) => break,
                    // The payload can name tables or echo the filter; only the fact is logged.
                    (Some(TOPIC), Some("system")) if v["payload"]["status"] == "error" => eprintln!("[realtime] server reported an error"),
                    _ => {}
                }
            }
        }
    }
    if joined { Ok(()) } else { Err(CloudError::Offline) }
}

/// Resolves when the socket should be rejoined: the session's token changed, or the runner woke it (sign-in, sign-out).
async fn session_changed(auth: &Auth, token: &str, wake: &Notify) {
    loop {
        tokio::select! {
            _ = sleep(RECHECK) => if !matches!(auth.token().await, Ok(t) if t == token) { return },
            _ = wake.notified() => return,
        }
    }
}

/// Keeps one Realtime connection open while signed in, rejoining with the fresh token after each refresh.
pub async fn follow(config: Config, auth: Arc<Auth>, wake: Arc<Notify>, on_change: impl Fn()) {
    let mut backoff = 0;
    loop {
        let session = match auth.token().await { Ok(t) => auth.user_id().await.map(|u| (t, u)), Err(_) => None };
        let Some((token, user_id)) = session else {
            tokio::select! { _ = sleep(RECHECK) => {}, _ = wake.notified() => {} }
            continue;
        };
        let started = Instant::now();
        tokio::select! {
            r = realtime(config.clone(), token.clone(), user_id, &on_change) => {
                backoff = next_backoff(backoff, started.elapsed().as_millis() as i64, r.is_ok());
                match r {
                    Ok(()) => eprintln!("[realtime] disconnected; reconnecting in {backoff}s"),
                    Err(e) => eprintln!("[realtime] connection failed ({e}); retrying in {backoff}s"),
                }
                tokio::select! { _ = sleep(Duration::from_secs(backoff)) => {}, _ = wake.notified() => {} }
            }
            _ = session_changed(&auth, &token, &wake) => { backoff = 0; eprintln!("[realtime] session changed; reconnecting"); }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    #[test] fn join_message_filters_by_user() {
        let p = join_payload("u1", "tok");
        assert_eq!(p["access_token"], "tok");
        let changes = p["config"]["postgres_changes"].as_array().unwrap();
        let tables: Vec<&str> = changes.iter().map(|c| c["table"].as_str().unwrap()).collect();
        assert_eq!(tables, ["habits", "habit_completions", "tasks", "goal_milestones", "day_inputs"]);
        for c in changes { assert_eq!((c["event"].as_str(), c["schema"].as_str(), c["filter"].as_str()), (Some("*"), Some("public"), Some("user_id=eq.u1"))); }
    }
    #[test] fn socket_url_uses_websocket_scheme() {
        assert_eq!(socket_url(&Config { url: "https://x.supabase.co".into(), key: "k".into() }), "wss://x.supabase.co/realtime/v1/websocket?apikey=k&vsn=1.0.0");
    }
    #[test] fn backoff_doubles_up_to_a_minute() {
        let (mut s, mut seen) = (0, vec![]);
        for _ in 0..8 { s = next_backoff(s, 0, false); seen.push(s); }
        assert_eq!(seen, [1, 2, 4, 8, 16, 32, 60, 60]);
    }
    #[test] fn backoff_survives_flapping_joins() {
        // Joined, then dropped at once: still backs off.
        let (mut s, mut seen) = (0, vec![]);
        for _ in 0..4 { s = next_backoff(s, 200, true); seen.push(s); }
        assert_eq!(seen, [1, 2, 4, 8]);
        assert_eq!(next_backoff(60, 29_999, true), 60);
        // Only a connection that stayed up 30 s resets it.
        assert_eq!(next_backoff(60, 30_000, true), 1);
        assert_eq!(next_backoff(60, 120_000, false), 60);
    }
    #[tokio::test] async fn joins_then_reports_each_change() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        let server = tokio::spawn(async move {
            let mut ws = tokio_tungstenite::accept_async(listener.accept().await.unwrap().0).await.unwrap();
            let join: Value = serde_json::from_str(ws.next().await.unwrap().unwrap().to_text().unwrap()).unwrap();
            let reply = json!({"topic": TOPIC, "event": "phx_reply", "payload": {"status": "ok", "response": {}}, "ref": join["ref"]});
            ws.send(Message::text(reply.to_string())).await.unwrap();
            for _ in 0..2 { ws.send(Message::text(json!({"topic": TOPIC, "event": "postgres_changes", "payload": {}, "ref": null}).to_string())).await.unwrap(); }
            ws.close(None).await.unwrap();
            join
        });
        let hits = AtomicUsize::new(0);
        let r = realtime(Config { url, key: "k".into() }, "tok".into(), "u1".into(), || { hits.fetch_add(1, Ordering::SeqCst); }).await;
        let join = server.await.unwrap();
        assert!(r.is_ok());
        // One for the join (catching up on the gap), one for each change.
        assert_eq!(hits.load(Ordering::SeqCst), 3);
        assert_eq!((join["topic"].as_str(), join["event"].as_str()), (Some(TOPIC), Some("phx_join")));
    }
    #[tokio::test] async fn refused_join_is_an_error() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let url = format!("http://{}", listener.local_addr().unwrap());
        tokio::spawn(async move {
            let mut ws = tokio_tungstenite::accept_async(listener.accept().await.unwrap().0).await.unwrap();
            ws.next().await;
            ws.send(Message::text(json!({"topic": TOPIC, "event": "phx_reply", "payload": {"status": "error", "response": {}}, "ref": "1"}).to_string())).await.unwrap();
            let _ = ws.next().await;
        });
        let hits = AtomicUsize::new(0);
        assert!(realtime(Config { url, key: "k".into() }, "tok".into(), "u1".into(), || { hits.fetch_add(1, Ordering::SeqCst); }).await.is_err());
        assert_eq!(hits.load(Ordering::SeqCst), 0);
    }
}
