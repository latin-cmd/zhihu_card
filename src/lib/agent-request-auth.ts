import { env } from "cloudflare:workers";

type RuntimeEnv = Env & Record<string, unknown>;

interface AuthorizationRow {
  agent_id: string;
  key_id: string;
  public_jwk: string;
  scopes_json: string;
}

export interface AgentRequestAuthority {
  agentId: string;
  agentCardId: string;
  keyId: string;
}

export class AgentRequestAuthError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AgentRequestAuthError";
    this.status = status;
    this.code = code;
  }
}

function database() {
  return (env as RuntimeEnv).CARD_SPACE_DB;
}

function base64UrlToBytes(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new AgentRequestAuthError(401, "invalid_signature", "Agent request signature is invalid.");
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
  try {
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    throw new AgentRequestAuthError(401, "invalid_signature", "Agent request signature is invalid.");
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function bodyHash(rawBody: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function verifyAgentRequest(
  request: Request,
  spaceId: string,
  rawBody: string,
  requiredScope: string
): Promise<AgentRequestAuthority> {
  const cardId = request.headers.get("X-Agent-Card-Id")?.trim() ?? "";
  const keyId = request.headers.get("X-Agent-Key-Id")?.trim() ?? "";
  const timestamp = request.headers.get("X-Agent-Timestamp")?.trim() ?? "";
  const nonce = request.headers.get("X-Agent-Nonce")?.trim() ?? "";
  const signature = request.headers.get("X-Agent-Signature")?.trim() ?? "";
  if (!cardId || !keyId || !timestamp || !nonce || !signature) {
    throw new AgentRequestAuthError(401, "missing_signature_headers", "Agent Card signature headers are required.");
  }
  if (!/^[A-Za-z0-9_-]{16,200}$/.test(nonce)) {
    throw new AgentRequestAuthError(400, "invalid_nonce", "Agent request nonce is invalid.");
  }
  const requestSeconds = Number(timestamp);
  const currentSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isSafeInteger(requestSeconds) || Math.abs(currentSeconds - requestSeconds) > 300) {
    throw new AgentRequestAuthError(401, "expired_request", "Agent request timestamp is outside the five-minute window.");
  }

  const d1 = database();
  if (!d1) throw new AgentRequestAuthError(503, "storage_unavailable", "Card Space D1 is unavailable.");
  const row = await d1.prepare(`SELECT ac.agent_id, ak.id AS key_id, ak.public_jwk, ak.scopes_json
    FROM agent_cards ac
    JOIN card_spaces s ON s.agent_id=ac.agent_id
    JOIN agent_auth_keys ak ON ak.agent_id=ac.agent_id AND ak.status='active'
    WHERE ac.id=? AND ac.status='active' AND s.id=? AND s.status='active' AND ak.id=?
    LIMIT 1`).bind(cardId, spaceId, keyId).first<AuthorizationRow>();
  if (!row) throw new AgentRequestAuthError(401, "unknown_agent_key", "Active Agent Card and signing key were not found for this Space.");
  let scopes: unknown = [];
  try { scopes = JSON.parse(row.scopes_json); } catch { /* invalid stored scopes deny access */ }
  if (!Array.isArray(scopes) || !scopes.includes(requiredScope)) {
    throw new AgentRequestAuthError(403, "insufficient_scope", `Agent Card does not grant ${requiredScope}.`);
  }

  const url = new URL(request.url);
  const canonical = `${request.method.toUpperCase()}\n${url.pathname}${url.search}\n${timestamp}\n${nonce}\n${await bodyHash(rawBody)}`;
  let publicJwk: JsonWebKey;
  try { publicJwk = JSON.parse(row.public_jwk) as JsonWebKey; } catch {
    throw new AgentRequestAuthError(401, "invalid_agent_key", "Stored Agent public key is invalid.");
  }
  let verified = false;
  try {
    const publicKey = await crypto.subtle.importKey("jwk", publicJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    verified = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      base64UrlToBytes(signature),
      new TextEncoder().encode(canonical)
    );
  } catch (error) {
    if (error instanceof AgentRequestAuthError) throw error;
  }
  if (!verified) throw new AgentRequestAuthError(401, "invalid_signature", "Agent request signature verification failed.");

  const now = new Date().toISOString();
  const expiresAt = new Date((requestSeconds + 300) * 1000).toISOString();
  try {
    await d1.batch([
      d1.prepare("DELETE FROM agent_request_nonces WHERE expires_at < ?").bind(now),
      d1.prepare("INSERT INTO agent_request_nonces (key_id, nonce, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(keyId, nonce, expiresAt, now)
    ]);
  } catch {
    throw new AgentRequestAuthError(409, "replayed_request", "Agent request nonce has already been used.");
  }
  return { agentId: row.agent_id, agentCardId: cardId, keyId };
}
