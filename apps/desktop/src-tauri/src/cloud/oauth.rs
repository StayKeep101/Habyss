//! Sign in with Apple or Google.
//!
//! The browser does the provider's sign-in, then comes back to a one-time
//! address on this Mac (127.0.0.1 on a free port) with a code. The code is
//! exchanged for a session with this run's verifier (OAuth with PKCE), so a
//! code seen by anyone else is useless to them.
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use sha2::{Digest, Sha256};
use std::time::Duration;
use tokio::{io::{AsyncReadExt, AsyncWriteExt}, net::TcpListener};

pub const PROVIDERS: [&str; 2] = ["apple", "google"];
/// Long enough to type a password and pass two-factor; then the address closes.
const WAIT: Duration = Duration::from_secs(300);

pub fn verifier() -> String { format!("{}{}", uuid::Uuid::new_v4().simple(), uuid::Uuid::new_v4().simple()) }
pub fn challenge(verifier: &str) -> String { URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes())) }

fn encode(s: &str) -> String {
    s.bytes().map(|b| match b {
        b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
        _ => format!("%{b:02X}"),
    }).collect()
}
fn decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'+' => { out.push(b' '); i += 1; }
            b'%' if i + 2 < bytes.len() => match std::str::from_utf8(&bytes[i + 1..i + 3]).ok().and_then(|h| u8::from_str_radix(h, 16).ok()).ok_or(()) {
                Ok(b) => { out.push(b); i += 3; }
                Err(_) => { out.push(b'%'); i += 1; }
            },
            b => { out.push(b); i += 1; }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub fn authorize_url(base: &str, provider: &str, redirect: &str, challenge: &str) -> String {
    format!("{base}/auth/v1/authorize?provider={provider}&redirect_to={}&code_challenge={challenge}&code_challenge_method=s256", encode(redirect))
}

/// What the browser brought back on `GET /callback?...`: the code, or why there is none.
/// `None` for any other request (a favicon), which is not the answer.
pub fn code_from(request_line: &str) -> Option<Result<String, String>> {
    let target = request_line.split_whitespace().nth(1)?;
    let (path, query) = target.split_once('?').unwrap_or((target, ""));
    if path != "/callback" { return None; }
    let params: Vec<(String, String)> = query.split('&').filter_map(|p| p.split_once('=')).map(|(k, v)| (k.to_string(), decode(v))).collect();
    let get = |k: &str| params.iter().find(|(key, _)| key == k).map(|(_, v)| v.clone()).filter(|v| !v.is_empty());
    Some(match (get("code"), get("error_description").or_else(|| get("error"))) {
        (Some(code), _) => Ok(code),
        (None, Some(why)) => Err(why),
        (None, None) => Err("The browser came back without a sign-in".into()),
    })
}

const PAGE: &str = "<!doctype html><meta charset=utf-8><title>Habyss</title><body style=\"font:17px -apple-system,system-ui;display:grid;place-items:center;height:90vh;margin:0;background:#0b0b0f;color:#f2f2f5\"><p>%MESSAGE%</p></body>";

/// A free port on this Mac, and where the browser should come back to.
pub async fn listen() -> std::io::Result<(TcpListener, String)> {
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    Ok((listener, format!("http://127.0.0.1:{port}/callback")))
}

/// Waits for the browser, answers it with a short page, and returns the code.
pub async fn wait_for_code(listener: TcpListener) -> Result<String, String> {
    let answer = async {
        loop {
            let (mut stream, _) = listener.accept().await.map_err(|e| e.to_string())?;
            let mut buf = vec![0u8; 8192];
            let n = stream.read(&mut buf).await.unwrap_or(0);
            let text = String::from_utf8_lossy(&buf[..n]);
            let Some(result) = code_from(text.lines().next().unwrap_or("")) else {
                let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;
                continue;
            };
            let message = if result.is_ok() { "Signed in. You can go back to Habyss." } else { "Not signed in. You can go back to Habyss and try again." };
            let body = PAGE.replace("%MESSAGE%", message);
            let _ = stream.write_all(format!("HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len()).as_bytes()).await;
            return result;
        }
    };
    tokio::time::timeout(WAIT, answer).await.unwrap_or_else(|_| Err("Sign-in timed out. Try again.".into()))
}

/// Opens the address in the default browser.
pub fn open_browser(url: &str) -> std::io::Result<()> {
    #[cfg(target_os = "macos")]
    { std::process::Command::new("open").arg(url).spawn().map(|_| ()) }
    #[cfg(target_os = "windows")]
    { std::process::Command::new("rundll32").args(["url.dll,FileProtocolHandler", url]).spawn().map(|_| ()) }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    { std::process::Command::new("xdg-open").arg(url).spawn().map(|_| ()) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn challenge_is_s256_base64url() {
        // base64url(sha256(verifier)) without padding, checked against Python's hashlib.
        assert_eq!(challenge("dBjftJeZ4CVP-mJ92IOTPoEnhoq5gOmsiMLYcvkAqE2y"), "ajdiCWCaDbeL3a_d0R4gJaPxa4CnaJrAEKvIHSGp89c");
        assert!(verifier().len() >= 43);
    }
    #[test] fn authorize_url_names_provider_return_and_challenge() {
        let url = authorize_url("https://x.supabase.co", "google", "http://127.0.0.1:5000/callback", "abc");
        assert_eq!(url, "https://x.supabase.co/auth/v1/authorize?provider=google&redirect_to=http%3A%2F%2F127.0.0.1%3A5000%2Fcallback&code_challenge=abc&code_challenge_method=s256");
    }
    #[test] fn reads_the_code_or_the_reason() {
        assert_eq!(code_from("GET /callback?code=a1-b2 HTTP/1.1"), Some(Ok("a1-b2".into())));
        assert_eq!(code_from("GET /callback?error=access_denied&error_description=User+cancelled%21 HTTP/1.1"), Some(Err("User cancelled!".into())));
        assert_eq!(code_from("GET /favicon.ico HTTP/1.1"), None);
        assert!(matches!(code_from("GET /callback HTTP/1.1"), Some(Err(_))));
    }
    #[tokio::test] async fn waits_past_other_requests_for_the_callback() {
        let (listener, redirect) = listen().await.unwrap();
        let addr = redirect.trim_start_matches("http://").trim_end_matches("/callback").to_string();
        let waiting = tokio::spawn(wait_for_code(listener));
        let send = |line: &'static str, addr: String| async move {
            let mut s = tokio::net::TcpStream::connect(addr).await.unwrap();
            s.write_all(format!("{line}\r\nHost: x\r\n\r\n").as_bytes()).await.unwrap();
            let mut out = String::new(); let _ = s.read_to_string(&mut out).await; out
        };
        assert!(send("GET /favicon.ico HTTP/1.1", addr.clone()).await.starts_with("HTTP/1.1 404"));
        assert!(send("GET /callback?code=xyz HTTP/1.1", addr).await.contains("Signed in"));
        assert_eq!(waiting.await.unwrap(), Ok("xyz".into()));
    }
}
