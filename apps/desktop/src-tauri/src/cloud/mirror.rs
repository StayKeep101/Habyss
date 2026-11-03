//! Local mirror of the account's Supabase rows (`cloud_*` tables) and the operations sync needs on them.
//! Port of mobile `writeLocal`. Column names in dynamic SQL come only from `PRAGMA table_info`, never from row keys.
use crate::storage::Result;
use rusqlite::{params, params_from_iter, types::{Value as Sql, ValueRef}, Connection, OptionalExtension};
use serde_json::{json, Map, Value};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Table { Habits, Completions, Tasks, Milestones }
impl Table {
    pub const ALL: [Table; 4] = [Table::Habits, Table::Completions, Table::Tasks, Table::Milestones];
    pub fn local(&self) -> &'static str { match self { Table::Habits => "cloud_habits", Table::Completions => "cloud_completions", Table::Tasks => "cloud_tasks", Table::Milestones => "cloud_milestones" } }
    pub fn remote(&self) -> &'static str { match self { Table::Habits => "habits", Table::Completions => "habit_completions", Table::Tasks => "tasks", Table::Milestones => "goal_milestones" } }
    pub fn on_conflict(&self) -> &'static str { match self { Table::Completions => "user_id,habit_id,date", _ => "id" } }
    pub fn local_conflict(&self) -> &'static str { match self { Table::Completions => "habit_id,date", _ => "id" } }
}

fn to_sql(v: &Value) -> Sql {
    match v {
        Value::Null => Sql::Null,
        Value::Bool(b) => Sql::Integer(*b as i64),
        Value::Number(n) => n.as_i64().map(Sql::Integer).unwrap_or_else(|| Sql::Real(n.as_f64().unwrap_or(0.0))),
        Value::String(s) => Sql::Text(s.clone()),
        other => Sql::Text(other.to_string()),
    }
}
fn from_sql(v: ValueRef<'_>) -> Value {
    match v {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) => json!(i),
        ValueRef::Real(f) => if f.fract() == 0.0 && f.abs() < 9e15 { json!(f as i64) } else { json!(f) },
        ValueRef::Text(t) => json!(String::from_utf8_lossy(t)),
        ValueRef::Blob(_) => Value::Null,
    }
}
/// The table's real columns: the allowlist for every dynamic statement.
fn columns(c: &Connection, t: Table) -> Result<Vec<String>> {
    let mut q = c.prepare(&format!("PRAGMA table_info({})", t.local()))?;
    let cols = q.query_map([], |r| r.get::<_, String>(1))?.collect::<rusqlite::Result<_>>()?;
    Ok(cols)
}
pub fn select(c: &Connection, t: Table, filter: &str) -> Result<Vec<Value>> {
    let mut q = c.prepare(&format!("SELECT * FROM {} {} ORDER BY rowid", t.local(), filter))?;
    let names: Vec<String> = q.column_names().iter().map(|s| s.to_string()).collect();
    let rows = q.query_map([], |r| {
        let mut o = Map::new();
        for (i, n) in names.iter().enumerate() { o.insert(n.clone(), from_sql(r.get_ref(i)?)); }
        Ok(Value::Object(o))
    })?.collect::<rusqlite::Result<_>>()?;
    Ok(rows)
}

/// Insert or update from `row`. `guarded` applies the sync rule: only a synced row whose `updated_at` differs is replaced.
fn upsert(c: &Connection, t: Table, row: &Value, keep: &[&str], guarded: bool) -> Result<usize> {
    let obj = row.as_object().ok_or("row must be an object")?;
    let real = columns(c, t)?;
    let cols: Vec<&String> = real.iter().filter(|n| obj.contains_key(n.as_str())).collect();
    if cols.is_empty() { return Ok(0); }
    let key: Vec<&str> = t.local_conflict().split(',').collect();
    let sets: Vec<String> = cols.iter().filter(|n| !keep.contains(&n.as_str()) && !key.contains(&n.as_str()))
        .map(|n| format!("{n}=excluded.{n}")).collect();
    let names = cols.iter().map(|n| n.as_str()).collect::<Vec<_>>().join(",");
    let marks = (1..=cols.len()).map(|i| format!("?{i}")).collect::<Vec<_>>().join(",");
    let action = if sets.is_empty() { "DO NOTHING".to_string() } else {
        let guard = if guarded { format!(" WHERE {0}.synced=1 AND {0}.updated_at IS NOT excluded.updated_at", t.local()) } else { String::new() };
        format!("DO UPDATE SET {}{}", sets.join(","), guard)
    };
    let sql = format!("INSERT INTO {} ({names}) VALUES ({marks}) ON CONFLICT({}) {action}", t.local(), t.local_conflict());
    Ok(c.execute(&sql, params_from_iter(cols.iter().map(|n| to_sql(&obj[n.as_str()]))))?)
}

/// Write a row that came from the server. Never overwrites an unsent local edit. `keep` lists columns left untouched on update.
pub fn write_local(c: &Connection, t: Table, row: &Value, keep: &[&str]) -> Result<usize> { upsert(c, t, row, keep, true) }

pub fn unsynced(c: &Connection, t: Table) -> Result<Vec<Value>> { select(c, t, "WHERE synced=0 AND refused=0") }

/// Marks rows synced only if they are unchanged since they were read, so an edit made during upload stays pending.
pub fn mark_uploaded(c: &Connection, t: Table, rows: &[Value]) -> Result<usize> {
    let sql = format!("UPDATE {} SET synced=1 WHERE id=?1 AND updated_at IS ?2", t.local());
    let mut n = 0;
    for r in rows { n += c.execute(&sql, params![to_sql(&r["id"]), to_sql(&r["updated_at"])])?; }
    Ok(n)
}
pub fn mark_refused(c: &Connection, t: Table, id: &str) -> Result<()> { c.execute(&format!("UPDATE {} SET refused=1 WHERE id=?1", t.local()), [id])?; Ok(()) }

pub fn cursor(c: &Connection, t: Table) -> Result<Option<String>> { Ok(c.query_row("SELECT cursor FROM cloud_cursors WHERE table_name=?1", [t.remote()], |r| r.get(0)).optional()?) }
pub fn set_cursor(c: &Connection, t: Table, v: &str) -> Result<()> { c.execute("INSERT INTO cloud_cursors VALUES(?1,?2) ON CONFLICT(table_name) DO UPDATE SET cursor=excluded.cursor", params![t.remote(), v])?; Ok(()) }

pub fn account(c: &Connection) -> Result<Option<(String, Option<String>)>> { Ok(c.query_row("SELECT user_id,email FROM cloud_account WHERE id=1", [], |r| Ok((r.get(0)?, r.get(1)?))).optional()?) }
/// One account per database: a different user clears the mirror first, in the same transaction.
pub fn set_account(c: &Connection, user_id: &str, email: Option<&str>) -> Result<()> {
    let tx = c.unchecked_transaction()?;
    if account(&tx)?.map_or(false, |(u, _)| u != user_id) { clear_cloud(&tx)?; }
    tx.execute("INSERT INTO cloud_account(id,user_id,email) VALUES(1,?1,?2) ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id,email=excluded.email", params![user_id, email])?;
    tx.commit()?;
    Ok(())
}
/// Empties every `cloud_*` table. Activity tables are untouched.
pub fn clear_cloud(c: &Connection) -> Result<()> {
    c.execute_batch("DELETE FROM cloud_habits; DELETE FROM cloud_completions; DELETE FROM cloud_tasks; DELETE FROM cloud_milestones; DELETE FROM cloud_cursors; DELETE FROM cloud_account; DELETE FROM cloud_cache; DELETE FROM cloud_outbox; DELETE FROM cloud_shared_ids;")?;
    Ok(())
}
/// (pending, refused) over the four mirror tables.
pub fn counts(c: &Connection) -> Result<(i64, i64)> {
    let (mut p, mut r) = (0, 0);
    for t in Table::ALL {
        p += c.query_row(&format!("SELECT COUNT(*) FROM {} WHERE synced=0 AND refused=0", t.local()), [], |x| x.get::<_, i64>(0))?;
        r += c.query_row(&format!("SELECT COUNT(*) FROM {} WHERE refused=1", t.local()), [], |x| x.get::<_, i64>(0))?;
    }
    Ok((p, r))
}

/// A desktop edit: stamps the row as this user's, unsent and not refused. Friends' goals and milestones are read-only.
pub fn save_local(c: &Connection, t: Table, mut row: Value, user_id: &str, now: &str) -> Result<()> {
    let id = row.get("id").and_then(Value::as_str).ok_or("row needs an id")?.to_string();
    if matches!(t, Table::Habits | Table::Milestones) {
        let owner: Option<Option<String>> = c.query_row(&format!("SELECT owner_id FROM {} WHERE id=?1", t.local()), [&id], |r| r.get(0)).optional()?;
        if owner.flatten().map_or(false, |o| o != user_id) { return Err("This belongs to a friend and is read-only".into()); }
    }
    let o = row.as_object_mut().ok_or("row must be an object")?;
    o.insert("user_id".into(), json!(user_id));
    o.insert("updated_at".into(), json!(now));
    o.insert("synced".into(), json!(0));
    o.insert("refused".into(), json!(0));
    // created_at defaults only for a new row; an existing row keeps its own.
    let exists: bool = c.query_row(&format!("SELECT EXISTS(SELECT 1 FROM {} WHERE id=?1)", t.local()), [&id], |r| r.get(0))?;
    if !exists && !o.contains_key("created_at") { o.insert("created_at".into(), json!(now)); }
    upsert(c, t, &row, &[], false)?;
    Ok(())
}

pub fn cache_get(c: &Connection, key: &str) -> Result<Option<(Value, String)>> {
    let r: Option<(String, String)> = c.query_row("SELECT json,fetched_at FROM cloud_cache WHERE key=?1", [key], |r| Ok((r.get(0)?, r.get(1)?))).optional()?;
    r.map(|(j, f)| Ok((serde_json::from_str(&j)?, f))).transpose()
}
pub fn cache_put(c: &Connection, key: &str, v: &Value, now: &str) -> Result<()> {
    c.execute("INSERT INTO cloud_cache VALUES(?1,?2,?3) ON CONFLICT(key) DO UPDATE SET json=excluded.json,fetched_at=excluded.fetched_at", params![key, v.to_string(), now])?;
    Ok(())
}

pub fn outbox_push(c: &Connection, kind: &str, payload: &Value, now: &str) -> Result<()> { c.execute("INSERT INTO cloud_outbox(kind,payload,created_at) VALUES(?1,?2,?3)", params![kind, payload.to_string(), now])?; Ok(()) }
pub fn outbox_all(c: &Connection) -> Result<Vec<(i64, String, Value)>> {
    let mut q = c.prepare("SELECT id,kind,payload FROM cloud_outbox ORDER BY id")?;
    let rows: Vec<(i64, String, String)> = q.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?.collect::<rusqlite::Result<_>>()?;
    rows.into_iter().map(|(i, k, p)| Ok((i, k, serde_json::from_str(&p)?))).collect()
}
pub fn outbox_done(c: &Connection, id: i64) -> Result<()> { c.execute("DELETE FROM cloud_outbox WHERE id=?1", [id])?; Ok(()) }

pub fn set_shared_ids(c: &Connection, ids: &[String]) -> Result<()> {
    let tx = c.unchecked_transaction()?;
    tx.execute("DELETE FROM cloud_shared_ids", [])?;
    for i in ids { tx.execute("INSERT OR IGNORE INTO cloud_shared_ids VALUES(?1)", [i])?; }
    tx.commit()?;
    Ok(())
}
pub fn is_shared(c: &Connection, id: &str) -> Result<bool> { Ok(c.query_row("SELECT EXISTS(SELECT 1 FROM cloud_shared_ids WHERE id=?1)", [id], |r| r.get(0))?) }

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{cloud::mapping::*, engine::{Change, Context, Span}, storage::Store};
    use std::path::Path;

    fn store() -> Store { Store::open(Path::new(":memory:")).unwrap() }
    fn get(c: &Connection, t: Table, id: &str) -> Value { select(c, t, &format!("WHERE id='{id}'")).unwrap().remove(0) }

    #[test]
    fn incoming_row_never_overwrites_unsent_edit() {
        let s = store();
        save_local(&s.conn, Table::Tasks, json!({"id": "t1", "title": "A"}), "me", "2026-01-01T00:00:00.000Z").unwrap();
        write_local(&s.conn, Table::Tasks, &task_to_local(&json!({"id": "t1", "title": "B", "updated_at": "2026-01-02T00:00:00.000Z"})), &[]).unwrap();
        let r = get(&s.conn, Table::Tasks, "t1");
        assert_eq!(r["title"], "A");
        assert_eq!(r["synced"], 0);
    }

    #[test]
    fn incoming_row_replaces_synced_row_when_updated_at_differs() {
        let s = store();
        let v = |title: &str, at: &str| task_to_local(&json!({"id": "t1", "title": title, "updated_at": at}));
        write_local(&s.conn, Table::Tasks, &v("A", "2026-01-01T00:00:00.000Z"), &[]).unwrap();
        assert_eq!(write_local(&s.conn, Table::Tasks, &v("B", "2026-01-01T00:00:00.000Z"), &[]).unwrap(), 0);
        assert_eq!(get(&s.conn, Table::Tasks, "t1")["title"], "A");
        write_local(&s.conn, Table::Tasks, &v("C", "2026-01-02T00:00:00.000Z"), &[]).unwrap();
        assert_eq!(get(&s.conn, Table::Tasks, "t1")["title"], "C");
    }

    #[test]
    fn edit_during_upload_stays_pending() {
        let s = store();
        save_local(&s.conn, Table::Tasks, json!({"id": "t1", "title": "A"}), "me", "2026-01-01T00:00:00.000Z").unwrap();
        let read = unsynced(&s.conn, Table::Tasks).unwrap();
        assert_eq!(read.len(), 1);
        save_local(&s.conn, Table::Tasks, json!({"id": "t1", "title": "A2"}), "me", "2026-01-01T00:00:05.000Z").unwrap();
        assert_eq!(mark_uploaded(&s.conn, Table::Tasks, &read).unwrap(), 0);
        assert_eq!(get(&s.conn, Table::Tasks, "t1")["synced"], 0);
        assert_eq!(counts(&s.conn).unwrap(), (1, 0));
    }

    #[test]
    fn completion_conflicts_on_habit_and_date() {
        let s = store();
        let v = |id: &str| completion_to_local(&json!({"id": id, "habit_id": "h1", "date": "2026-01-01", "updated_at": "2026-01-01T00:00:00.000Z"}));
        write_local(&s.conn, Table::Completions, &v("c1"), &[]).unwrap();
        let second = completion_to_local(&json!({"id": "c2", "habit_id": "h1", "date": "2026-01-01", "updated_at": "2026-01-02T00:00:00.000Z"}));
        write_local(&s.conn, Table::Completions, &second, &[]).unwrap();
        let rows = select(&s.conn, Table::Completions, "").unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0]["id"], "c2");
    }

    #[test]
    fn unknown_server_column_is_ignored() {
        let s = store();
        let mut row = task_to_local(&json!({"id": "t1", "title": "A"}));
        row["brand_new"] = json!(1);
        assert_eq!(write_local(&s.conn, Table::Tasks, &row, &[]).unwrap(), 1);
    }

    #[test]
    fn switching_account_clears_mirror_but_not_activity() {
        let mut s = store();
        set_account(&s.conn, "u1", Some("a@b.c")).unwrap();
        save_local(&s.conn, Table::Habits, json!({"id": "h1", "name": "Run"}), "u1", "2026-01-01T00:00:00.000Z").unwrap();
        s.commit(&Change::default(), Some(&Span { start: 100, end: 200, context: Context::inactive("idle") }), 200).unwrap();
        set_account(&s.conn, "u1", None).unwrap();
        assert_eq!(select(&s.conn, Table::Habits, "").unwrap().len(), 1);
        set_account(&s.conn, "u2", None).unwrap();
        assert!(select(&s.conn, Table::Habits, "").unwrap().is_empty());
        assert_eq!(s.intervals(0, 1000).unwrap().len(), 1);
        assert_eq!(account(&s.conn).unwrap(), Some(("u2".into(), None)));
    }

    #[test]
    fn friend_owned_goal_is_read_only() {
        let s = store();
        let mut row = habit_to_local(&json!({"id": "h1", "name": "Goal", "is_goal": true}));
        row["owner_id"] = json!("friend");
        write_local(&s.conn, Table::Habits, &row, &[]).unwrap();
        let err = save_local(&s.conn, Table::Habits, json!({"id": "h1", "name": "Mine"}), "me", "2026-01-01T00:00:00.000Z").unwrap_err();
        assert_eq!(err.to_string(), "This belongs to a friend and is read-only");
        assert_eq!(get(&s.conn, Table::Habits, "h1")["name"], "Goal");
    }

    #[test]
    fn migration_002_is_idempotent_and_version_is_2() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("db");
        drop(Store::open(&path).unwrap());
        let s = Store::open(&path).unwrap();
        assert_eq!(s.conn.pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0)).unwrap(), 2);
    }

    #[test]
    fn every_to_local_key_is_a_real_column() {
        let all = json!({"id": "x", "priority": 1, "difficulty": 1, "flexible": true, "subtasks": "[]", "deadline": "2026-01-01", "section": "s"});
        for (t, out) in [(Table::Habits, habit_to_local(&all)), (Table::Completions, completion_to_local(&all)), (Table::Tasks, task_to_local(&all)), (Table::Milestones, milestone_to_local(&all))] {
            let cols = columns(&Connection::open_in_memory().and_then(|c| { c.execute_batch(include_str!("../../migrations/002_cloud.sql"))?; Ok(c) }).unwrap(), t).unwrap();
            for k in out.as_object().unwrap().keys() { assert!(cols.contains(k), "{} lacks column {k}", t.local()); }
        }
    }

    #[test]
    fn cache_outbox_and_shared_ids_round_trip() {
        let s = store();
        cache_put(&s.conn, "k", &json!({"a": 1}), "now").unwrap();
        assert_eq!(cache_get(&s.conn, "k").unwrap(), Some((json!({"a": 1}), "now".into())));
        outbox_push(&s.conn, "x", &json!([1]), "now").unwrap();
        let all = outbox_all(&s.conn).unwrap();
        assert_eq!(all[0].1, "x");
        outbox_done(&s.conn, all[0].0).unwrap();
        assert!(outbox_all(&s.conn).unwrap().is_empty());
        set_shared_ids(&s.conn, &["a".into()]).unwrap();
        assert!(is_shared(&s.conn, "a").unwrap() && !is_shared(&s.conn, "b").unwrap());
        set_cursor(&s.conn, Table::Tasks, "c1").unwrap();
        assert_eq!(cursor(&s.conn, Table::Tasks).unwrap().as_deref(), Some("c1"));
    }
}
