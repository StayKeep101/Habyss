-- Deeper tracking: the browser page, the open document and per-span activity counts live beside intervals,
-- so the intervals table keeps the columns older builds insert into. Additive and idempotent: user_version stays 1.
CREATE TABLE IF NOT EXISTS interval_details(interval_id TEXT PRIMARY KEY REFERENCES intervals(id) ON DELETE CASCADE, url TEXT, domain TEXT, document_path TEXT, typing_ms INTEGER NOT NULL DEFAULT 0, pointer_ms INTEGER NOT NULL DEFAULT 0, meeting_ms INTEGER NOT NULL DEFAULT 0, media_ms INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS interval_details_domain ON interval_details(domain);
INSERT OR IGNORE INTO categories(id,name,classification) VALUES
  ('productivity','Productivity','productive'),('writing','Writing','productive'),('learning','Learning','productive'),
  ('meetings','Meetings','neutral'),('utilities','Utilities','neutral'),('browsing','Browsing','neutral'),
  ('social','Social media','unproductive'),('entertainment','Entertainment','unproductive'),('news','News','unproductive'),('shopping','Shopping','unproductive');
INSERT OR IGNORE INTO schema_migrations VALUES(5,CAST(strftime('%s','now') AS INTEGER)*1000);
