PRAGMA foreign_keys = ON;

ALTER TABLE provider_connections ADD COLUMN credential_fingerprint TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS provider_connections_provider_fingerprint_idx
ON provider_connections(provider, credential_fingerprint)
WHERE credential_fingerprint IS NOT NULL;
