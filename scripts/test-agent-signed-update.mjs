import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:8787";
const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
const suffix = randomBytes(8).toString("hex");
const ids = {
  user: `usr_test_${suffix}`,
  agent: `agt_test_${suffix}`,
  space: `spc_test_${suffix}`,
  issuer: `issuer_test_${suffix}`,
  agentCard: `ac_test_${suffix}`,
  key: `agent_key_test_${suffix}`,
  sourceCard: `card_source_test_${suffix}`,
  eventCard: `card_event_test_${suffix}`
};

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function d1(command) {
  return execFileSync(process.execPath, [wrangler, "d1", "execute", "CARD_SPACE_DB", "--local", "--command", command], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function base64Url(bytes) {
  return Buffer.from(bytes).toString("base64url");
}

async function signedHeaders(privateKey, body, nonce, version, method = "PATCH") {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const path = `/api/spaces/${ids.space}/cards/${ids.sourceCard}`;
  const hash = base64Url(await crypto.subtle.digest("SHA-256", Buffer.from(body)));
  const canonical = `${method}\n${path}\n${timestamp}\n${nonce}\n${hash}`;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, Buffer.from(canonical));
  return {
    "Content-Type": "application/json",
    ...(version ? { "If-Match": String(version) } : {}),
    "X-Agent-Card-Id": ids.agentCard,
    "X-Agent-Key-Id": ids.key,
    "X-Agent-Timestamp": timestamp,
    "X-Agent-Nonce": nonce,
    "X-Agent-Signature": base64Url(signature)
  };
}

const now = new Date().toISOString();
const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
const sourcePayload = { source: "zhihu", contentType: "answer", url: "https://www.zhihu.com/answer/123", createdAt: now, metrics: { likeCount: 0, commentCount: 0, favoriteCount: 0 } };
const eventPayload = { slug: "zhihu-123", cardKind: "zhihu_content", sourceUrl: "https://www.zhihu.com/answer/123", about: ["Before"] };

try {
  d1(`PRAGMA foreign_keys=ON;
    INSERT INTO users (id, created_at) VALUES (${quote(ids.user)}, ${quote(now)});
    INSERT INTO agent_principals (id, owner_user_id, provider, auth_mode, status, created_at) VALUES (${quote(ids.agent)}, ${quote(ids.user)}, 'zhihu', 'access_secret', 'active', ${quote(now)});
    INSERT INTO card_spaces (id, owner_user_id, agent_id, name, provider, status, created_at, visibility) VALUES (${quote(ids.space)}, ${quote(ids.user)}, ${quote(ids.agent)}, 'Signing Test', 'zhihu', 'active', ${quote(now)}, 'public');
    INSERT INTO issuer_keys (key_id, alg, public_jwk, status, created_at) VALUES (${quote(ids.issuer)}, 'ES256', '{}', 'active', ${quote(now)});
    INSERT INTO agent_cards (id, agent_id, version, body_json, body_hash, signature_json, key_id, status, issued_at) VALUES (${quote(ids.agentCard)}, ${quote(ids.agent)}, 1, '{}', 'test', '{}', ${quote(ids.issuer)}, 'active', ${quote(now)});
    INSERT INTO agent_auth_keys (id, agent_id, algorithm, public_jwk, scopes_json, status, created_at) VALUES (${quote(ids.key)}, ${quote(ids.agent)}, 'ES256', ${quote(JSON.stringify(publicJwk))}, '["cards:read","cards:update"]', 'active', ${quote(now)});
    INSERT INTO cards (id, space_id, owner_agent_id, source_provider, external_id, card_type, title, summary, payload_json, created_at, updated_at, visibility, version) VALUES (${quote(ids.sourceCard)}, ${quote(ids.space)}, ${quote(ids.agent)}, 'zhihu', 'zhihu:answer:123', 'zhihu_content', 'Before', 'Before', ${quote(JSON.stringify(sourcePayload))}, ${quote(now)}, ${quote(now)}, 'public', 1);
    INSERT INTO cards (id, space_id, owner_agent_id, source_provider, external_id, card_type, title, summary, payload_json, created_at, updated_at, visibility, version) VALUES (${quote(ids.eventCard)}, ${quote(ids.space)}, ${quote(ids.agent)}, 'zhihu-event', 'zhihu-123', 'event', 'Before', 'Before', ${quote(JSON.stringify(eventPayload))}, ${quote(now)}, ${quote(now)}, 'public', 1);`);

  const body = JSON.stringify({ title: "After", summary: "Updated by signed Agent", presentation: { tags: ["verified"] } });
  const nonce = base64Url(randomBytes(18));
  const headers = await signedHeaders(keyPair.privateKey, body, nonce, 1);
  const response = await fetch(`${origin}/api/spaces/${ids.space}/cards/${ids.sourceCard}`, { method: "PATCH", headers, body });
  const result = await response.json();
  if (response.status !== 200 || result.card?.version !== 2 || result.card?.pairedEventId !== ids.eventCard) throw new Error(`Signed update failed: ${response.status} ${JSON.stringify(result)}`);

  const readHeaders = await signedHeaders(keyPair.privateKey, "", base64Url(randomBytes(18)), 0, "GET");
  const read = await fetch(`${origin}/api/spaces/${ids.space}/cards/${ids.sourceCard}`, { method: "GET", headers: readHeaders });
  const readResult = await read.json();
  if (read.status !== 200 || readResult.card?.version !== 2 || readResult.card?.payload?.presentation?.tags?.[0] !== "verified") throw new Error(`Signed read failed: ${read.status} ${JSON.stringify(readResult)}`);

  const replay = await fetch(`${origin}/api/spaces/${ids.space}/cards/${ids.sourceCard}`, { method: "PATCH", headers, body });
  if (replay.status !== 409) throw new Error(`Replay was not rejected: ${replay.status}`);

  const staleHeaders = await signedHeaders(keyPair.privateKey, body, base64Url(randomBytes(18)), 1);
  const stale = await fetch(`${origin}/api/spaces/${ids.space}/cards/${ids.sourceCard}`, { method: "PATCH", headers: staleHeaders, body });
  if (stale.status !== 412) throw new Error(`Stale version was not rejected: ${stale.status}`);

  console.log(JSON.stringify({ ok: true, signedRead: read.status, signedUpdate: response.status, replay: replay.status, staleVersion: stale.status, pairedEventUpdated: true }));
} finally {
  d1(`PRAGMA foreign_keys=ON; DELETE FROM users WHERE id=${quote(ids.user)}; DELETE FROM issuer_keys WHERE key_id=${quote(ids.issuer)};`);
}
