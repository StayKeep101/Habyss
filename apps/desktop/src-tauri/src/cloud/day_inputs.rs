//! The day's settings mirrored from `public.day_inputs` (one row per key: window, meals, travel, day memory, events…),
//! so this Mac builds the same day as the phone. Same rule as the other mirrors: a server row never overwrites a local
//! edit that has not been sent.
use crate::storage::Result;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::{json, Map, Value};

/// The server's rule (`key ~ '^[a-z_]+(:.+)?$'`, at most 200 characters), checked before anything is stored or sent.
pub fn valid_key(key: &str) -> bool {
    if key.is_empty() || key.chars().count() > 200 { return false; }
    let (name, rest) = match key.split_once(':') { Some((n, r)) => (n, Some(r)), None => (key, None) };
    !name.is_empty() && name.chars().all(|c| c.is_ascii_lowercase() || c == '_') && rest.is_none_or(|r| !r.is_empty())
}

/// Every key with its value, removals left out.
pub fn live(c: &Connection) -> Result<Map<String, Value>> {
    let mut q = c.prepare("SELECT key,value FROM cloud_day_inputs WHERE deleted=0 ORDER BY key")?;
    let rows = q.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
    let mut out = Map::new();
    for row in rows { let (k, v) = row?; out.insert(k, serde_json::from_str(&v).unwrap_or(Value::Null)); }
    Ok(out)
}

/// A change made on this Mac (`None` removes the key), sent on the next sync.
pub fn set_local(c: &Connection, key: &str, value: Option<Value>, at: &str) -> Result<()> {
    if !valid_key(key) { return Err(format!("Invalid day setting: {key}").into()); }
    let (text, deleted) = match &value { Some(v) => (v.to_string(), 0), None => ("null".to_string(), 1) };
    c.execute("INSERT INTO cloud_day_inputs(key,value,updated_at,deleted,synced) VALUES(?1,?2,?3,?4,0) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,deleted=excluded.deleted,synced=0", params![key, text, at, deleted])?;
    Ok(())
}

/// A row from the server: `{key, value, updated_at, deleted_at}`. Never replaces an unsent local edit.
pub fn write_remote(c: &Connection, row: &Value) -> Result<usize> {
    let Some(key) = row["key"].as_str().filter(|k| valid_key(k)) else { return Ok(0) };
    let deleted = !row["deleted_at"].is_null();
    Ok(c.execute("INSERT INTO cloud_day_inputs(key,value,updated_at,deleted,synced) VALUES(?1,?2,?3,?4,1) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,deleted=excluded.deleted WHERE cloud_day_inputs.synced=1",
        params![key, row["value"].to_string(), row["updated_at"].as_str(), deleted as i64])?)
}

/// Edits not sent yet: `{key, value, deleted, updated_at}`.
pub fn unsent(c: &Connection) -> Result<Vec<Value>> {
    let mut q = c.prepare("SELECT key,value,deleted,updated_at FROM cloud_day_inputs WHERE synced=0 ORDER BY key")?;
    let rows = q.query_map([], |r| Ok(json!({"key": r.get::<_, String>(0)?, "value": serde_json::from_str::<Value>(&r.get::<_, String>(1)?).unwrap_or(Value::Null), "deleted": r.get::<_, i64>(2)? != 0, "updated_at": r.get::<_, Option<String>>(3)?})))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

/// Marks edits sent, only those unchanged since `unsent` read them, so an edit made during the upload stays pending.
pub fn mark_sent(c: &Connection, sent: &[Value]) -> Result<()> {
    for r in sent { c.execute("UPDATE cloud_day_inputs SET synced=1 WHERE key=?1 AND updated_at IS ?2", params![r["key"].as_str(), r["updated_at"].as_str()])?; }
    Ok(())
}

pub fn cursor(c: &Connection) -> Result<Option<String>> { Ok(c.query_row("SELECT cursor FROM cloud_cursors WHERE table_name='day_inputs'", [], |r| r.get(0)).optional()?) }
pub fn set_cursor(c: &Connection, v: &str) -> Result<()> { c.execute("INSERT INTO cloud_cursors VALUES('day_inputs',?1) ON CONFLICT(table_name) DO UPDATE SET cursor=excluded.cursor", [v])?; Ok(()) }

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::Store;
    use serde_json::json;
    use std::path::Path;

    const AT: &str = "2026-11-26T10:00:00.000Z";
    fn store() -> Store { Store::open(Path::new(":memory:")).unwrap() }

    #[test]
    fn keys_follow_the_server_rule() {
        for ok in ["meals", "day_window", "travel:@2@school", "travel:#2026-11-26#E1", "day_memory:2026-11-26"] { assert!(valid_key(ok), "{ok}"); }
        for bad in ["Meals!", "", "meals ", ":x", "day-window", &"a".repeat(201)] { assert!(!valid_key(bad), "{bad}"); }
    }

    #[test]
    fn server_rows_show_unless_an_unsent_edit_is_waiting() {
        let s = store();
        write_remote(&s.conn, &json!({"key": "meals", "value": {"lunch": 1}, "updated_at": AT, "deleted_at": null})).unwrap();
        assert_eq!(live(&s.conn).unwrap()["meals"], json!({"lunch": 1}));
        set_local(&s.conn, "meals", Some(json!({"lunch": 2})), AT).unwrap();
        write_remote(&s.conn, &json!({"key": "meals", "value": {"lunch": 3}, "updated_at": "2026-11-27T00:00:00Z", "deleted_at": null})).unwrap();
        assert_eq!(live(&s.conn).unwrap()["meals"], json!({"lunch": 2}));
        assert_eq!(unsent(&s.conn).unwrap(), vec![json!({"key": "meals", "value": {"lunch": 2}, "deleted": false, "updated_at": AT})]);
    }

    #[test]
    fn sent_edits_stop_being_pending_only_if_unchanged() {
        let s = store();
        set_local(&s.conn, "peak", Some(json!({"start": 540, "end": 720})), AT).unwrap();
        let pending = unsent(&s.conn).unwrap();
        set_local(&s.conn, "peak", Some(json!(null)), "2026-11-26T10:00:01.000Z").unwrap();
        mark_sent(&s.conn, &pending).unwrap();
        assert_eq!(unsent(&s.conn).unwrap().len(), 1);
        mark_sent(&s.conn, &unsent(&s.conn).unwrap()).unwrap();
        assert!(unsent(&s.conn).unwrap().is_empty());
    }

    #[test]
    fn removals_hide_the_key_and_are_sent() {
        let s = store();
        write_remote(&s.conn, &json!({"key": "travel:school", "value": {"before": 30, "after": 30}, "updated_at": AT, "deleted_at": null})).unwrap();
        set_local(&s.conn, "travel:school", None, AT).unwrap();
        assert!(!live(&s.conn).unwrap().contains_key("travel:school"));
        assert_eq!(unsent(&s.conn).unwrap()[0]["deleted"], json!(true));
        write_remote(&s.conn, &json!({"key": "travel:gym", "value": {"before": 5, "after": 5}, "updated_at": AT, "deleted_at": AT})).unwrap();
        assert!(!live(&s.conn).unwrap().contains_key("travel:gym"));
    }
}
