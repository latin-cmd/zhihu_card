---
name: event-image-to-directus
description: Convert an event poster, screenshot, photo, OCR text, or pasted event announcement into this project's Directus submitted_events payload. Use for this Astro/Cloudflare/Directus activity project when the user provides an image or text and wants theme copy, event fields, and an optional submission through the existing directus-submit-event channel.
---

# Event Image To Directus

Use this skill in `D:\ThePrivate\communist_astro\communist` to convert event images or announcement text into this project's `submitted_events` shape.

## Inputs

Accept any of:

- An attached image/poster/screenshot.
- A local image path.
- OCR text copied from a poster.
- A pasted activity announcement.

If an image is available locally, inspect it visually first. Extract text exactly where possible, then normalize into readable event copy.

## Output Target

Default target collection:

```text
submitted_events
```

The project reads this through:

```text
/api/events
/events/[slug]
```

Use `skills/directus-submit-event/scripts/submit-event.mjs --file <payload.json>` to submit after creating the payload.

## Required Payload Fields

Produce JSON matching this shape:

```json
{
  "slug": "stable-event-slug",
  "title": "活动标题",
  "category": "读书会",
  "host": "主办方",
  "venue": "地点名称",
  "locationName": "地点名称",
  "locationAddress": "详细地址",
  "date": "YYYY-MM-DD 周X",
  "time": "HH:mm-HH:mm",
  "cover": "任选封面图 URL",
  "priceLabel": "开放报名",
  "statusLabel": "开放报名",
  "attendeeCount": 0,
  "presentedBy": "主办方",
  "presentedByAvatar": "https://communist-activity-web.m937746825.workers.dev/r2/organizers/rongyu-wechat-qr.png",
  "presentedByDescription": "一句话主办方说明",
  "hosts": ["主办方"],
  "attendees": 0,
  "attendeeNames": "No attendees yet.",
  "registrationStatus": "开放报名",
  "registrationNote": "报名注意事项",
  "registrationAction": "加入活动",
  "contactLabel": "联系活动者",
  "about": ["活动介绍段落"],
  "sections": [
    {
      "title": "活动流程",
      "body": "流程说明"
    }
  ],
  "subscribeFields": ["name", "email", "wechat", "phone", "role", "company", "note"],
  "submittedAt": "ISO timestamp"
}
```

## Extraction Rules

Map common poster labels:

- `主题` -> `title` or first section title.
- `内容` / `简介` -> `about`.
- `日期` -> `date`.
- `时间` -> `time`.
- `地点` -> `venue`, `locationName`, `locationAddress`.
- `费用` -> `priceLabel`, also mention in `registrationNote`.
- `主讲人` / `分享人` / numbered participants -> `hosts` and `sections`.
- `流程` -> `sections` item titled `活动流程`.
- Warnings or disclaimers -> last `about` paragraph or `sections` item titled `提示`.

If no explicit title exists, create one from the strongest theme:

```text
<月份/社群>：<主题>
```

Examples:

- `连岛公益读书会：解锁有趣的金融系统`
- `五月活动预告：无主题圆桌`

## Date Rules

- Use the current conversation date as year context unless the poster clearly says another year.
- For this workspace, current date was `2026-07-25`; if the prompt says `5.30 周六`, use `2026-05-30 周六` because May 30, 2026 is Saturday.
- Keep the original human-readable day in `date`.
- Use `HH:mm-HH:mm` for `time`.
- Convert Chinese punctuation ranges like `14:15 —— 17:15` to `14:15-17:15`.

## Cover Image Rule

The user said image can be arbitrary. Do not require poster image upload as cover.

Choose one of these defaults by category:

```text
读书会: https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=80
金融/分享: https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1600&q=80
圆桌/沙龙: https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80
```

## Slug Rules

Use a stable ASCII slug:

```text
<short-topic>-<YYYYMMDD>
```

Examples:

```text
liandao-finance-reading-20260726
may-book-roundtable-20260530
```

Avoid changing a slug after submission, because deletion and verification use it.

## Quality Checks

Before submitting:

- Ensure every required field exists.
- Ensure `about` is an array of readable paragraphs.
- Ensure `sections` is an array with useful title/body items.
- Ensure no command-line Chinese defaults from `submit-event.mjs` are used.
- Prefer `--file` mode for submission to avoid shell encoding issues.

Validate with:

```bash
node skills/event-image-to-directus/scripts/validate-payload.mjs payload.json
```

Submit with:

```bash
node skills/directus-submit-event/scripts/submit-event.mjs --file payload.json
```

Verify with:

```bash
Invoke-WebRequest -UseBasicParsing "https://communist-activity-web.m937746825.workers.dev/events/<slug>"
```

Delete test events through:

```bash
npm run event:delete -- <slug>
```

## Reporting

After submission, report only:

- collection
- id
- slug
- title
- public detail URL
- verification result

Do not report `DIRECTUS_TOKEN` or other secrets.
