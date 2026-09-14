---
name: card-space-update-card
description: Update a Card's local presentation through an Agent Card signed request while preserving source provenance. Use for owner-authorized Card edits in a Card Space.
---

# Update Card

Send `PATCH /api/spaces/{spaceId}/cards/{cardId}` with the Agent request headers defined by the public `claim-agent-card` Skill and an `If-Match` header containing the current integer Card version.

Use an Agent-signed `GET` to the same endpoint to read the complete owner Card, including private Cards and the current version. Sign an empty body for `GET`.

The JSON body may contain `title`, `summary`, `visibility`, or `presentation`. `presentation` is a local metadata object for tags, notes, categories, or display choices. Set it to `null` to remove the overlay.

Do not attempt to change `source_provider`, `external_id`, the original Zhihu URL, content type, creation timestamp, or metrics. Those fields preserve provenance. An update to a Zhihu source Card also updates its paired Event detail Card in the same operation. The `agent_identity` root Card cannot be edited through this Skill.

A successful response returns the new version and an `ETag`. On `412`, read the current Card and retry only after reconciling the newer version. Never blindly overwrite a concurrent change.
