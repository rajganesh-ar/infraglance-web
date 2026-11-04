-- Demo / contact requests captured by /api/contact
CREATE TABLE IF NOT EXISTS leads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  company     TEXT    NOT NULL,
  role        TEXT,
  industry    TEXT,
  interests   TEXT,              -- comma-separated pillar slugs
  message     TEXT,
  ip_hash     TEXT,              -- SHA-256 of client IP + salt, used only for rate limiting
  country     TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_leads_ip_time ON leads (ip_hash, created_at);
