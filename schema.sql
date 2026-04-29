CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  players_hash TEXT NOT NULL UNIQUE,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  mode TEXT
);

CREATE TABLE IF NOT EXISTS players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  name TEXT NOT NULL,
  kills INTEGER NOT NULL,
  deaths INTEGER NOT NULL,
  damage INTEGER NOT NULL,
  team TEXT,
  score INTEGER
);

CREATE TABLE IF NOT EXISTS timelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id INTEGER NOT NULL REFERENCES matches(id),
  uploader_name TEXT NOT NULL,
  sample_detail TEXT NOT NULL DEFAULT '',
  score_rank INTEGER
);

CREATE TABLE IF NOT EXISTS att_meta (
  match_id INTEGER PRIMARY KEY REFERENCES matches(id),
  map TEXT,
  match_duration INTEGER,
  final_score_a INTEGER,
  final_score_b INTEGER,
  result TEXT,
  local_player_name TEXT
);

CREATE TABLE IF NOT EXISTS nicknames (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT NOT NULL,
  ip TEXT NOT NULL,
  nickname TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
CREATE INDEX IF NOT EXISTS idx_players_match ON players(match_id);
CREATE INDEX IF NOT EXISTS idx_timelines_match ON timelines(match_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_timelines_unique ON timelines(match_id, uploader_name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nicknames_ip ON nicknames(ip);
CREATE INDEX IF NOT EXISTS idx_nicknames_nickname ON nicknames(nickname COLLATE NOCASE);
