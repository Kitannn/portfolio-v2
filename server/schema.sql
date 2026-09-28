-- HKIT AND RUN leaderboard, on Cloudflare D1 (SQLite).
-- Applied with:  wrangler d1 execute hkitandrun --remote --file=./schema.sql

-- One row per player. `disc` is the discriminator half of the #tag, and the unique index over
-- (lname, locale, disc) is what makes the server the only thing that can hand one out.
CREATE TABLE IF NOT EXISTS players (
  id         TEXT PRIMARY KEY,          -- opaque uuid; the client's write credential
  name       TEXT NOT NULL,             -- display name, already through the filter
  lname      TEXT NOT NULL,             -- lowercased, for case-insensitive grouping
  locale     TEXT NOT NULL,             -- en_US, ja, pt_BR …
  disc       INTEGER NOT NULL,          -- 1 for the first kitannn in that locale, 2 for the next
  deaths     INTEGER NOT NULL DEFAULT 0,
  runs       INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL,
  ip_hash    TEXT                       -- salted, truncated; for rate limiting, not identity
);
CREATE UNIQUE INDEX IF NOT EXISTS players_tag ON players (lname, locale, disc);
CREATE INDEX IF NOT EXISTS players_deaths ON players (deaths DESC);

-- One row per player per category, holding that player's best. Not a log of every run: the upsert
-- in the Worker only writes when the new value beats the stored one.
CREATE TABLE IF NOT EXISTS scores (
  player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  category  TEXT NOT NULL,              -- time | kills | damage | level
  value     INTEGER NOT NULL,
  won       INTEGER NOT NULL DEFAULT 0, -- the ★: the Colossus went down in that run
  codes     INTEGER NOT NULL DEFAULT 0, -- CODES flag: cheat codes were active
  hacked    INTEGER NOT NULL DEFAULT 0, -- CHEATS flag: the save had been edited
  at        INTEGER NOT NULL,
  PRIMARY KEY (player_id, category)
);
CREATE INDEX IF NOT EXISTS scores_rank ON scores (category, value DESC);

-- Fixed-window rate counters. Swept lazily on write rather than by a cron trigger, so the whole
-- deployment stays one Worker with nothing scheduled behind it.
CREATE TABLE IF NOT EXISTS rate (
  k       TEXT PRIMARY KEY,
  n       INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rate_expiry ON rate (expires);

-- Analytics. Daily counters, never individual events: one row per (day, name) however many people
-- trigger it, so a busy day costs the same handful of writes as a quiet one. There is no visitor
-- id anywhere in here by design — nothing in this table can be traced back to a person.
-- `total` and `max` are only used by the timing events; counters leave them at zero.
CREATE TABLE IF NOT EXISTS events (
  day   TEXT NOT NULL,                    -- YYYY-MM-DD, UTC
  name  TEXT NOT NULL,                    -- validated against arcade/src/event-names.js
  n     INTEGER NOT NULL DEFAULT 0,       -- how many times
  total INTEGER NOT NULL DEFAULT 0,       -- summed seconds, for timings
  max   INTEGER NOT NULL DEFAULT 0,       -- longest single sample, for timings
  PRIMARY KEY (day, name)
);
CREATE INDEX IF NOT EXISTS events_day ON events (day DESC);
