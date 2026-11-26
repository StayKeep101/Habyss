-- Focus pauses and the linked item, kept beside focus_sessions so that table keeps the seven columns older builds insert into.
-- A session without a row has no pauses and no item. Deleting a session deletes its row (foreign_keys is ON).
-- Idempotent and additive: user_version stays 1; the migration is recorded in schema_migrations.
CREATE TABLE IF NOT EXISTS focus_session_extras(session_id TEXT PRIMARY KEY REFERENCES focus_sessions(id) ON DELETE CASCADE, paused_ms INTEGER NOT NULL DEFAULT 0, paused_at INTEGER, item_id TEXT, item_kind TEXT);
INSERT OR IGNORE INTO schema_migrations VALUES(4,CAST(strftime('%s','now') AS INTEGER)*1000);
