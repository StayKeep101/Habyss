-- Additive focus changes. The columns are added by Store::open, guarded by PRAGMA table_info, because SQLite
-- has no ADD COLUMN IF NOT EXISTS. user_version stays 1; the migration is recorded in schema_migrations.
INSERT OR IGNORE INTO schema_migrations VALUES(3,CAST(strftime('%s','now') AS INTEGER)*1000);
