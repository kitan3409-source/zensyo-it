CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student TEXT NOT NULL,
  term TEXT NOT NULL,
  direction TEXT NOT NULL,
  correct INTEGER NOT NULL,
  ts REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  name TEXT,
  points INTEGER DEFAULT 0,
  last_login TEXT DEFAULT '',
  cur_streak INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS inventory (email TEXT, item TEXT, PRIMARY KEY (email, item));
CREATE TABLE IF NOT EXISTS equipped (email TEXT, slot TEXT, item TEXT, PRIMARY KEY (email, slot));
CREATE TABLE IF NOT EXISTS missions (
  email TEXT,
  day TEXT,
  key TEXT,
  progress INTEGER DEFAULT 0,
  claimed INTEGER DEFAULT 0,
  PRIMARY KEY (email, day, key)
);

CREATE TABLE IF NOT EXISTS achievements (
  email TEXT,
  key TEXT,
  ts REAL,
  PRIMARY KEY (email, key)
);

CREATE TABLE IF NOT EXISTS boss (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week TEXT,
  name TEXT,
  hp INTEGER,
  max_hp INTEGER,
  defeated INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS boss_damage (
  email TEXT,
  boss_id INTEGER,
  dmg INTEGER DEFAULT 0,
  PRIMARY KEY (email, boss_id)
);

CREATE TABLE IF NOT EXISTS pins (
  email TEXT PRIMARY KEY,
  pin TEXT
);
