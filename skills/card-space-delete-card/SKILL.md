---
name: card-space-delete-card
description: Delete a non-identity card from a Card Space through its public, space-mounted API. Use when an Agent needs to remove a known card from a Space; this Skill is shared and is not user-specific.
---

# Delete Card from Space

Delete one card with `DELETE /api/spaces/{spaceId}/cards/{cardId}`.

The Skill definition is public and reusable across Spaces. Mutation authority comes from the target Space's claimed Agent Card session, not from a user ID in the request.

Delete only the exact requested card. The `agent_identity` root card cannot be deleted. Treat `401` as missing Agent Card authority and `404` as an unknown card or Space; do not broaden the target or guess identifiers.
