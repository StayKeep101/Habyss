use super::client::{Client, CloudError};
use crate::storage::Result;
use serde_json::{json, Value};
use std::sync::Arc;

pub trait SecretStore: Send + Sync { fn get(&self) -> Option<String>; fn set(&self, v: &str) -> Result<()>; fn clear(&self) -> Result<()>; }

pub struct Keychain;
impl Keychain { fn entry() -> Result<keyring::Entry> { Ok(keyring::Entry::new("com.habyss.desktop", "supabase-refresh-token")?) } }
impl SecretStore for Keychain {
    fn get(&self) -> Option<String> { Self::entry().ok()?.get_password().ok() }
    fn set(&self, v: &str) -> Result<()> { Ok(Self::entry()?.set_password(v)?) }
    fn clear(&self) -> Result<()> { match Self::entry()?.delete_credential() { Ok(()) | Err(keyring::Error::NoEntry) => Ok(()), Err(e) => Err(e.into()) } }
}

#[cfg(test)]
#[derive(Default)]
pub struct MemorySecret(std::sync::Mutex<Option<String>>);
#[cfg(test)]
impl SecretStore for MemorySecret {
    fn get(&self) -> Option<String> { self.0.lock().unwrap().clone() }
    fn set(&self, v: &str) -> Result<()> { *self.0.lock().unwrap() = Some(v.into()); Ok(()) }
    fn clear(&self) -> Result<()> { *self.0.lock().unwrap() = None; Ok(()) }
}

#[derive(Clone)]
pub struct Session { pub access_token: String, pub user_id: String, pub email: Option<String>, pub expires_at: i64 }

pub struct Auth { client: Arc<Client>, secret: Arc<dyn SecretStore>, session: tokio::sync::Mutex<Option<Session>> }

fn now() -> i64 { chrono::Utc::now().timestamp() }
fn bad() -> CloudError { CloudError::Server { status: 0, code: String::new(), message: "malformed auth response".into() } }

impl Auth {
    pub fn new(client: Arc<Client>, secret: Arc<dyn SecretStore>) -> Auth { Auth { client, secret, session: tokio::sync::Mutex::new(None) } }

    #[cfg(test)]
    pub(crate) async fn set_session(&self, s: Session) { *self.session.lock().await = Some(s); }

    pub async fn send_code(&self, email: &str) -> std::result::Result<(), CloudError> {
        self.client.auth_post("otp", None, &json!({"email": email, "create_user": true})).await.map(|_| ())
    }
    pub async fn verify_code(&self, email: &str, code: &str) -> std::result::Result<Session, CloudError> {
        let v = self.client.auth_post("verify", None, &json!({"type": "email", "email": email, "token": code})).await?;
        self.adopt(&v).await
    }
    pub async fn sign_in_password(&self, email: &str, password: &str) -> std::result::Result<Session, CloudError> {
        let v = self.client.auth_post("token?grant_type=password", None, &json!({"email": email, "password": password})).await?;
        self.adopt(&v).await
    }
    /// Refresh from the Keychain token at launch. Offline keeps the token for a later retry.
    pub async fn restore(&self) -> std::result::Result<Option<Session>, CloudError> {
        let mut guard = self.session.lock().await;
        let Some(rt) = self.secret.get() else { return Ok(None) };
        match self.refresh(&rt).await {
            Ok(s) => { *guard = Some(s.clone()); Ok(Some(s)) }
            Err(CloudError::Offline) => Ok(None),
            Err(CloudError::Server { status: 400, .. }) | Err(CloudError::Unauthorized) => { self.drop_session(&mut guard); Err(CloudError::Unauthorized) }
            Err(e) => Err(e),
        }
    }
    pub async fn user_id(&self) -> Option<String> { self.session.lock().await.as_ref().map(|s| s.user_id.clone()) }
    /// The server rejected the access token: the next `token()` refreshes it.
    pub async fn expire(&self) { if let Some(s) = self.session.lock().await.as_mut() { s.expires_at = 0; } }
    pub async fn token(&self) -> std::result::Result<String, CloudError> {
        let mut guard = self.session.lock().await;
        if let Some(s) = guard.as_ref() { if s.expires_at - now() >= 60 { return Ok(s.access_token.clone()); } }
        let Some(rt) = self.secret.get() else { *guard = None; return Err(CloudError::Unauthorized) };
        match self.refresh(&rt).await {
            Ok(s) => { let t = s.access_token.clone(); *guard = Some(s); Ok(t) }
            Err(CloudError::Server { status: 400, .. }) | Err(CloudError::Unauthorized) => { self.drop_session(&mut guard); Err(CloudError::Unauthorized) }
            Err(e) => Err(e),
        }
    }
    /// Best-effort server logout, then forget the session and refresh token. Local data is kept.
    pub async fn sign_out(&self) {
        let mut guard = self.session.lock().await;
        if let Some(s) = guard.as_ref() { let _ = self.client.auth_post("logout", Some(&s.access_token), &json!({})).await; }
        self.drop_session(&mut guard);
    }

    fn drop_session(&self, guard: &mut Option<Session>) { let _ = self.secret.clear(); *guard = None; }
    async fn refresh(&self, refresh_token: &str) -> std::result::Result<Session, CloudError> {
        let v = self.client.auth_post("token?grant_type=refresh_token", None, &json!({"refresh_token": refresh_token})).await?;
        self.parse_and_store(&v)
    }
    async fn adopt(&self, v: &Value) -> std::result::Result<Session, CloudError> {
        let s = self.parse_and_store(v)?;
        *self.session.lock().await = Some(s.clone());
        Ok(s)
    }
    fn parse_and_store(&self, v: &Value) -> std::result::Result<Session, CloudError> {
        let text = |x: Option<&Value>| x.and_then(Value::as_str).map(str::to_string);
        let (access, refresh) = (text(v.get("access_token")).ok_or_else(bad)?, text(v.get("refresh_token")).ok_or_else(bad)?);
        let user_id = text(v.pointer("/user/id")).ok_or_else(bad)?;
        let expires_at = v.get("expires_at").and_then(Value::as_i64).or_else(|| v.get("expires_in").and_then(Value::as_i64).map(|n| now() + n)).ok_or_else(bad)?;
        self.secret.set(&refresh).map_err(|_| CloudError::Server { status: 0, code: String::new(), message: "could not store refresh token".into() })?;
        Ok(Session { access_token: access, user_id, email: text(v.pointer("/user/email")), expires_at })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cloud::client::Config;
    fn auth(url: String) -> (Auth, Arc<MemorySecret>) {
        let secret = Arc::new(MemorySecret::default());
        (Auth::new(Arc::new(Client::new(Config { url, key: "k".into() })), secret.clone()), secret)
    }
    fn session_body(access: &str, refresh: &str) -> String { json!({"access_token": access, "refresh_token": refresh, "expires_in": 3600, "user": {"id": "u1", "email": "a@b.c"}}).to_string() }

    #[tokio::test] async fn verify_code_stores_refresh_token_and_returns_user() {
        let mut server = mockito::Server::new_async().await;
        let m = server.mock("POST", "/auth/v1/verify").match_body(mockito::Matcher::Json(json!({"type": "email", "email": "a@b.c", "token": "123456"}))).with_body(session_body("at", "rt1")).create_async().await;
        let (a, secret) = auth(server.url());
        let s = a.verify_code("a@b.c", "123456").await.unwrap();
        m.assert_async().await;
        assert_eq!((s.user_id.as_str(), s.email.as_deref(), s.access_token.as_str()), ("u1", Some("a@b.c"), "at"));
        assert!(s.expires_at > now() + 3000);
        assert_eq!(secret.get().as_deref(), Some("rt1"));
        assert_eq!(a.token().await.unwrap(), "at");
    }
    #[tokio::test] async fn expired_token_refreshes_once() {
        let mut server = mockito::Server::new_async().await;
        let m = server.mock("POST", "/auth/v1/token?grant_type=refresh_token").match_body(mockito::Matcher::Json(json!({"refresh_token": "rt1"}))).with_body(session_body("at2", "rt2")).expect(1).create_async().await;
        let (a, secret) = auth(server.url());
        secret.set("rt1").unwrap();
        a.set_session(Session { access_token: "old".into(), user_id: "u1".into(), email: None, expires_at: now() - 10 }).await;
        assert_eq!(a.token().await.unwrap(), "at2");
        assert_eq!(a.token().await.unwrap(), "at2");
        m.assert_async().await;
        assert_eq!(secret.get().as_deref(), Some("rt2"));
    }
    #[tokio::test] async fn rejected_refresh_signs_out_but_keeps_nothing_secret() {
        let mut server = mockito::Server::new_async().await;
        server.mock("POST", "/auth/v1/token?grant_type=refresh_token").with_status(400).with_body(r#"{"error":"invalid_grant"}"#).create_async().await;
        let (a, secret) = auth(server.url());
        secret.set("rt1").unwrap();
        a.set_session(Session { access_token: "old".into(), user_id: "u1".into(), email: None, expires_at: now() - 10 }).await;
        assert!(matches!(a.token().await, Err(CloudError::Unauthorized)));
        assert!(secret.get().is_none());
        assert!(a.session.lock().await.is_none());
    }
    #[tokio::test] async fn restore_keeps_token_on_server_error() {
        let mut server = mockito::Server::new_async().await;
        server.mock("POST", "/auth/v1/token?grant_type=refresh_token").with_status(500).with_body("{}").create_async().await;
        let (a, secret) = auth(server.url());
        secret.set("rt1").unwrap();
        assert!(matches!(a.restore().await, Err(CloudError::Server { status: 500, .. })));
        assert_eq!(secret.get().as_deref(), Some("rt1"));
    }
    #[tokio::test] async fn restore_after_sign_out_does_nothing() {
        let mut server = mockito::Server::new_async().await;
        let m = server.mock("POST", mockito::Matcher::Any).expect(0).create_async().await;
        let (a, secret) = auth(server.url());
        secret.set("rt1").unwrap();
        a.sign_out().await;
        assert!(matches!(a.restore().await, Ok(None)));
        assert!(secret.get().is_none());
        m.assert_async().await;
    }
    #[tokio::test] async fn restore_offline_keeps_token() {
        let (a, secret) = auth("http://127.0.0.1:9".into());
        secret.set("rt1").unwrap();
        assert!(matches!(a.restore().await, Ok(None)));
        assert_eq!(secret.get().as_deref(), Some("rt1"));
    }
}
