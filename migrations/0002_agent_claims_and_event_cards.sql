PRAGMA foreign_keys = ON;

ALTER TABLE sessions ADD COLUMN active_space_id TEXT;
ALTER TABLE cards ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';

CREATE TABLE IF NOT EXISTS agent_claims (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agent_principals(id) ON DELETE CASCADE,
  proof_type TEXT NOT NULL,
  proof_ref TEXT,
  status TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE(user_id, agent_id)
);
CREATE INDEX IF NOT EXISTS agent_claims_user_status_idx ON agent_claims(user_id, status);

CREATE TABLE IF NOT EXISTS system_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO agent_claims (id, user_id, agent_id, proof_type, proof_ref, status, claimed_at)
SELECT 'clm_' || lower(hex(randomblob(12))), owner_user_id, id, auth_mode, provider, 'active', created_at
FROM agent_principals
WHERE status = 'active';

UPDATE sessions
SET active_space_id = (
  SELECT s.id FROM card_spaces s
  WHERE s.owner_user_id = sessions.user_id AND s.status = 'active'
  ORDER BY s.created_at DESC LIMIT 1
)
WHERE active_space_id IS NULL;
