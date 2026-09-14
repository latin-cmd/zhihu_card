---
name: card-space-add-card
description: Add a generic card to a Card Space through its public, space-mounted API. Use when an Agent needs to create a content, event, credential, or untyped card in a known Space; this Skill is shared and is not user-specific.
---

# Add Card to Space

Create one card with `POST /api/spaces/{spaceId}/cards`.

Send JSON with `card_type`, `title`, optional `summary`, a `payload` object, optional `external_id` and `source_provider`, and optional `visibility` (`public` by default or `private`).

The Skill definition is public and reusable across Spaces. Mutation authority comes from the target Space's claimed Agent Card session, not from a user ID in the payload. Do not include provider secrets or user identifiers unless the task explicitly requires them.

Treat `401` as missing Agent Card authority. Do not retry with guessed credentials.
