-- Local mirror of the signed-in account's Supabase rows. Column names are the keys of cloud::mapping::*_to_local.
-- Idempotent: runs on every open, after 001 (which resets user_version to 1).
CREATE TABLE IF NOT EXISTS cloud_habits(
  id TEXT PRIMARY KEY, user_id TEXT, name TEXT, description TEXT, category TEXT, icon TEXT,
  is_goal INTEGER, target_date TEXT, goal_id TEXT, task_days TEXT, reminders TEXT, start_date TEXT, end_date TEXT,
  duration_minutes INTEGER, start_time TEXT, end_time TEXT, type TEXT, color TEXT, goal_period TEXT,
  goal_value REAL, unit TEXT, chart_type TEXT, is_archived INTEGER, show_memo INTEGER, frequency TEXT,
  week_interval INTEGER, time_of_day TEXT, graph_style TEXT, tracking_method TEXT, reminder_offset REAL,
  reminder_message TEXT, recurrence TEXT, location_reminders TEXT, health_kit_metric TEXT, health_kit_target REAL,
  ringtone TEXT, goal_spec TEXT, priority INTEGER, difficulty INTEGER, flexible INTEGER,
  created_at TEXT, updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0, synced INTEGER NOT NULL DEFAULT 0, owner_id TEXT, refused INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cloud_completions(
  id TEXT PRIMARY KEY, user_id TEXT, habit_id TEXT, date TEXT, value REAL, memo TEXT,
  created_at TEXT, updated_at TEXT, evidence TEXT, skipped INTEGER,
  deleted INTEGER NOT NULL DEFAULT 0, synced INTEGER NOT NULL DEFAULT 0, owner_id TEXT, refused INTEGER NOT NULL DEFAULT 0,
  UNIQUE(habit_id,date)
);
CREATE TABLE IF NOT EXISTS cloud_tasks(
  id TEXT PRIMARY KEY, user_id TEXT, title TEXT, description TEXT, due_date TEXT, due_time TEXT,
  estimated_minutes INTEGER, priority INTEGER, goal_id TEXT, status TEXT, completed_at TEXT, source TEXT,
  external_id TEXT, measure TEXT, target REAL, unit TEXT, amount REAL, milestone_id TEXT,
  subtasks TEXT, deadline TEXT, section TEXT, difficulty INTEGER, flexible INTEGER,
  created_at TEXT, updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0, synced INTEGER NOT NULL DEFAULT 0, owner_id TEXT, refused INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cloud_milestones(
  id TEXT PRIMARY KEY, user_id TEXT, goal_id TEXT, title TEXT, due_date TEXT, done_at TEXT, position INTEGER,
  created_at TEXT, updated_at TEXT,
  deleted INTEGER NOT NULL DEFAULT 0, synced INTEGER NOT NULL DEFAULT 0, owner_id TEXT, refused INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS cloud_cursors(table_name TEXT PRIMARY KEY, cursor TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cloud_account(id INTEGER PRIMARY KEY CHECK(id=1), user_id TEXT NOT NULL, email TEXT, last_sync TEXT, last_error TEXT);
CREATE TABLE IF NOT EXISTS cloud_cache(key TEXT PRIMARY KEY, json TEXT NOT NULL, fetched_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cloud_outbox(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cloud_shared_ids(id TEXT PRIMARY KEY);
CREATE INDEX IF NOT EXISTS cloud_habits_synced ON cloud_habits(synced);
CREATE INDEX IF NOT EXISTS cloud_completions_synced ON cloud_completions(synced);
CREATE INDEX IF NOT EXISTS cloud_tasks_synced ON cloud_tasks(synced);
CREATE INDEX IF NOT EXISTS cloud_milestones_synced ON cloud_milestones(synced);
PRAGMA user_version = 2;
