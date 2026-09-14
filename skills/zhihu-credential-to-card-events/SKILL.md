---
name: zhihu-credential-to-card-events
description: Turn a Zhihu Access Secret owner's selected Zhihu creations into source-preserving Cards and paired Event detail cards in a Card Space. Use when the user explicitly asks to import or sync their Zhihu creations into a known Space.
---

# Zhihu Credential to Card Events

Use the `zhihu` Skill to access only the Access Secret owner's data. Never echo, persist, place in a URL, or include an Access Secret in a Card payload. Configure a newly supplied secret through the Zhihu CLI's stdin-only flow; use an already configured credential without asking for it again.

## Preview before writing

Read one page of `me contents` (at most 20 items) and build a preview. Each candidate must retain its Zhihu URL, title, content type, short API summary, creation timestamp, and available aggregate engagement counts. Do not copy full content bodies.

Propose a small set of broad, non-sensitive topic cards only when themes are clear. Do not derive cards from private follows, private favorites, or private knowledge-base content unless the user explicitly includes them.

Wait for an explicit instruction to import the preview before creating cards.

## Automatic credential-claim hook

When this Skill is mounted by the host application as the post-claim hook, submitting and successfully verifying a Zhihu Access Secret is the explicit instruction to import. In that flow, read only the newest page (at most 20 creations), create the mapped source and Event cards immediately after the Agent Card is issued or resumed, and return the counts to the claim response without asking for a second confirmation.

The hook must be idempotent. A repeated claim or login may fetch the newest page again, but it must skip every existing stable external ID. A Zhihu read failure must not revoke the verified credential or Agent Card; return a sanitized sync error and record an audit event without logging the Access Secret.

## Import mapping

For each approved content candidate, create both records through the target Space's mounted Add Card Skill:

1. A `zhihu_content` source card with `source_provider: "zhihu"` and a stable external ID `zhihu:{contentType}:{contentId}`.
2. A paired `event` detail card with `source_provider: "zhihu-event"` and a stable external ID `zhihu-{contentId}`. Its payload must set `cardKind: "zhihu_content"`, include `sourceUrl`, and use the concise summary for `about`.

Topic cards use `card_type: "topic"`; create a paired Event detail card only when the user wants topics in the Events layer. Use `source_provider: "zhihu-event"`, `cardKind: "topic"`, and a stable `zhihu-topic-*` external ID.

The Space's claimed Agent Card session authorizes writes. Do not send a user ID. Treat an existing stable external ID as already imported: report it and skip it rather than creating a duplicate or overwriting the existing card.

Read [the Card Space mapping](references/card-space-mapping.md) before writing.
