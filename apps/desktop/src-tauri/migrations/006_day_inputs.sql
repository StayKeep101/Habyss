-- The day's settings mirrored from the account (public.day_inputs), one row per key. `value` is JSON text.
-- Idempotent and additive: user_version stays 1; the migration is recorded in schema_migrations.
CREATE TABLE IF NOT EXISTS cloud_day_inputs(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT, deleted INTEGER NOT NULL DEFAULT 0, synced INTEGER NOT NULL DEFAULT 1);
INSERT OR IGNORE INTO schema_migrations VALUES(6,CAST(strftime('%s','now') AS INTEGER)*1000);
