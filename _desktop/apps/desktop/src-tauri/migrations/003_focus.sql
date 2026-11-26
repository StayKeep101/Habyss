-- 003 first added pause and linked-item columns to focus_sessions. That broke older builds, whose positional INSERT supplies
-- seven values, so 004 moved them into focus_session_extras. 003 is still recorded so every file has the same history.
-- user_version stays 1; the migration is recorded in schema_migrations.
INSERT OR IGNORE INTO schema_migrations VALUES(3,CAST(strftime('%s','now') AS INTEGER)*1000);
