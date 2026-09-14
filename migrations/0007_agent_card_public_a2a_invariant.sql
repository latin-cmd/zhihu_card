PRAGMA foreign_keys = ON;

-- An active Agent Card is a public A2A identity. Its Card Space and identity
-- Card must remain publicly discoverable regardless of the proof provider or
-- registration path that issued it.
UPDATE card_spaces
SET visibility = 'public'
WHERE EXISTS (
  SELECT 1
  FROM agent_cards
  WHERE agent_cards.agent_id = card_spaces.agent_id
    AND agent_cards.status = 'active'
);

UPDATE cards
SET visibility = 'public'
WHERE card_type = 'agent_identity';

CREATE TRIGGER IF NOT EXISTS agent_cards_publish_space_after_insert
AFTER INSERT ON agent_cards
WHEN NEW.status = 'active'
BEGIN
  UPDATE card_spaces
  SET visibility = 'public'
  WHERE agent_id = NEW.agent_id;

  UPDATE cards
  SET visibility = 'public'
  WHERE owner_agent_id = NEW.agent_id
    AND card_type = 'agent_identity';
END;

CREATE TRIGGER IF NOT EXISTS agent_cards_publish_space_after_activation
AFTER UPDATE OF status ON agent_cards
WHEN NEW.status = 'active'
BEGIN
  UPDATE card_spaces
  SET visibility = 'public'
  WHERE agent_id = NEW.agent_id;

  UPDATE cards
  SET visibility = 'public'
  WHERE owner_agent_id = NEW.agent_id
    AND card_type = 'agent_identity';
END;

CREATE TRIGGER IF NOT EXISTS card_spaces_publish_registered_agent_after_insert
AFTER INSERT ON card_spaces
WHEN EXISTS (
  SELECT 1
  FROM agent_cards
  WHERE agent_cards.agent_id = NEW.agent_id
    AND agent_cards.status = 'active'
)
BEGIN
  UPDATE card_spaces
  SET visibility = 'public'
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS card_spaces_block_private_registered_agent
BEFORE UPDATE OF visibility, agent_id ON card_spaces
WHEN NEW.visibility <> 'public'
  AND EXISTS (
    SELECT 1
    FROM agent_cards
    WHERE agent_cards.agent_id = NEW.agent_id
      AND agent_cards.status = 'active'
  )
BEGIN
  SELECT RAISE(ABORT, 'active_agent_card_space_must_be_public');
END;

CREATE TRIGGER IF NOT EXISTS agent_identity_cards_publish_after_insert
AFTER INSERT ON cards
WHEN NEW.card_type = 'agent_identity'
  AND NEW.visibility <> 'public'
BEGIN
  UPDATE cards
  SET visibility = 'public'
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS agent_identity_cards_publish_after_type_change
AFTER UPDATE OF card_type ON cards
WHEN NEW.card_type = 'agent_identity'
  AND NEW.visibility <> 'public'
BEGIN
  UPDATE cards
  SET visibility = 'public'
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS agent_identity_cards_block_private
BEFORE UPDATE OF visibility ON cards
WHEN NEW.card_type = 'agent_identity'
  AND NEW.visibility <> 'public'
BEGIN
  SELECT RAISE(ABORT, 'agent_identity_card_must_be_public');
END;
