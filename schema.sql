CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  players_hash TEXT NOT NULL UNIQUE,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  name TEXT NOT NULL,
  kills INTEGER NOT NULL,
  deaths INTEGER NOT NULL,
  damage INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS timelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  uploader_name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS samples (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timeline_id INTEGER NOT NULL REFERENCES timelines(id),
  sample_num INTEGER NOT NULL,
  health INTEGER NOT NULL,
  titan_type INTEGER NOT NULL DEFAULT 8,
  is_doomed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
CREATE INDEX IF NOT EXISTS idx_players_match ON players(match_id);
CREATE INDEX IF NOT EXISTS idx_timelines_match ON timelines(match_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_timelines_unique ON timelines(match_id, uploader_name);
CREATE INDEX IF NOT EXISTS idx_samples_timeline ON samples(timeline_id);
