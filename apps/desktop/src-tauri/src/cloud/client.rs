use regex::Regex;
use reqwest::{Method, RequestBuilder};
use serde_json::Value;
use std::{fmt, time::Duration};

#[derive(Clone)]
pub struct Config { pub url: String, pub key: String }
impl Config {
    pub fn from_build() -> Option<Config> {
        let (url, key) = (option_env!("HABYSS_SUPABASE_URL")?, option_env!("HABYSS_SUPABASE_KEY")?);
        Some(Config { url: url.trim_end_matches('/').into(), key: key.into() })
    }
}

#[derive(Debug)]
pub enum CloudError { Offline, Unauthorized, Forbidden { message: String }, MissingColumn(String), MissingTable, Server { status: u16, code: String, message: String } }
impl fmt::Display for CloudError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CloudError::Offline => write!(f, "offline"),
            CloudError::Unauthorized => write!(f, "unauthorized"),
            CloudError::Forbidden { message } => write!(f, "forbidden: {message}"),
            CloudError::MissingColumn(c) => write!(f, "missing column {c}"),
            CloudError::MissingTable => write!(f, "missing table"),
            CloudError::Server { status, code, message } => write!(f, "server error {status} {code}: {message}"),
        }
    }
}
impl std::error::Error for CloudError {}

/// Port of `missingColumnFrom` / `missingTableFrom` (lib/cloudSync.ts) plus status mapping.
pub fn classify(status: u16, body: &str) -> CloudError {
    let json: Value = serde_json::from_str(body).unwrap_or(Value::Null);
    let text = |k: &str| json.get(k).and_then(Value::as_str).unwrap_or("").to_string();
    let (code, message) = (text("code"), if json.get("message").is_some() { text("message") } else { text("msg") });
    if status == 401 { return CloudError::Unauthorized; }
    if status == 403 || code == "42501" { return CloudError::Forbidden { message }; }
    let table = Regex::new(r#"(?i)could not find the table|relation "?[a-z_.]+"? does not exist"#).unwrap();
    if code == "PGRST205" || code == "42P01" || table.is_match(&message) { return CloudError::MissingTable; }
    for pattern in [r#"(?i)column "?([a-z_]+)"? of relation"#, r#"(?i)column [a-z_]+\.([a-z_]+) does not exist"#, r#"(?i)Could not find the '([a-z_]+)' column"#] {
        if let Some(c) = Regex::new(pattern).unwrap().captures(&message) { return CloudError::MissingColumn(c[1].to_string()); }
    }
    CloudError::Server { status, code, message }
}

/// Port of `lib/cloudPullPage.ts`: keyset paging ordered by (updated_at, id).
pub fn pull_query(user_id: &str, since: Option<&str>, after: Option<(&str, &str)>, limit: usize) -> Vec<(String, String)> {
    let mut q = vec![("select".to_string(), "*".to_string()), ("user_id".into(), format!("eq.{user_id}")), ("order".into(), "updated_at.asc,id.asc".into()), ("limit".into(), limit.to_string())];
    if let Some(s) = since { q.push(("updated_at".into(), format!("gte.{s}"))); }
    if let Some((t, id)) = after { q.push(("or".into(), format!("(updated_at.gt.{t},and(updated_at.eq.{t},id.gt.{id}))"))); }
    q
}

pub struct Client { pub config: Config, http: reqwest::Client }
impl Client {
    pub fn new(config: Config) -> Client {
        Client { config, http: reqwest::Client::builder().timeout(Duration::from_secs(20)).build().expect("http client") }
    }
    fn request(&self, method: Method, path: &str, token: Option<&str>) -> RequestBuilder {
        self.http.request(method, format!("{}/{path}", self.config.url)).header("apikey", &self.config.key).bearer_auth(token.unwrap_or(&self.config.key))
    }
    async fn send(&self, request: RequestBuilder) -> Result<String, CloudError> {
        let response = request.send().await.map_err(|e| if e.is_connect() || e.is_timeout() || e.is_request() { CloudError::Offline } else { CloudError::Server { status: 0, code: String::new(), message: e.without_url().to_string() } })?;
        let status = response.status().as_u16();
        let body = response.text().await.map_err(|_| CloudError::Offline)?;
        if (200..300).contains(&status) { Ok(body) } else { Err(classify(status, &body)) }
    }
    fn parse(body: &str) -> Value { serde_json::from_str(body).unwrap_or(Value::Null) }
    pub async fn select(&self, token: &str, table: &str, query: &[(String, String)]) -> Result<Vec<Value>, CloudError> {
        let body = self.send(self.request(Method::GET, &format!("rest/v1/{table}"), Some(token)).query(query)).await?;
        Ok(match Self::parse(&body) { Value::Array(rows) => rows, _ => vec![] })
    }
    pub async fn upsert(&self, token: &str, table: &str, on_conflict: &str, rows: &[Value]) -> Result<(), CloudError> {
        self.send(self.request(Method::POST, &format!("rest/v1/{table}"), Some(token)).query(&[("on_conflict", on_conflict)]).header("Prefer", "resolution=merge-duplicates,return=minimal").json(rows)).await.map(|_| ())
    }
    pub async fn delete(&self, token: &str, table: &str, query: &[(String, String)]) -> Result<(), CloudError> {
        self.send(self.request(Method::DELETE, &format!("rest/v1/{table}"), Some(token)).query(query)).await.map(|_| ())
    }
    pub async fn rpc(&self, token: &str, name: &str, args: &Value) -> Result<Value, CloudError> {
        Ok(Self::parse(&self.send(self.request(Method::POST, &format!("rest/v1/rpc/{name}"), Some(token)).json(args)).await?))
    }
    pub async fn auth_post(&self, path: &str, token: Option<&str>, body: &Value) -> Result<Value, CloudError> {
        Ok(Self::parse(&self.send(self.request(Method::POST, &format!("auth/v1/{path}"), token).json(body)).await?))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn pull_query_matches_mobile_keyset() {
        let q=pull_query("u1",Some("2026-11-02T10:00:00.5+00:00"),Some(("2026-11-02T10:00:01+00:00","abc")),1000);
        assert!(q.contains(&("user_id".into(),"eq.u1".into())));
        assert!(q.contains(&("order".into(),"updated_at.asc,id.asc".into())));
        assert!(q.contains(&("limit".into(),"1000".into())));
        assert!(q.contains(&("updated_at".into(),"gte.2026-11-02T10:00:00.5+00:00".into())));
        assert!(q.contains(&("or".into(),"(updated_at.gt.2026-11-02T10:00:01+00:00,and(updated_at.eq.2026-11-02T10:00:01+00:00,id.gt.abc))".into())));
    }
    #[test] fn classify_matches_mobile_error_rules() {
        assert!(matches!(classify(400,r#"{"code":"PGRST204","message":"Could not find the 'section' column of 'tasks' in the schema cache"}"#),CloudError::MissingColumn(c) if c=="section"));
        assert!(matches!(classify(404,r#"{"code":"PGRST205","message":"Could not find the table 'public.tasks'"}"#),CloudError::MissingTable));
        assert!(matches!(classify(401,"{}"),CloudError::Unauthorized));
        assert!(matches!(classify(403,r#"{"code":"42501","message":"new row violates row-level security policy"}"#),CloudError::Forbidden{..}));
    }
    #[tokio::test] async fn plus_in_timestamp_is_percent_encoded_on_the_wire() {
        let mut server=mockito::Server::new_async().await;
        let m=server.mock("GET",mockito::Matcher::Regex(r"updated_at=gte\.2026-11-02T10%3A00%3A00%2B00%3A00".into())).with_body("[]").create_async().await;
        let c=Client::new(Config{url:server.url(),key:"k".into()});
        c.select("t","habits",&pull_query("u",Some("2026-11-02T10:00:00+00:00"),None,1000)).await.unwrap();
        m.assert_async().await;
    }
}
