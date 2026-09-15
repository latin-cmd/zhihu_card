---
name: sync-cookie-fortune-cards
description: Create or refresh today's browser-context and entertainment fortune Card/Event pairs in the current Cookie-owned Card Space. Use after browser Agent Card claim or when a user explicitly asks for today's Cookie fortune.
---

# Sync Cookie Fortune Cards

Call `POST /api/plugins/cookie-fortune-cards/sync` on the same origin with the current browser session. Send only coarse, browser-supplied context:

```json
{
  "language": "zh-CN",
  "platform": "Windows",
  "timezoneOffsetMinutes": -480
}
```

The endpoint creates or updates four daily, idempotent records: a browser-context Card and informational Event, plus an entertainment-only fortune Card and informational Event. Treat the response as cultural entertainment, never as medical, financial, legal, relationship, hiring, or safety advice.

Do not infer or request IP location, GPS, timezone name, browser-profile name, operating-system username, full User-Agent, fingerprinting attributes, or cross-site Cookie data. Use the UTC offset only to choose the local calendar day; never persist or return it. Explain that language and platform are request/browser signals rather than values contained in the Cookie. Do not claim that a generated result predicts real outcomes.

Read [references/source-index.json](references/source-index.json) only when the user asks about the traditional text sources or attribution.
