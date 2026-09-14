PRAGMA foreign_keys = ON;

ALTER TABLE card_spaces ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';

UPDATE card_spaces
SET visibility = 'public'
WHERE status = 'active';

UPDATE cards
SET visibility = 'public'
WHERE card_type IN ('agent_identity', 'event');
