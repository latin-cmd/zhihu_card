---
name: directus-submit-event
description: Submit activity/event records to Directus with an agent and Directus token. Use when an agent needs to create submitted_events or activities records through the Directus REST API, verify the write, and avoid exposing secrets.
---

# Directus Submit Event

Use this skill when an agent needs to submit an event into Directus with a Directus static token or admin-scoped token.

## Safety Rules

- Never print, log, commit, or paste the real `DIRECTUS_TOKEN`.
- Prefer reading secrets from `.env` or the process environment.
- Use `submitted_events` for user-submitted activities that need review.
- Use `activities` only for approved/published CMS activities.
- After creating a test record, delete it unless the user explicitly wants to keep it.

## Required Environment

```env
DIRECTUS_URL=https://directus.example.com
DIRECTUS_TOKEN=replace-with-directus-static-token
DIRECTUS_EVENTS_COLLECTION=submitted_events
```

Default collection:

```text
submitted_events
```

Current project collection mapping:

```text
submitted_events      # frontend Submit Event writes here
event_subscriptions   # event registration writes here
activities            # formal CMS activity records
```

## Directus REST Flow

1. Read `DIRECTUS_URL` and `DIRECTUS_TOKEN`.
2. Build a payload matching the Worker `SubmittedEvent` shape.
3. POST to:

```http
POST /items/submitted_events
Authorization: Bearer <DIRECTUS_TOKEN>
Content-Type: application/json
```

4. Verify the record:

```http
GET /items/submitted_events?filter[slug][_eq]=<slug>&limit=1
Authorization: Bearer <DIRECTUS_TOKEN>
```

5. For cleanup:

```http
DELETE /items/submitted_events/<id>
Authorization: Bearer <DIRECTUS_TOKEN>
```

## Minimal Payload

Directus accepts the full event shape. Use this minimum useful payload:

```json
{
  "slug": "shenzhen-reading-salon-2026",
  "title": "深圳地区的读书会沙龙",
  "category": "Reading",
  "host": "绒屿",
  "venue": "深圳线下空间",
  "locationName": "深圳线下空间",
  "locationAddress": "报名后由活动者微信同步",
  "date": "2026-08-15",
  "time": "10:00",
  "cover": "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1600&q=80",
  "priceLabel": "开放报名",
  "statusLabel": "开放报名",
  "attendeeCount": 0,
  "presentedBy": "绒屿",
  "presentedByAvatar": "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80",
  "presentedByDescription": "绒屿提交的读书会活动。",
  "hosts": ["绒屿"],
  "attendees": 0,
  "attendeeNames": "No attendees yet.",
  "registrationStatus": "开放报名",
  "registrationNote": "提交报名后由活动者微信邀请进群并确认线下参与。",
  "registrationAction": "加入活动",
  "contactLabel": "联系活动者",
  "about": ["深圳地区读书会沙龙，报名后通过微信进群确认地点和参与方式。"],
  "sections": [
    {
      "title": "活动流程",
      "body": "添加索引活动，添加活动者微信，邀请进群，线下参与活动。"
    }
  ],
  "subscribeFields": ["name", "email", "wechat", "phone", "role", "company", "note"],
  "submittedAt": "2026-08-15T02:00:00.000Z"
}
```

## Agent Procedure

When asked to submit an event:

1. Inspect `.env` for `DIRECTUS_URL`, `DIRECTUS_TOKEN`, and `DIRECTUS_EVENTS_COLLECTION`.
2. Ask for missing event fields only if they cannot be inferred safely.
3. Generate a stable slug from the event title plus a short timestamp suffix.
4. Use `scripts/submit-event.mjs` from this skill when available.
5. Verify the created record by slug.
6. Report the Directus collection, created id, slug, and title. Do not report the token.

## Script Usage

From the project root:

```bash
node skills/directus-submit-event/scripts/submit-event.mjs --title "深圳地区的读书会沙龙" --category Reading --host "绒屿" --venue "深圳线下空间"
```

With a JSON payload file:

```bash
node skills/directus-submit-event/scripts/submit-event.mjs --file event.json
```

Override collection:

```bash
node skills/directus-submit-event/scripts/submit-event.mjs --collection activities --file approved-event.json
```
