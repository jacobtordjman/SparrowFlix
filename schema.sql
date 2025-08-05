CREATE TABLE IF NOT EXISTS movies (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  original_title TEXT,
  file_id TEXT,
  storage_channel_id TEXT,
  storage_message_id INTEGER,
  details TEXT,
  language TEXT DEFAULT 'english',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  uploaded_at DATETIME,
  file_info TEXT
);

CREATE TABLE IF NOT EXISTS tv_shows (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  original_title TEXT,
  details TEXT,
  language TEXT DEFAULT 'english',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id TEXT REFERENCES tv_shows(id),
  season_number INTEGER,
  episode_number INTEGER,
  file_id TEXT,
  storage_channel_id TEXT,
  storage_message_id INTEGER,
  file_info TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(show_id, season_number, episode_number)
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  preferences TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watch_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  content_id TEXT,
  content_type TEXT,
  progress REAL DEFAULT 0,
  season INTEGER,
  episode INTEGER,
  last_watched DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, content_id, season, episode)
);

CREATE TABLE IF NOT EXISTS channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN DEFAULT 1,
  schedule TEXT,
  schedule_updated DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_movies_file_id ON movies(file_id);
CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title);
CREATE INDEX IF NOT EXISTS idx_episodes_show_season ON episodes(show_id, season_number);
CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);