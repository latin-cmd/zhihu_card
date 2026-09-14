PRAGMA foreign_keys = ON;

ALTER TABLE cards ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS agent_auth_keys (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_principals(id) ON DELETE CASCADE,
  algorithm TEXT NOT NULL,
  public_jwk TEXT NOT NULL,
  scopes_json TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS agent_auth_keys_agent_status_idx
ON agent_auth_keys(agent_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_request_nonces (
  key_id TEXT NOT NULL REFERENCES agent_auth_keys(id) ON DELETE CASCADE,
  nonce TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (key_id, nonce)
);
CREATE INDEX IF NOT EXISTS agent_request_nonces_expiry_idx
ON agent_request_nonces(expires_at);

CREATE TABLE IF NOT EXISTS card_revisions (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  space_id TEXT NOT NULL REFERENCES card_spaces(id) ON DELETE CASCADE,
  actor_agent_id TEXT NOT NULL REFERENCES agent_principals(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  patch_json TEXT NOT NULL,
  previous_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(card_id, version)
);
CREATE INDEX IF NOT EXISTS card_revisions_card_version_idx
ON card_revisions(card_id, version DESC);
