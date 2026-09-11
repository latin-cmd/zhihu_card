# Directus + MCP Activity Web

Astro SSR activity page for a Luma-style city event experience.

This project now targets Cloudflare Workers instead of a Node standalone server:

- Display SSR runs in a Cloudflare Worker through `@astrojs/cloudflare`.
- The display page reads the remote Directus API when `DIRECTUS_URL` is configured, and falls back to sample content in `src/data/content.ts`.
- Dynamic event submission and event registration can use Cloudflare KV or Directus.
- The current Worker config uses `ACTIVITY_STORAGE=directus`, so dynamic writes are sent to the Tencent Cloud Directus API.
- If no KV binding or Directus URL is configured, local development falls back to in-memory mock data.

Directus should be deployed separately, for example on a Tencent Cloud server, and exposed to the Worker through HTTPS API environment variables.

## Data Model

- `activities`: event title, time, agenda, cover, venue relation
- `venues`: address and transit details
- `topics`: event topics
- `references`: topic references
- `partners`: cooperation partners
- `community_info`: singleton community intro and contact fields
- `activities_topics`: activity-topic junction
- `topics_references`: topic-reference junction

Nearby resources are intentionally not stored in Directus. Add them through a map provider such as Amap at runtime.

## Tencent Cloud Directus

Use `docker-compose.yml` and `Caddyfile` on a Tencent Cloud Ubuntu server. The stack runs Postgres, Redis, Directus, and Caddy HTTPS reverse proxy.

1. Point a domain such as `directus.example.com` to the Tencent Cloud server public IP.
2. Open security group ports `80` and `443`. Do not expose `8055` publicly.
3. Copy this project or at least `docker-compose.yml`, `Caddyfile`, and `.env.example` to `/opt/directus`.
4. Create the production `.env`:

```bash
cd /opt/directus
cp .env.example .env
nano .env
```

Set these values:

```env
DIRECTUS_HOST=directus.example.com
POSTGRES_PASSWORD=replace-with-strong-postgres-password
DIRECTUS_SECRET=replace-with-32-plus-char-random-secret
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-me-now
```

Start Directus:

```bash
docker compose up -d
docker compose logs -f directus
```

Check the API:

```bash
curl https://directus.example.com/server/ping
```

Expected response:

```text
pong
```

Initialize this project's Directus schema and sample data from your local machine:

```bash
$env:DIRECTUS_URL="https://directus.example.com"
$env:DIRECTUS_ADMIN_EMAIL="admin@example.com"
$env:DIRECTUS_ADMIN_PASSWORD="change-me-now"
npm run directus:bootstrap
```

Then create a Directus static token for the Worker and set it with:

```bash
npx wrangler secret put DIRECTUS_TOKEN
```

Update `wrangler.jsonc`:

```json
{
  "vars": {
    "DIRECTUS_URL": "https://directus.example.com",
    "ACTIVITY_STORAGE": "directus"
  }
}
```

Redeploy:

```bash
npm run cf:deploy
```

## Local Directus

```bash
docker compose up -d
npm install
$env:DIRECTUS_URL="http://127.0.0.1:8055"
$env:DIRECTUS_ADMIN_EMAIL="admin@example.com"
$env:DIRECTUS_ADMIN_PASSWORD="change-me-now"
npm run directus:bootstrap
```

## Astro Web

```bash
npm run dev
```

Production build:

```bash
npm run build
npm run preview -- --port 4322
```

## Cloudflare Worker

Create the KV namespace used by new events and registrations:

```bash
npx wrangler kv namespace create ACTIVITY_KV
npx wrangler kv namespace create ACTIVITY_KV --preview
```

Put the returned IDs into `wrangler.jsonc`.

For a Tencent Cloud Directus API, set:

```bash
npx wrangler secret put DIRECTUS_TOKEN
```

Then edit `wrangler.jsonc`:

```json
{
  "vars": {
    "ACTIVITY_STORAGE": "directus",
    "DIRECTUS_URL": "https://directus.example.com",
    "DIRECTUS_EVENTS_COLLECTION": "submitted_events",
    "DIRECTUS_SUBSCRIPTIONS_COLLECTION": "event_subscriptions"
  }
}
```

Storage modes:

- `auto`: use `ACTIVITY_KV` when bound; otherwise use Directus when `DIRECTUS_URL` exists; otherwise memory.
- `kv`: require the `ACTIVITY_KV` binding.
- `directus`: require `DIRECTUS_URL`; dynamic writes go to Directus collections over HTTP API.
- `memory`: development-only process memory.

Build and validate the Worker package:

```bash
npm run cf:dry-run
```

Deploy:

```bash
npm run cf:deploy
```

## Backoffice Event Deletion

Deleting a submitted event is intentionally backend-only. There is no frontend delete button.

Set the Worker secret:

```bash
npx wrangler secret put BACKOFFICE_API_TOKEN
```

Keep the same value in local `.env` for the helper script:

```env
BACKOFFICE_API_TOKEN=replace-with-strong-backoffice-token
WORKER_URL=https://communist-activity-web.m937746825.workers.dev
```

Delete a dynamic submitted event by slug:

```bash
npm run event:delete -- submitted-event-slug
```

The API endpoint behind the script is:

```http
DELETE /api/admin/events/:slug
Authorization: Bearer <BACKOFFICE_API_TOKEN>
Origin: https://communist-activity-web.m937746825.workers.dev
```

Static mock events such as `indie-dev-coffee-chat` are protected by the API and must be removed from source code instead.

## MCP Server

```bash
$env:DIRECTUS_URL="http://127.0.0.1:8055"
$env:DIRECTUS_TOKEN="your-directus-static-token"
npm run mcp
```

Tools exposed by the MCP server:

- `search_activities`
- `get_activity_detail`
- `get_topic_references`
- `get_community_info`

## Codex Worklog

This section records the migration and deployment work performed by Codex in this workspace. Secrets and tokens are intentionally omitted.

### User Goal

Convert the Astro activity project from a Node-oriented deployment to a Cloudflare Worker SSR deployment. Keep Directus as a separate Tencent Cloud service and let the Worker connect to Directus through HTTPS API calls. Dynamic activity submission and registration data must use Cloudflare storage or Directus API instead of Node-only local files.

The latest content request was:

- Region information: `绒屿`.
- Open registration: `深圳地区的读书会沙龙`.
- Clear the homepage activity index and current topics.
- Change the activity process to four steps without times: add indexed activity, add organizer WeChat, invite into group, attend offline activity.
- Keep the AI tool interface unchanged.
- Keep only the `独立开发者 Coffee Chat` mock in Events.
- Add a backend-only API and script to delete a specific dynamic activity; do not expose deletion in the frontend.

### Memory And Context Used

Codex used the in-session project context and prior task summary for this repository:

- The project is an Astro event platform.
- Earlier Node-only pieces used `@astrojs/node` and file-backed JSON mock stores.
- Cloudflare Worker deployment requires `@astrojs/cloudflare` and Worker-compatible persistence.
- Directus is intentionally separate from the Worker and runs on Tencent Cloud.
- Dynamic submissions and registrations should be stored in KV, D1, R2, or Directus API.
- For this deployment, dynamic writes now use Directus API through `ACTIVITY_STORAGE=directus`.

### Skills Loaded

Codex loaded these local skills for Cloudflare work:

- `cloudflare`: Cloudflare platform guidance for Workers, storage bindings, and deployment model.
- `wrangler`: Wrangler CLI guidance for deploys, secrets, KV bindings, and Worker configuration.

No recommended external plugin was installed during this work. The available recommended plugins list included Atlassian Rovo, Box, Google Drive, Notion, Slack, Teams, and others, but none were required for this project.

### MCP Context

The user asked to add Cloudflare MCP servers with commands such as:

```bash
codex mcp add cloudflare --url https://mcp.cloudflare.com/mcp
codex mcp add cloudflare-docs --url https://docs.mcp.cloudflare.com/mcp
codex mcp add cloudflare-bindings --url https://bindings.mcp.cloudflare.com/mcp
codex mcp add cloudflare-builds --url https://builds.mcp.cloudflare.com/mcp
codex mcp add cloudflare-observability --url https://observability.mcp.cloudflare.com/mcp
codex mcp login cloudflare
```

The project itself also includes an MCP server under `mcp/`, exposed through:

```bash
npm run mcp
```

The local MCP server tools are:

- `search_activities`
- `get_activity_detail`
- `get_topic_references`
- `get_community_info`

During the implementation, Codex primarily used local repository inspection, file edits, Wrangler CLI, Directus bootstrap scripts, and HTTP verification. Cloudflare MCP tools were not required for the final deployment path.

### Main Code Changes

- `astro.config.mjs`: switched SSR output to the Cloudflare adapter.
- `wrangler.jsonc`: configured the Worker name, Cloudflare assets binding, KV binding, observability, Directus URL, Directus collection names, and `ACTIVITY_STORAGE=directus`.
- `package.json`: added Cloudflare and Directus scripts:
  - `directus:bootstrap`
  - `event:delete`
  - `cf:dry-run`
  - `cf:deploy`
  - `cf:types`
- `src/lib/activity-store.ts`: implemented Worker-compatible storage routing:
  - KV mode
  - Directus mode
  - memory fallback
  - dynamic event creation
  - registration creation
  - dynamic event deletion
  - static mock slug protection
- `src/pages/api/events.ts`: dynamic submitted event API.
- `src/pages/api/subscriptions.ts`: dynamic registration API.
- `src/pages/api/admin/events/[slug].ts`: backend-only dynamic event deletion API protected by `BACKOFFICE_API_TOKEN`.
- `scripts/bootstrap-directus.mjs`: creates and updates Directus collections, fields, relations, permissions, and seed content.
- `scripts/delete-event.mjs`: backend helper script for deleting a submitted event by slug through the Worker API.
- `src/data/content.ts`: updated homepage content to `绒屿` and cleared topics/index data.
- `src/data/events.ts`: removed all static mock events except `独立开发者 Coffee Chat`.
- `src/pages/index.astro`: updated homepage rendering, cleared displayed activity index/topics, removed times from the process, and kept the AI tool interface names unchanged.
- `README.md`: documented Cloudflare Worker deployment, Directus deployment, storage modes, MCP server, and backoffice deletion.

### Directus Work

Directus was deployed separately on Tencent Cloud and exposed at:

```text
https://directus.crito.top
```

Verified endpoint:

```text
/server/ping -> pong
```

The Directus model includes:

- `venues`
- `activities`
- `topics`
- `references`
- `partners`
- `community_info`
- `activities_topics`
- `topics_references`
- `submitted_events`
- `event_subscriptions`

The bootstrap script was adjusted so empty activity times are written as `null`, which avoids invalid input errors for Directus `time` fields while still allowing the frontend process to display no times.

### Cloudflare Worker Work

The Worker was deployed as:

```text
communist-activity-web
```

Live URL:

```text
https://communist-activity-web.m937746825.workers.dev
```

Latest deployed version recorded during this work:

```text
0e0e9004-31d2-4a5f-ae16-d6954d16c6e7
```

Secrets configured through Wrangler:

- `DIRECTUS_TOKEN`
- `BACKOFFICE_API_TOKEN`

Secret values are not written in this README.

### Verification Performed

Build verification:

```bash
npm run build
```

Deployment command:

```bash
npm run cf:deploy
```

Runtime checks performed:

- Homepage returned `200`.
- Homepage contained `绒屿`.
- Homepage contained the new four-step process.
- Homepage no longer contained the old `Directus + MCP 城市活动数据沙龙` title.
- `/api/events` returned an empty dynamic event list after cleanup.
- `/events` contained `独立开发者 Coffee Chat`.
- `/events` did not contain the old `Directus + MCP` mock.
- `/events` did not contain the previous test slug `1-mrywyk8a`.

### Operational Notes

- Directus remains a separate service and is connected from the Worker over HTTPS API.
- The Worker is not running Directus directly.
- The Worker can still keep a KV binding, but current dynamic writes are intentionally routed to Directus with `ACTIVITY_STORAGE=directus`.
- Frontend users can submit/register events, but deletion is backend-only.
- Static mock events cannot be deleted through the admin API; remove them from `src/data/events.ts`.
- Do not commit `.env` because it contains real credentials and secrets.
