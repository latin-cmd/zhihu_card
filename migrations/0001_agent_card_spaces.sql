PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS agent_principals (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  auth_mode TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS card_spaces (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL UNIQUE REFERENCES agent_principals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS card_spaces_owner_idx ON card_spaces(owner_user_id);

CREATE TABLE IF NOT EXISTS provider_connections (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL UNIQUE REFERENCES agent_principals(id) ON DELETE CASCADE,
  space_id TEXT NOT NULL UNIQUE REFERENCES card_spaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  auth_mode TEXT NOT NULL,
  secret_ciphertext TEXT NOT NULL,
  status TEXT NOT NULL,
  connected_at TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS provider_connections_owner_provider_idx ON provider_connections(owner_user_id, provider, status);

CREATE TABLE IF NOT EXISTS issuer_keys (
  key_id TEXT PRIMARY KEY,
  alg TEXT NOT NULL,
  public_jwk TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_cards (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agent_principals(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  body_json TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  signature_json TEXT NOT NULL,
  key_id TEXT NOT NULL REFERENCES issuer_keys(key_id),
  status TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(agent_id, version)
);
CREATE INDEX IF NOT EXISTS agent_cards_agent_idx ON agent_cards(agent_id, version DESC);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES card_spaces(id) ON DELETE CASCADE,
  owner_agent_id TEXT NOT NULL REFERENCES agent_principals(id) ON DELETE CASCADE,
  source_provider TEXT NOT NULL,
  source_connection_id TEXT REFERENCES provider_connections(id) ON DELETE SET NULL,
  external_id TEXT NOT NULL,
  card_type TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(space_id, source_provider, external_id)
);
CREATE INDEX IF NOT EXISTS cards_space_idx ON cards(space_id, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  agent_id TEXT REFERENCES agent_principals(id) ON DELETE SET NULL,
  space_id TEXT REFERENCES card_spaces(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL
);
