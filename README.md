# Agent Card Spaces

Astro + Cloudflare Worker application where identity, events and registrations are cards owned by a locally signed Agent Card.

## Storage

- `CARD_SPACE_DB` (Cloudflare D1) is the only event and registration database.
- `ZHIHU_CREDENTIALS_KV` stores local encryption/signing key material; provider secrets are encrypted before being placed in D1.
- R2 serves public assets only.
- There is no Directus runtime or fallback.

## Local setup

```bash
npm install
npx wrangler d1 migrations apply CARD_SPACE_DB --local
npm run build
npx wrangler dev --local --port 8787
```

Open <http://127.0.0.1:8787/>. Add a Zhihu Access Secret to claim an Agent Card and its isolated Card Space.

## Event API

Card Spaces are publicly discoverable through `/a2a` and identified by their signed Agent Card. Public cards, including Events, can be read without a login; owner mutations remain protected by the local Agent Card claim session.

- `GET /api/events` lists the current session's event cards.
- `POST /api/admin/events` creates an event card in the current or initial owner space. It requires `Authorization: Bearer <BACKOFFICE_API_TOKEN>`.
- `DELETE /api/admin/events/:slug` deletes an event card from D1 and requires the same token.
- `GET /api/subscriptions?event_slug=...` reads registrations in the current space.
- `POST /api/subscriptions` creates or updates a D1 registration for an event in the current space.

Apply every SQL file in `migrations/` before running a newly built Worker. For production, replace the local placeholder D1 database ID in `wrangler.jsonc` and configure `BACKOFFICE_API_TOKEN` and `CARD_VAULT_SECRET` as Worker secrets.

## Zhihu OAuth login

Alongside the Access Secret credential flow (`/credentials/zhihu`), the homepage also offers a "知乎官方登录" button that runs the real Zhihu OAuth 2.0 Authorization Code flow (`developer.zhihu.com/docs?key=zhihu_oauth_integrated`):

- `GET /api/oauth/zhihu/start` redirects to `https://openapi.zhihu.com/authorize` and sets a short-lived `state` cookie.
- `GET /auth/zhihu/callback` validates `state`, exchanges the returned `authorization_code` for an `access_token` via `POST https://openapi.zhihu.com/access_token`, and stages the token in a short-lived cookie.

Requires a registered Zhihu OAuth app (`app_id` + `app_key`, requested via `openplatform@zhihu.com`) configured as `ZHIHU_OAUTH_APP_ID` / `ZHIHU_OAUTH_APP_KEY` Worker secrets, with the redirect URI registered as `https://<host>/auth/zhihu/callback`. Binding the resulting token to a user/Card Space is not implemented yet.
