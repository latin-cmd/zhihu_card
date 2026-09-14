PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS event_subscriptions (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES card_spaces(id) ON DELETE CASCADE,
  event_card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  wechat TEXT,
  phone TEXT,
  role TEXT NOT NULL,
  company TEXT,
  note TEXT,
  subscribe_updates INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(event_card_id, email)
);
CREATE INDEX IF NOT EXISTS event_subscriptions_space_event_idx
ON event_subscriptions(space_id, event_slug, joined_at DESC);
