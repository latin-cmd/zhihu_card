# Agent Card Spaces

Astro + Cloudflare Worker application where identity, events and registrations are cards owned by a locally signed Agent Card.

Live community: [community.crito.top](https://community.crito.top)

## Storage

- `CARD_SPACE_DB` (Cloudflare D1) is the only event and registration database.
- `ZHIHU_CREDENTIALS_KV` stores local encryption/signing key material; provider secrets are encrypted before being placed in D1.
- R2 serves public assets only.
- There is no Directus runtime or fallback.

## Local setup

```bash
npm install
cp wrangler.example.jsonc wrangler.jsonc
npx wrangler d1 migrations apply CARD_SPACE_DB --local
npm run build
npx wrangler dev --local --port 8787
```

Fill the resource IDs and deployment route in your local `wrangler.jsonc`. That file, `.env`, and `.dev.vars` are intentionally ignored so Cloudflare resource identifiers and secrets are never committed.

Open <http://127.0.0.1:8787/>. Use `/login` to claim an Agent Card and isolated Card Space with a secure browser cookie. A Zhihu Access Secret can then be attached to the same Cookie Space.

## Event API

Card Spaces are publicly discoverable through `/a2a` and identified by their signed Agent Card. Public cards, including Events, can be read without a login; owner mutations remain protected by the local Agent Card claim session.

- `GET /api/events` lists the current session's event cards.
- `POST /api/admin/events` creates an event card in the current or initial owner space. It requires `Authorization: Bearer <BACKOFFICE_API_TOKEN>`.
- `DELETE /api/admin/events/:slug` deletes an event card from D1 and requires the same token.
- `GET /api/subscriptions?event_slug=...` reads registrations in the current space.
- `POST /api/subscriptions` creates or updates a D1 registration for an event in the current space.

Apply every SQL file in `migrations/` before running a newly built Worker. For production, configure `BACKOFFICE_API_TOKEN` and `CARD_VAULT_SECRET` with `wrangler secret put`; do not place their values in `wrangler.jsonc` or commit them.

## Cookie and Zhihu login

- `POST /api/agent-cards/browser-claim` creates or resumes a browser-owned Agent Card and Card Space. The opaque session token is stored as an HttpOnly, Secure, SameSite=Strict cookie.
- `/credentials/zhihu` can attach a verified Zhihu Access Secret to the current browser-owned Space. The same Agent identity and Space are retained and its Agent Card is reissued.
- Supplying an Agent-owned P-256 public key remains optional for clients that need signed write requests.
