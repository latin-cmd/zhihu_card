import { env } from "cloudflare:workers";
import { syncZhihuCredentialCards, ZhihuCardSyncError } from "./zhihu-credential-card-sync";

type RuntimeEnv = Env & Record<string, unknown>;
type JsonObject = Record<string, unknown>;

const sessionCookie = "__Host-card_space_session";
const legacySessionCookie = "__Host-zhihu_credential_session";
const legacyCredentialPrefix = "credential:zhihu:session:";
const legacySessionMapPrefix = "migration:zhihu:legacy-session:";
const localIssuerKey = "system:local-agent-card-issuer:es256:v1";
const localVaultKey = "system:local-card-vault-key:v1";
const sessionLifetimeSeconds = 10 * 365 * 24 * 60 * 60;

interface LegacyZhihuCredential {
  provider: "zhihu";
  accessSecret: string;
  connectedAt: string;
  verifiedAt: string;
}

interface SessionRow { user_id: string; active_space_id: string | null; }
interface SpaceRow {
  id: string;
  owner_user_id: string;
  name: string;
  provider: string;
  status: string;
  created_at: string;
  agent_id: string;
  auth_mode: string;
  connection_id: string;
  connected_at: string;
  verified_at: string;
  credential_fingerprint: string | null;
  card_id: string | null;
  card_version: number | null;
  card_issued_at: string | null;
  visibility?: string;
}

interface PublicSpaceRow {
  id: string;
  name: string;
  provider: string;
  status: string;
  created_at: string;
  agent_id: string;
  visibility: string;
  card_id: string | null;
  card_version: number | null;
  card_issued_at: string | null;
}

interface EventCardRow {
  id: string;
  external_id: string;
  source_provider: string;
  title: string;
  summary: string | null;
  payload_json: string;
  visibility: string;
  created_at: string;
}

interface AgentSigningKey {
  id: string;
  publicJwk: JsonWebKey;
  scopes: string[];
}

function runtimeEnv() { return env as RuntimeEnv; }
function db() { return runtimeEnv().CARD_SPACE_DB; }
function kv() { return runtimeEnv().ZHIHU_CREDENTIALS_KV; }
function clean(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomId(prefix: string) {
  return `${prefix}${bytesToBase64Url(crypto.getRandomValues(new Uint8Array(18)))}`;
}

function cookieValue(request: Request, name: string) {
  for (const item of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = item.indexOf("=");
    if (separator !== -1 && item.slice(0, separator).trim() === name) {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
  }
  return "";
}

function secureCookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

function clearCookie(name: string) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as JsonObject;
    return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  throw new TypeError("Agent Card contains a non-JSON value.");
}

function eventPayload(row: EventCardRow) {
  let payload: JsonObject;
  try {
    payload = JSON.parse(row.payload_json) as JsonObject;
  } catch {
    payload = {};
  }
  const title = clean(payload.title) || row.title;
  const summary = clean(payload.summary) || row.summary || "";
  return {
    ...payload,
    title,
    summary,
    slug: clean(payload.slug) || row.external_id,
    host: clean(payload.host) || clean(payload.presentedBy) || "Card Space",
    venue: clean(payload.venue) || clean(payload.locationName) || "线上",
    locationName: clean(payload.locationName) || clean(payload.venue) || "线上",
    date: clean(payload.date) || row.created_at.slice(0, 10),
    time: clean(payload.time) || "详情",
    statusLabel: clean(payload.statusLabel) || "内容 Card",
    about: Array.isArray(payload.about) && payload.about.length ? payload.about : summary ? [summary] : []
  };
}

async function sessionForRequest(request: Request) {
  const token = cookieValue(request, sessionCookie);
  const database = db();
  if (!database || !token) return null;
  const tokenHash = await sha256(token);
  const row = await database.prepare(
    "SELECT user_id, active_space_id FROM sessions WHERE token_hash = ? AND revoked_at IS NULL"
  ).bind(tokenHash).first<SessionRow>();
  return row ? { userId: row.user_id, activeSpaceId: row.active_space_id, tokenHash } : null;
}

async function vaultCryptoKey() {
  const configuredSecret = clean(runtimeEnv().CARD_VAULT_SECRET);
  let material = configuredSecret;
  if (!material) {
    const storage = kv();
    if (!storage) throw new Error("本地密钥存储尚未配置。");
    material = await storage.get(localVaultKey) ?? "";
    if (!material) {
      material = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
      await storage.put(localVaultKey, material);
    }
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptSecret(plaintext: string, connectionId: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(connectionId) },
    await vaultCryptoKey(),
    new TextEncoder().encode(plaintext)
  );
  return JSON.stringify({ v: 1, iv: bytesToBase64Url(iv), ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)) });
}

async function decryptSecret(value: string, connectionId: string) {
  const envelope = JSON.parse(value) as { v: number; iv: string; ciphertext: string };
  if (envelope.v !== 1) throw new Error("Unsupported credential envelope.");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(envelope.iv), additionalData: new TextEncoder().encode(connectionId) },
    await vaultCryptoKey(),
    base64UrlToBytes(envelope.ciphertext)
  );
  return new TextDecoder().decode(plaintext);
}

async function credentialFingerprint(provider: string, secret: string) {
  return sha256(`${provider}\u0000${secret}`);
}

async function issuer() {
  const storage = kv();
  if (!storage) throw new Error("本地签发密钥存储尚未配置。");
  let stored = await storage.get<{ privateJwk: JsonWebKey; publicJwk: JsonWebKey; keyId: string }>(localIssuerKey, "json");
  if (!stored) {
    const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    stored = { publicJwk, privateJwk, keyId: `local-es256-${(await sha256(canonicalJson(publicJwk))).slice(0, 16)}` };
    await storage.put(localIssuerKey, JSON.stringify(stored));
  }
  return stored;
}

async function signedAgentCard(origin: string, agentId: string, spaceId: string, provider: string, version: number, agentSigningKey?: AgentSigningKey | null) {
  if (origin === "http://community.crito.top") origin = "https://community.crito.top";
  const currentIssuer = await issuer();
  const body: JsonObject = {
    protocolVersion: "0.3.0",
    name: provider === "zhihu" ? "知乎 Personal Agent" : "Personal Agent",
    description: "A locally issued, verifiable identity credential for one publicly readable A2A Card Space. Provider secrets are never included.",
    version: `1.0.${version}`,
    preferredTransport: "HTTP+JSON",
    additionalInterfaces: [{ transport: "HTTP+JSON", url: `${origin}/api/spaces/${spaceId}` }],
    capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
    securitySchemes: {
      agentSignature: { apiKeySecurityScheme: { name: "X-Agent-Signature", in: "header" } },
      localSession: { httpAuthSecurityScheme: { scheme: "Bearer", bearerFormat: "Opaque session" } }
    },
    security: agentSigningKey ? [{ agentSignature: [] }, { localSession: [] }] : [{ localSession: [] }],
    extensions: agentSigningKey ? [{
      uri: "urn:crito:agent-request-signature:v1",
      required: true,
      params: {
        algorithm: "ES256",
        keyId: agentSigningKey.id,
        publicJwk: agentSigningKey.publicJwk,
        scopes: agentSigningKey.scopes,
        timestampWindowSeconds: 300,
        canonicalRequest: "METHOD\\nPATH_WITH_QUERY\\nTIMESTAMP\\nNONCE\\nBASE64URL_SHA256_BODY"
      }
    }] : [],
    skills: [
      { id: "claim-agent-card", name: "Claim Agent Card", description: "Claim or resume an Agent Card with a Zhihu proof and bind an Agent-owned public signing key.", tags: ["identity", "claim", "agent-card", provider], examples: [`POST ${origin}/api/agent-cards/claim`] },
      { id: "card-space-add-card", name: "Add Card", description: "Add a generic card to this Card Space.", tags: ["cards", "create", provider], examples: [`POST ${origin}/api/spaces/${spaceId}/cards`] },
      { id: "card-space-update-card", name: "Update Card", description: "Update a Card's local presentation through an Agent-signed request.", tags: ["cards", "update", provider], examples: [`PATCH ${origin}/api/spaces/${spaceId}/cards/{cardId}`] },
      { id: "card-space-delete-card", name: "Delete Card", description: "Delete a non-identity card from this Card Space.", tags: ["cards", "delete", provider], examples: [`DELETE ${origin}/api/spaces/${spaceId}/cards/{cardId}`] },
      { id: "zhihu-credential-to-card-events", name: "Zhihu to Card Events", description: "Import recent Zhihu creations as source cards and paired Event detail cards after credential claim.", tags: ["zhihu", "cards", "events", provider], examples: [`GET ${origin}/api/skills/zhihu-credential-to-card-events`] }
    ]
  };
  const protectedHeader = { alg: "ES256", typ: "JOSE", kid: currentIssuer.keyId, jku: `${origin}/api/agent-card-issuer/jwks.json` };
  const signingInput = `${bytesToBase64Url(new TextEncoder().encode(canonicalJson(protectedHeader)))}.${bytesToBase64Url(new TextEncoder().encode(canonicalJson(body)))}`;
  const privateKey = await crypto.subtle.importKey("jwk", currentIssuer.privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, new TextEncoder().encode(signingInput));
  const signatureRecord = { protected: signingInput.split(".")[0], signature: bytesToBase64Url(new Uint8Array(signature)) };
  return { body: { ...body, signatures: [signatureRecord] }, signature: signatureRecord, keyId: currentIssuer.keyId, bodyHash: await sha256(canonicalJson(body)), publicJwk: currentIssuer.publicJwk };
}

async function normalizeAgentPublicJwk(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("agentPublicKey must be a P-256 public JWK.");
  const input = value as JsonObject;
  if ("d" in input || input.kty !== "EC" || input.crv !== "P-256" || !clean(input.x) || !clean(input.y)) {
    throw new Error("agentPublicKey must contain only a P-256 public key.");
  }
  const publicJwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: clean(input.x),
    y: clean(input.y),
    alg: "ES256",
    use: "sig",
    key_ops: ["verify"],
    ext: true
  };
  try {
    await crypto.subtle.importKey("jwk", publicJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  } catch {
    throw new Error("agentPublicKey is not a valid P-256 public JWK.");
  }
  return publicJwk;
}

async function activeAgentSigningKey(database: D1Database, agentId: string): Promise<AgentSigningKey | null> {
  const row = await database.prepare("SELECT id, public_jwk, scopes_json FROM agent_auth_keys WHERE agent_id=? AND status='active' ORDER BY created_at DESC LIMIT 1")
    .bind(agentId).first<{ id: string; public_jwk: string; scopes_json: string }>();
  if (!row) return null;
  try {
    return { id: row.id, publicJwk: JSON.parse(row.public_jwk) as JsonWebKey, scopes: JSON.parse(row.scopes_json) as string[] };
  } catch {
    return null;
  }
}

async function reissueAgentCard(
  database: D1Database,
  space: { id: string; owner_user_id: string; agent_id: string; provider: string },
  origin: string,
  action: string
) {
  const current = await database.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM agent_cards WHERE agent_id=?")
    .bind(space.agent_id).first<{ version: number }>();
  const version = Number(current?.version ?? 0) + 1;
  const cardId = randomId("ac_");
  const now = new Date().toISOString();
  const signingKey = await activeAgentSigningKey(database, space.agent_id);
  const card = await signedAgentCard(origin, space.agent_id, space.id, space.provider, version, signingKey);
  await database.batch([
    database.prepare("UPDATE agent_cards SET status='superseded', revoked_at=? WHERE agent_id=? AND status='active'").bind(now, space.agent_id),
    database.prepare("INSERT INTO agent_cards (id, agent_id, version, body_json, body_hash, signature_json, key_id, status, issued_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)").bind(cardId, space.agent_id, version, JSON.stringify(card.body), card.bodyHash, JSON.stringify(card.signature), card.keyId, now),
    database.prepare("UPDATE cards SET external_id=?, payload_json=?, updated_at=? WHERE space_id=? AND owner_agent_id=? AND card_type='agent_identity'").bind(cardId, JSON.stringify({ agentCardId: cardId, agentId: space.agent_id, issuerKeyId: card.keyId, agentSigningKeyId: signingKey?.id ?? null }), now, space.id, space.agent_id),
    database.prepare("INSERT INTO audit_events (id, user_id, agent_id, space_id, action, created_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(randomId("aud_"), space.owner_user_id, space.agent_id, space.id, action, now, JSON.stringify({ cardId, version, agentSigningKeyId: signingKey?.id ?? null, skills: ["claim-agent-card", "card-space-add-card", "card-space-update-card", "card-space-delete-card", "zhihu-credential-to-card-events"] }))
  ]);
  return { id: cardId, agentId: space.agent_id, spaceId: space.id, version, body: card.body, agentKeyId: signingKey?.id ?? null };
}

async function bindAgentSigningKey(
  created: Awaited<ReturnType<typeof createZhihuSpace>>,
  publicKeyInput: unknown,
  origin: string
) {
  const database = db();
  if (!database) throw new Error("Card Space D1 尚未配置。");
  const publicJwk = await normalizeAgentPublicJwk(publicKeyInput);
  const scopes = ["cards:read", "cards:update"];
  const keyId = `agent-es256-${(await sha256(`${created.agentId}\u0000${canonicalJson(publicJwk)}`)).slice(0, 20)}`;
  const currentKey = await activeAgentSigningKey(database, created.agentId);
  if (currentKey?.id === keyId) {
    return { agentCardId: created.agentCardId, agentKeyId: keyId, agentCard: null, keyChanged: false };
  }
  const now = new Date().toISOString();
  await database.batch([
    database.prepare("UPDATE agent_auth_keys SET status='revoked', revoked_at=? WHERE agent_id=? AND status='active'").bind(now, created.agentId),
    database.prepare(`INSERT INTO agent_auth_keys (id, agent_id, algorithm, public_jwk, scopes_json, status, created_at, revoked_at)
      VALUES (?, ?, 'ES256', ?, ?, 'active', ?, NULL)
      ON CONFLICT(id) DO UPDATE SET agent_id=excluded.agent_id, public_jwk=excluded.public_jwk, scopes_json=excluded.scopes_json, status='active', revoked_at=NULL`).bind(keyId, created.agentId, JSON.stringify(publicJwk), JSON.stringify(scopes), now)
  ]);
  const agentCard = await reissueAgentCard(database, {
    id: created.spaceId,
    owner_user_id: created.userId,
    agent_id: created.agentId,
    provider: "zhihu"
  }, origin, "agent_card.claimed_with_key");
  return { agentCardId: agentCard.id, agentKeyId: keyId, agentCard, keyChanged: true };
}

async function latestSpace(database: D1Database, userId: string, provider = "zhihu") {
  return database.prepare(`SELECT s.id, s.owner_user_id, s.name, s.provider, s.status, s.created_at, s.agent_id, p.auth_mode,
    p.id AS connection_id, p.connected_at, p.verified_at, p.credential_fingerprint, ac.id AS card_id, ac.version AS card_version, ac.issued_at AS card_issued_at
    FROM card_spaces s JOIN provider_connections p ON p.space_id = s.id
    LEFT JOIN agent_cards ac ON ac.agent_id = s.agent_id AND ac.status = 'active'
    WHERE s.owner_user_id = ? AND s.provider = ? AND s.status = 'active' AND p.status = 'active'
    ORDER BY ac.version DESC, s.created_at DESC LIMIT 1`).bind(userId, provider).first<SpaceRow>();
}

export async function readZhihuSpaceStatus(request: Request) {
  const database = db();
  if (!database) return { provider: "zhihu", configured: false, connected: false };
  const currentSession = await sessionForRequest(request);
  if (!currentSession) return { provider: "zhihu", configured: true, connected: false };
  const space = await latestSpace(database, currentSession.userId);
  if (!space) return { provider: "zhihu", configured: true, connected: false };
  if (!space.credential_fingerprint) {
    const connection = await database.prepare("SELECT secret_ciphertext FROM provider_connections WHERE id=?").bind(space.connection_id).first<{ secret_ciphertext: string }>();
    if (connection?.secret_ciphertext) {
      const secret = await decryptSecret(connection.secret_ciphertext, space.connection_id);
      await database.prepare("UPDATE provider_connections SET credential_fingerprint=? WHERE id=? AND credential_fingerprint IS NULL").bind(await credentialFingerprint("zhihu", secret), space.connection_id).run();
    }
  }
  return { provider: "zhihu", configured: true, connected: true, connectedAt: space.connected_at, verifiedAt: space.verified_at, spaceId: space.id, agentId: space.agent_id, agentCardId: space.card_id, agentCardVersion: space.card_version };
}

async function createZhihuSpace(request: Request, accessSecret: string, dates: { connectedAt?: string; verifiedAt?: string } = {}) {
  const database = db();
  if (!database) throw new Error("Card Space D1 尚未配置。");
  const now = new Date().toISOString();
  const priorSession = await sessionForRequest(request);
  const userId = priorSession?.userId ?? randomId("usr_");
  const sessionToken = priorSession ? "" : randomId("ses_");
  const agentId = randomId("agt_");
  const spaceId = randomId("spc_");
  const connectionId = randomId("con_");
  const cardId = randomId("ac_");
  const origin = new URL(request.url).origin;
  const fingerprint = await credentialFingerprint("zhihu", accessSecret);
  const matching = await database.prepare(`SELECT p.owner_user_id, p.space_id, p.agent_id, p.id AS connection_id, p.connected_at, ac.id AS card_id
    FROM provider_connections p JOIN card_spaces s ON s.id=p.space_id
    LEFT JOIN agent_cards ac ON ac.agent_id=p.agent_id AND ac.status='active'
    WHERE p.provider='zhihu' AND p.credential_fingerprint=? AND p.status='active' AND s.status='active'
    ORDER BY ac.version DESC LIMIT 1`).bind(fingerprint).first<{ owner_user_id: string; space_id: string; agent_id: string; connection_id: string; connected_at: string; card_id: string | null }>();
  if (matching) {
    const newSessionToken = priorSession?.userId === matching.owner_user_id ? "" : randomId("ses_");
    const statements: D1PreparedStatement[] = [
      database.prepare("UPDATE provider_connections SET verified_at=? WHERE id=?").bind(dates.verifiedAt ?? now, matching.connection_id)
    ];
    if (priorSession?.userId === matching.owner_user_id) {
      statements.push(database.prepare("UPDATE sessions SET active_space_id=? WHERE token_hash=?").bind(matching.space_id, priorSession.tokenHash));
    } else {
      if (priorSession) statements.push(database.prepare("UPDATE sessions SET revoked_at=? WHERE token_hash=?").bind(now, priorSession.tokenHash));
      statements.push(database.prepare("INSERT INTO sessions (token_hash, user_id, created_at, active_space_id) VALUES (?, ?, ?, ?)").bind(await sha256(newSessionToken), matching.owner_user_id, now, matching.space_id));
    }
    await database.batch(statements);
    return { userId: matching.owner_user_id, sessionToken: newSessionToken, spaceId: matching.space_id, agentId: matching.agent_id, connectionId: matching.connection_id, agentCardId: matching.card_id, connectedAt: matching.connected_at, verifiedAt: dates.verifiedAt ?? now, createdSession: Boolean(newSessionToken), resumed: true };
  }
  if (priorSession) {
    const existing = await latestSpace(database, priorSession.userId);
    if (existing) {
      const cipher = await encryptSecret(accessSecret, existing.connection_id);
      await database.batch([
        database.prepare("UPDATE provider_connections SET secret_ciphertext=?, credential_fingerprint=?, verified_at=? WHERE id=?").bind(cipher, fingerprint, dates.verifiedAt ?? now, existing.connection_id),
        database.prepare("UPDATE sessions SET active_space_id=? WHERE token_hash=?").bind(existing.id, priorSession.tokenHash)
      ]);
      return { userId: priorSession.userId, sessionToken: "", spaceId: existing.id, agentId: existing.agent_id, connectionId: existing.connection_id, agentCardId: existing.card_id, connectedAt: existing.connected_at, verifiedAt: dates.verifiedAt ?? now, createdSession: false, resumed: true };
    }
  }
  const card = await signedAgentCard(origin, agentId, spaceId, "zhihu", 1);
  const cipher = await encryptSecret(accessSecret, connectionId);
  const statements: D1PreparedStatement[] = [];
  if (!priorSession) {
    statements.push(database.prepare("INSERT INTO users (id, created_at) VALUES (?, ?)").bind(userId, now));
    statements.push(database.prepare("INSERT INTO sessions (token_hash, user_id, created_at, active_space_id) VALUES (?, ?, ?, ?)").bind(await sha256(sessionToken), userId, now, spaceId));
  }
  statements.push(
    database.prepare("INSERT OR IGNORE INTO issuer_keys (key_id, alg, public_jwk, status, created_at) VALUES (?, 'ES256', ?, 'active', ?)").bind(card.keyId, JSON.stringify(card.publicJwk), now),
    database.prepare("INSERT INTO agent_principals (id, owner_user_id, provider, auth_mode, status, created_at) VALUES (?, ?, 'zhihu', 'access_secret', 'active', ?)").bind(agentId, userId, now),
    database.prepare("INSERT INTO card_spaces (id, owner_user_id, agent_id, name, provider, status, created_at, visibility) VALUES (?, ?, ?, ?, 'zhihu', 'active', ?, 'public')").bind(spaceId, userId, agentId, "知乎 · Card Space", now),
    database.prepare("INSERT INTO agent_claims (id, user_id, agent_id, proof_type, proof_ref, status, claimed_at) VALUES (?, ?, ?, 'zhihu_access_secret', 'zhihu', 'active', ?)").bind(randomId("clm_"), userId, agentId, now),
    database.prepare("INSERT INTO provider_connections (id, owner_user_id, agent_id, space_id, provider, auth_mode, secret_ciphertext, status, connected_at, verified_at, credential_fingerprint) VALUES (?, ?, ?, ?, 'zhihu', 'access_secret', ?, 'active', ?, ?, ?)").bind(connectionId, userId, agentId, spaceId, cipher, dates.connectedAt ?? now, dates.verifiedAt ?? now, fingerprint),
    database.prepare("INSERT INTO agent_cards (id, agent_id, version, body_json, body_hash, signature_json, key_id, status, issued_at) VALUES (?, ?, 1, ?, ?, ?, ?, 'active', ?)").bind(cardId, agentId, JSON.stringify(card.body), card.bodyHash, JSON.stringify(card.signature), card.keyId, now),
    database.prepare("INSERT INTO cards (id, space_id, owner_agent_id, source_provider, source_connection_id, external_id, card_type, title, summary, payload_json, created_at, updated_at, visibility) VALUES (?, ?, ?, 'crito-local-issuer', ?, ?, 'agent_identity', ?, ?, ?, ?, ?, 'public')").bind(randomId("card_"), spaceId, agentId, connectionId, cardId, "Agent Card", "The locally signed identity root for this space.", JSON.stringify({ agentCardId: cardId, agentId, issuerKeyId: card.keyId }), now, now),
    database.prepare("INSERT INTO audit_events (id, user_id, agent_id, space_id, action, created_at, metadata_json) VALUES (?, ?, ?, ?, 'zhihu.connection.created', ?, ?)").bind(randomId("aud_"), userId, agentId, spaceId, now, JSON.stringify({ authMode: "access_secret" }))
  );
  if (priorSession) statements.push(database.prepare("UPDATE sessions SET active_space_id = ? WHERE token_hash = ?").bind(spaceId, priorSession.tokenHash));
  await database.batch(statements);
  return { userId, sessionToken, spaceId, agentId, connectionId, agentCardId: cardId, connectedAt: dates.connectedAt ?? now, verifiedAt: dates.verifiedAt ?? now, createdSession: !priorSession, resumed: false };
}

async function syncZhihuCardsAfterClaim(created: Awaited<ReturnType<typeof createZhihuSpace>>, accessSecret: string) {
  const database = db();
  if (!database) return { ok: false as const, code: "storage_unavailable", error: "Card Space D1 尚未配置。" };
  try {
    return await syncZhihuCredentialCards({
      database,
      accessSecret,
      userId: created.userId,
      agentId: created.agentId,
      spaceId: created.spaceId,
      connectionId: created.connectionId
    });
  } catch (error) {
    const code = error instanceof ZhihuCardSyncError ? error.code : "internal_error";
    const message = error instanceof ZhihuCardSyncError ? error.message : "知乎 Card 自动生成暂时失败。";
    try {
      await database.prepare("INSERT INTO audit_events (id, user_id, agent_id, space_id, action, created_at, metadata_json) VALUES (?, ?, ?, ?, 'zhihu.cards.sync_failed', ?, ?)")
        .bind(randomId("aud_"), created.userId, created.agentId, created.spaceId, new Date().toISOString(), JSON.stringify({ code, via: "zhihu-credential-to-card-events" })).run();
    } catch { /* the verified credential remains usable even if audit storage is unavailable */ }
    return { ok: false as const, code, error: message };
  }
}

export async function migrateLegacyZhihuCredential(request: Request) {
  const alreadyConnected = await readZhihuSpaceStatus(request);
  if (alreadyConnected.connected) return { status: alreadyConnected, headers: new Headers() };
  const storage = kv();
  const legacyId = cookieValue(request, legacySessionCookie);
  if (!storage || !legacyId) return { status: alreadyConnected, headers: new Headers() };
  const migratedUserId = await storage.get(`${legacySessionMapPrefix}${legacyId}`);
  if (migratedUserId) {
    const sessionToken = randomId("ses_");
    const database = db();
    if (!database) return { status: alreadyConnected, headers: new Headers() };
    const space = await latestSpace(database, migratedUserId);
    await database.prepare("INSERT INTO sessions (token_hash, user_id, created_at, active_space_id) VALUES (?, ?, ?, ?)").bind(await sha256(sessionToken), migratedUserId, new Date().toISOString(), space?.id ?? null).run();
    await storage.delete(`${legacySessionMapPrefix}${legacyId}`);
    const headers = new Headers();
    headers.append("Set-Cookie", secureCookie(sessionCookie, sessionToken, sessionLifetimeSeconds));
    headers.append("Set-Cookie", clearCookie(legacySessionCookie));
    return { status: space ? { provider: "zhihu", configured: true, connected: true, connectedAt: space.connected_at, verifiedAt: space.verified_at, spaceId: space.id, agentId: space.agent_id, agentCardId: space.card_id, agentCardVersion: space.card_version } : alreadyConnected, headers };
  }
  const legacy = await storage.get<LegacyZhihuCredential>(`${legacyCredentialPrefix}${legacyId}`, "json");
  if (!legacy?.accessSecret) return { status: alreadyConnected, headers: new Headers() };
  const created = await createZhihuSpace(request, legacy.accessSecret, { connectedAt: legacy.connectedAt, verifiedAt: legacy.verifiedAt });
  await syncZhihuCardsAfterClaim(created, legacy.accessSecret);
  await storage.put(`${legacySessionMapPrefix}${legacyId}`, created.userId, { expirationTtl: 10 * 60 });
  await storage.delete(`${legacyCredentialPrefix}${legacyId}`);
  const headers = new Headers();
  if (created.createdSession) headers.append("Set-Cookie", secureCookie(sessionCookie, created.sessionToken, sessionLifetimeSeconds));
  headers.append("Set-Cookie", clearCookie(legacySessionCookie));
  return {
    status: { provider: "zhihu", configured: true, connected: true, connectedAt: created.connectedAt, verifiedAt: created.verifiedAt, spaceId: created.spaceId, agentId: created.agentId, agentCardId: created.agentCardId, agentCardVersion: 1 },
    headers
  };
}

export async function saveVerifiedZhihuConnection(request: Request, accessSecret: string, agentPublicKey?: unknown) {
  const normalizedAgentPublicKey = agentPublicKey ? await normalizeAgentPublicJwk(agentPublicKey) : null;
  const created = await createZhihuSpace(request, accessSecret);
  const claimedKey = normalizedAgentPublicKey
    ? await bindAgentSigningKey(created, normalizedAgentPublicKey, new URL(request.url).origin)
    : null;
  const cardSync = await syncZhihuCardsAfterClaim(created, accessSecret);
  const origin = new URL(request.url).origin;
  const headers = new Headers({ "Cache-Control": "no-store" });
  if (created.createdSession) headers.append("Set-Cookie", secureCookie(sessionCookie, created.sessionToken, sessionLifetimeSeconds));
  return Response.json({
    provider: "zhihu",
    connected: true,
    connectedAt: created.connectedAt,
    verifiedAt: created.verifiedAt,
    spaceId: created.spaceId,
    agentId: created.agentId,
    agentCardId: claimedKey?.agentCardId ?? created.agentCardId,
    agentKeyId: claimedKey?.agentKeyId ?? null,
    keyChanged: claimedKey?.keyChanged ?? false,
    resumed: created.resumed,
    visibility: "public",
    publicA2aSpace: `${origin}/api/a2a/spaces/${created.spaceId}`,
    cardSync
  }, { status: created.resumed ? 200 : 201, headers });
}

export async function logoutCurrentSession(request: Request) {
  const database = db();
  const currentSession = await sessionForRequest(request);
  if (database && currentSession) {
    await database.prepare("UPDATE sessions SET revoked_at=? WHERE token_hash=?").bind(new Date().toISOString(), currentSession.tokenHash).run();
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store", "Set-Cookie": clearCookie(sessionCookie) } });
}

export async function listSpaces(request: Request) {
  const database = db();
  const currentSession = await sessionForRequest(request);
  if (!database || !currentSession) return [];
  const result = await database.prepare(`SELECT s.id, s.owner_user_id, s.name, s.provider, s.status, s.created_at, s.agent_id, p.auth_mode, p.id AS connection_id, p.connected_at, p.verified_at, p.credential_fingerprint,
    ac.id AS card_id, ac.version AS card_version, ac.issued_at AS card_issued_at
    FROM card_spaces s JOIN provider_connections p ON p.space_id=s.id
    JOIN agent_claims cl ON cl.agent_id=s.agent_id AND cl.user_id=? AND cl.status='active'
    LEFT JOIN agent_cards ac ON ac.agent_id=s.agent_id AND ac.status='active'
    WHERE s.owner_user_id=? AND s.status='active' AND p.status='active' ORDER BY s.created_at DESC`).bind(currentSession.userId, currentSession.userId).all<SpaceRow>();
  return result.results;
}

export async function getSpace(request: Request, spaceId: string) {
  const database = db();
  const currentSession = await sessionForRequest(request);
  if (!database || !currentSession) return null;
  const space = await database.prepare(`SELECT s.id, s.owner_user_id, s.name, s.provider, s.status, s.created_at, s.agent_id, p.auth_mode, p.id AS connection_id, p.connected_at, p.verified_at, p.credential_fingerprint,
    ac.id AS card_id, ac.version AS card_version, ac.issued_at AS card_issued_at
    FROM card_spaces s JOIN provider_connections p ON p.space_id=s.id
    JOIN agent_claims cl ON cl.agent_id=s.agent_id AND cl.user_id=? AND cl.status='active'
    LEFT JOIN agent_cards ac ON ac.agent_id=s.agent_id AND ac.status='active'
    WHERE s.id=? AND s.owner_user_id=? AND s.status='active' AND p.status='active' ORDER BY ac.version DESC LIMIT 1`).bind(currentSession.userId, spaceId, currentSession.userId).first<SpaceRow>();
  if (!space) return null;
  const cards = await database.prepare("SELECT id, card_type, title, summary, source_provider, version, created_at FROM cards WHERE space_id=? ORDER BY created_at DESC").bind(spaceId).all();
  const agentCard = space.card_id ? await database.prepare("SELECT body_json, signature_json, key_id, issued_at FROM agent_cards WHERE id=? AND status='active'").bind(space.card_id).first<{ body_json: string; signature_json: string; key_id: string; issued_at: string }>() : null;
  return { ...space, cards: cards.results, agentCard: agentCard ? { ...agentCard, body: JSON.parse(agentCard.body_json) } : null };
}

export async function listPublicSpaces() {
  const database = db();
  if (!database) return [];
  const result = await database.prepare(`SELECT s.id, s.name, s.provider, s.status, s.created_at, s.agent_id, s.visibility,
    ac.id AS card_id, ac.version AS card_version, ac.issued_at AS card_issued_at
    FROM card_spaces s
    JOIN agent_cards ac ON ac.agent_id=s.agent_id AND ac.status='active'
    WHERE s.status='active' AND s.visibility='public'
    ORDER BY s.created_at DESC, ac.version DESC`).all<PublicSpaceRow>();
  const seen = new Set<string>();
  return result.results.filter((space) => !seen.has(space.id) && Boolean(seen.add(space.id)));
}

export async function getPublicSpace(spaceId: string) {
  const database = db();
  if (!database) return null;
  const space = await database.prepare(`SELECT s.id, s.name, s.provider, s.status, s.created_at, s.agent_id, s.visibility,
    ac.id AS card_id, ac.version AS card_version, ac.issued_at AS card_issued_at
    FROM card_spaces s
    JOIN agent_cards ac ON ac.agent_id=s.agent_id AND ac.status='active'
    WHERE s.id=? AND s.status='active' AND s.visibility='public'
    ORDER BY ac.version DESC LIMIT 1`).bind(spaceId).first<PublicSpaceRow>();
  if (!space) return null;
  const cards = await database.prepare("SELECT id, external_id, card_type, title, summary, source_provider, visibility, version, created_at FROM cards WHERE space_id=? AND visibility='public' ORDER BY created_at DESC").bind(spaceId).all();
  const agentCard = space.card_id ? await database.prepare("SELECT body_json, signature_json, key_id, issued_at FROM agent_cards WHERE id=? AND status='active'").bind(space.card_id).first<{ body_json: string; signature_json: string; key_id: string; issued_at: string }>() : null;
  return { ...space, cards: cards.results, agentCard: agentCard ? { ...agentCard, body: JSON.parse(agentCard.body_json) } : null };
}

export async function issuerJwks() {
  const currentIssuer = await issuer();
  return { keys: [{ ...currentIssuer.publicJwk, kid: currentIssuer.keyId, use: "sig", alg: "ES256" }] };
}

export async function refreshSpaceAgentCard(request: Request, spaceId: string) {
  const database = db();
  const space = await getSpace(request, spaceId);
  if (!database || !space) return null;
  return reissueAgentCard(database, space, new URL(request.url).origin, "agent_card.refreshed");
}

export async function currentCardSpace(request: Request) {
  const database = db();
  const currentSession = await sessionForRequest(request);
  if (!database || !currentSession) return null;
  const preferred = currentSession.activeSpaceId
    ? await getSpace(request, currentSession.activeSpaceId)
    : null;
  if (preferred) return preferred;
  const spaces = await listSpaces(request);
  if (!spaces[0]) return null;
  await database.prepare("UPDATE sessions SET active_space_id=? WHERE token_hash=?").bind(spaces[0].id, currentSession.tokenHash).run();
  return getSpace(request, spaces[0].id);
}

export async function seedExistingEventsForCurrentAgent(request: Request) {
  const space = await currentCardSpace(request);
  return space
    ? { authenticated: true, seeded: false, space }
    : { authenticated: false, seeded: false, space: null };
}

export async function listEventCards(request: Request, spaceId: string) {
  const database = db();
  const space = await getSpace(request, spaceId) ?? await getPublicSpace(spaceId);
  if (!database || !space) return null;
  const result = await database.prepare("SELECT id, external_id, source_provider, title, summary, payload_json, visibility, created_at FROM cards WHERE space_id=? AND owner_agent_id=? AND card_type='event' AND visibility='public' ORDER BY created_at DESC").bind(space.id, space.agent_id).all<EventCardRow>();
  return { space, events: result.results.map((row) => ({ ...row, payload: eventPayload(row) })) };
}

export async function getEventCard(request: Request, spaceId: string, slug: string) {
  const database = db();
  const space = await getSpace(request, spaceId) ?? await getPublicSpace(spaceId);
  if (!database || !space) return null;
  const row = await database.prepare("SELECT id, external_id, source_provider, title, summary, payload_json, visibility, created_at FROM cards WHERE space_id=? AND owner_agent_id=? AND card_type='event' AND external_id=? AND visibility='public' LIMIT 1").bind(space.id, space.agent_id, slug).first<EventCardRow>();
  return row ? { space, card: { ...row, payload: eventPayload(row) } } : null;
}

function requiredInput(input: Record<string, unknown>, key: string) {
  const value = clean(input[key]);
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function slugify(value: string) {
  const ascii = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${ascii || "event"}-${Date.now().toString(36)}`;
}

export class CardUpdateError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CardUpdateError";
    this.status = status;
  }
}

export async function createSpaceCard(request: Request, spaceId: string, rawInput: unknown) {
  const database = db();
  const space = await getSpace(request, spaceId);
  if (!database || !space) return null;
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) throw new Error("Invalid card payload");
  const input = rawInput as Record<string, unknown>;
  const cardType = requiredInput(input, "card_type");
  const title = requiredInput(input, "title");
  const summary = clean(input.summary);
  const sourceProvider = clean(input.source_provider) || "agent-skill";
  const externalId = clean(input.external_id) || randomId("ext_");
  const visibility = clean(input.visibility) === "private" ? "private" : "public";
  const payload = input.payload && typeof input.payload === "object" && !Array.isArray(input.payload) ? input.payload : {};
  const now = new Date().toISOString();
  const cardId = randomId("card_");
  await database.batch([
    database.prepare(`INSERT INTO cards
      (id, space_id, owner_agent_id, source_provider, source_connection_id, external_id, card_type, title, summary, payload_json, created_at, updated_at, visibility)
      VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(cardId, space.id, space.agent_id, sourceProvider, externalId, cardType, title, summary || null, JSON.stringify(payload), now, now, visibility),
    database.prepare("INSERT INTO audit_events (id, user_id, agent_id, space_id, action, created_at, metadata_json) VALUES (?, ?, ?, ?, 'card.created', ?, ?)").bind(randomId("aud_"), space.owner_user_id, space.agent_id, space.id, now, JSON.stringify({ cardId, cardType, sourceProvider, externalId, via: "card-space-add-card" }))
  ]);
  return { id: cardId, spaceId: space.id, ownerAgentId: space.agent_id, sourceProvider, externalId, cardType, title, summary, payload, visibility, createdAt: now };
}

export async function updateSpaceCardByAgent(
  spaceId: string,
  cardId: string,
  actorAgentId: string,
  expectedVersion: number,
  rawInput: unknown
) {
  const database = db();
  if (!database) throw new CardUpdateError(503, "Card Space D1 is unavailable.");
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new CardUpdateError(428, "A valid If-Match card version is required.");
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) throw new CardUpdateError(400, "Invalid Card update payload.");
  const input = rawInput as Record<string, unknown>;
  const allowedFields = new Set(["title", "summary", "visibility", "presentation"]);
  const unknownField = Object.keys(input).find((key) => !allowedFields.has(key));
  if (unknownField) throw new CardUpdateError(400, `${unknownField} is not an editable Card presentation field.`);
  const card = await database.prepare(`SELECT id, space_id, owner_agent_id, source_provider, external_id, card_type, title, summary, payload_json, visibility, version
    FROM cards WHERE id=? AND space_id=? LIMIT 1`).bind(cardId, spaceId).first<{
      id: string; space_id: string; owner_agent_id: string; source_provider: string; external_id: string; card_type: string | null;
      title: string; summary: string | null; payload_json: string; visibility: string; version: number;
    }>();
  if (!card) throw new CardUpdateError(404, "Card not found.");
  if (card.owner_agent_id !== actorAgentId) throw new CardUpdateError(403, "This Agent Card does not own the target Card.");
  if (card.card_type === "agent_identity") throw new CardUpdateError(409, "The Agent identity Card cannot be modified through the Card update Skill.");
  if (card.version !== expectedVersion) throw new CardUpdateError(412, `Card version changed; current version is ${card.version}.`);

  const hasTitle = Object.prototype.hasOwnProperty.call(input, "title");
  const hasSummary = Object.prototype.hasOwnProperty.call(input, "summary");
  const hasVisibility = Object.prototype.hasOwnProperty.call(input, "visibility");
  const hasPresentation = Object.prototype.hasOwnProperty.call(input, "presentation");
  if (!hasTitle && !hasSummary && !hasVisibility && !hasPresentation) throw new CardUpdateError(400, "Provide title, summary, visibility, or presentation.");
  const title = hasTitle ? clean(input.title) : card.title;
  if (!title || title.length > 500) throw new CardUpdateError(400, "title must contain 1 to 500 characters.");
  const summary = hasSummary ? clean(input.summary) : card.summary ?? "";
  if (summary.length > 8_000) throw new CardUpdateError(400, "summary must not exceed 8000 characters.");
  const visibility = hasVisibility ? clean(input.visibility) : card.visibility;
  if (!["public", "private"].includes(visibility)) throw new CardUpdateError(400, "visibility must be public or private.");
  let payload: JsonObject;
  try { payload = JSON.parse(card.payload_json) as JsonObject; } catch { payload = {}; }
  if (hasPresentation) {
    if (input.presentation === null) {
      delete payload.presentation;
    } else {
      if (!input.presentation || typeof input.presentation !== "object" || Array.isArray(input.presentation)) throw new CardUpdateError(400, "presentation must be an object or null.");
      const serializedPresentation = JSON.stringify(input.presentation);
      if (serializedPresentation.length > 16_000) throw new CardUpdateError(400, "presentation must not exceed 16000 bytes.");
      payload.presentation = input.presentation;
    }
  }
  if (card.card_type === "event" && hasTitle) payload.title = title;
  if (card.card_type === "event" && hasSummary) payload.about = summary ? [summary] : [];

  const now = new Date().toISOString();
  const nextVersion = card.version + 1;
  const patchRecord = {
    ...(hasTitle ? { title } : {}),
    ...(hasSummary ? { summary } : {}),
    ...(hasVisibility ? { visibility } : {}),
    ...(hasPresentation ? { presentation: input.presentation } : {})
  };
  const previousRecord = { title: card.title, summary: card.summary, visibility: card.visibility, payload: JSON.parse(card.payload_json), version: card.version };
  const resultRecord = { title, summary: summary || null, visibility, payload, version: nextVersion };
  const statements: D1PreparedStatement[] = [
    database.prepare("UPDATE cards SET title=?, summary=?, visibility=?, payload_json=?, version=version+1, updated_at=? WHERE id=? AND space_id=? AND owner_agent_id=? AND version=?")
      .bind(title, summary || null, visibility, JSON.stringify(payload), now, card.id, spaceId, actorAgentId, expectedVersion),
    database.prepare("INSERT INTO card_revisions (id, card_id, space_id, actor_agent_id, version, patch_json, previous_json, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(randomId("rev_"), card.id, spaceId, actorAgentId, nextVersion, JSON.stringify(patchRecord), JSON.stringify(previousRecord), JSON.stringify(resultRecord), now)
  ];

  let pairedEventId: string | null = null;
  if (card.source_provider === "zhihu") {
    const pairedExternalId = card.external_id.startsWith("zhihu:")
      ? `zhihu-${card.external_id.split(":").at(-1) ?? ""}`
      : card.card_type === "topic" && card.external_id.startsWith("zhihu-topic-") ? card.external_id : "";
    const paired = pairedExternalId ? await database.prepare("SELECT id, title, summary, payload_json, visibility, version FROM cards WHERE space_id=? AND owner_agent_id=? AND source_provider='zhihu-event' AND external_id=? AND card_type='event' LIMIT 1")
      .bind(spaceId, actorAgentId, pairedExternalId).first<{ id: string; title: string; summary: string | null; payload_json: string; visibility: string; version: number }>() : null;
    if (paired) {
      let pairedPayload: JsonObject;
      try { pairedPayload = JSON.parse(paired.payload_json) as JsonObject; } catch { pairedPayload = {}; }
      if (hasTitle) pairedPayload.title = title;
      if (hasSummary) pairedPayload.about = summary ? [summary] : [];
      if (hasPresentation) {
        if (input.presentation === null) delete pairedPayload.presentation;
        else pairedPayload.presentation = input.presentation;
      }
      const pairedNextVersion = paired.version + 1;
      const pairedPrevious = { title: paired.title, summary: paired.summary, visibility: paired.visibility, payload: JSON.parse(paired.payload_json), version: paired.version };
      const pairedResult = { title, summary: summary || null, visibility, payload: pairedPayload, version: pairedNextVersion };
      statements.push(
        database.prepare("UPDATE cards SET title=?, summary=?, visibility=?, payload_json=?, version=version+1, updated_at=? WHERE id=? AND space_id=? AND owner_agent_id=? AND version=?")
          .bind(title, summary || null, visibility, JSON.stringify(pairedPayload), now, paired.id, spaceId, actorAgentId, paired.version),
        database.prepare("INSERT INTO card_revisions (id, card_id, space_id, actor_agent_id, version, patch_json, previous_json, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(randomId("rev_"), paired.id, spaceId, actorAgentId, pairedNextVersion, JSON.stringify({ ...patchRecord, derivedFrom: card.id }), JSON.stringify(pairedPrevious), JSON.stringify(pairedResult), now)
      );
      pairedEventId = paired.id;
    }
  }
  statements.push(database.prepare("INSERT INTO audit_events (id, user_id, agent_id, space_id, action, created_at, metadata_json) SELECT ?, owner_user_id, ?, ?, 'card.updated_by_agent', ?, ? FROM card_spaces WHERE id=? AND agent_id=?")
    .bind(randomId("aud_"), actorAgentId, spaceId, now, JSON.stringify({ cardId: card.id, version: nextVersion, pairedEventId, fields: Object.keys(patchRecord), via: "card-space-update-card" }), spaceId, actorAgentId));
  await database.batch(statements);
  return { id: card.id, spaceId, version: nextVersion, title, summary: summary || null, visibility, presentation: payload.presentation ?? null, pairedEventId };
}

export async function getSpaceCardByAgent(spaceId: string, cardId: string, actorAgentId: string) {
  const database = db();
  if (!database) throw new CardUpdateError(503, "Card Space D1 is unavailable.");
  const card = await database.prepare(`SELECT id, space_id, owner_agent_id, source_provider, external_id, card_type, title, summary, payload_json, visibility, version, created_at, updated_at
    FROM cards WHERE id=? AND space_id=? AND owner_agent_id=? LIMIT 1`).bind(cardId, spaceId, actorAgentId).first<{
      id: string; space_id: string; owner_agent_id: string; source_provider: string; external_id: string; card_type: string | null;
      title: string; summary: string | null; payload_json: string; visibility: string; version: number; created_at: string; updated_at: string;
    }>();
  if (!card) throw new CardUpdateError(404, "Card not found.");
  return {
    id: card.id,
    spaceId: card.space_id,
    ownerAgentId: card.owner_agent_id,
    sourceProvider: card.source_provider,
    externalId: card.external_id,
    cardType: card.card_type,
    title: card.title,
    summary: card.summary,
    payload: JSON.parse(card.payload_json),
    visibility: card.visibility,
    version: card.version,
    createdAt: card.created_at,
    updatedAt: card.updated_at
  };
}

export async function deleteSpaceCard(request: Request, spaceId: string, cardId: string) {
  const database = db();
  const space = await getSpace(request, spaceId);
  if (!database || !space) return null;
  const card = await database.prepare("SELECT id, card_type, title, external_id FROM cards WHERE id=? AND space_id=? AND owner_agent_id=?").bind(cardId, space.id, space.agent_id).first<{ id: string; card_type: string | null; title: string; external_id: string }>();
  if (!card) return { deleted: false, reason: "not_found" };
  if (card.card_type === "agent_identity") return { deleted: false, reason: "protected_agent_identity" };
  const now = new Date().toISOString();
  await database.batch([
    database.prepare("DELETE FROM cards WHERE id=? AND space_id=? AND owner_agent_id=?").bind(card.id, space.id, space.agent_id),
    database.prepare("INSERT INTO audit_events (id, user_id, agent_id, space_id, action, created_at, metadata_json) VALUES (?, ?, ?, ?, 'card.deleted', ?, ?)").bind(randomId("aud_"), space.owner_user_id, space.agent_id, space.id, now, JSON.stringify({ cardId: card.id, cardType: card.card_type, externalId: card.external_id, via: "card-space-delete-card" }))
  ]);
  return { deleted: true, id: card.id, cardType: card.card_type, title: card.title };
}

async function systemOwnerSpace(request: Request) {
  const current = await currentCardSpace(request);
  if (current) return current;
  const database = db();
  if (!database) return null;
  const state = await database.prepare("SELECT value FROM system_state WHERE key='initial_event_owner_agent_id'").first<{ value: string }>();
  if (!state) return null;
  return database.prepare(`SELECT s.id, s.owner_user_id, s.name, s.provider, s.status, s.created_at, s.agent_id, p.auth_mode,
    p.id AS connection_id, p.connected_at, p.verified_at, p.credential_fingerprint, ac.id AS card_id, ac.version AS card_version, ac.issued_at AS card_issued_at
    FROM card_spaces s JOIN provider_connections p ON p.space_id=s.id
    LEFT JOIN agent_cards ac ON ac.agent_id=s.agent_id AND ac.status='active'
    WHERE s.agent_id=? AND s.status='active' AND p.status='active' ORDER BY ac.version DESC LIMIT 1`).bind(state.value).first<SpaceRow>();
}

export async function createD1Event(request: Request, rawInput: unknown) {
  const database = db();
  const space = await systemOwnerSpace(request);
  if (!database || !space) throw new Error("No active Agent Card space is available");
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) throw new Error("Invalid event payload");
  const input = rawInput as Record<string, unknown>;
  const title = requiredInput(input, "title");
  const category = requiredInput(input, "category");
  const host = requiredInput(input, "host");
  const venue = requiredInput(input, "venue");
  const locationAddress = requiredInput(input, "locationAddress");
  const date = requiredInput(input, "date");
  const time = requiredInput(input, "time");
  const priceLabel = requiredInput(input, "priceLabel");
  const statusLabel = requiredInput(input, "statusLabel");
  const aboutText = requiredInput(input, "about");
  const slug = slugify(title);
  const now = new Date().toISOString();
  const cardId = randomId("card_");
  const event = {
    slug, title, category, host, venue, locationName: venue, locationAddress, date, time,
    priceLabel, statusLabel, attendeeCount: 0, presentedBy: host,
    presentedByDescription: `${host} submitted this event.`, hosts: [host], attendees: 0,
    attendeeNames: "", registrationStatus: "Registration",
    registrationNote: "提交报名后，报名信息会保存在该 Agent Card 的 D1 空间。",
    registrationAction: "加入活动", contactLabel: "联系活动者", about: [aboutText],
    sections: [{ title: "活动介绍", body: aboutText }],
    subscribeFields: ["name", "email", "wechat", "phone", "role", "company", "note"],
    submittedAt: now, sourceId: "d1", sourceLabel: "D1 Card Space"
  };
  await database.batch([
    database.prepare(`INSERT INTO cards
      (id, space_id, owner_agent_id, source_provider, source_connection_id, external_id, card_type, title, summary, payload_json, created_at, updated_at, visibility)
      VALUES (?, ?, ?, 'd1', NULL, ?, 'event', ?, ?, ?, ?, ?, 'public')`).bind(cardId, space.id, space.agent_id, slug, title, `${date} · ${time} · ${venue}`, JSON.stringify(event), now, now),
    database.prepare("INSERT INTO audit_events (id, user_id, agent_id, space_id, action, created_at, metadata_json) VALUES (?, ?, ?, ?, 'event.created', ?, ?)").bind(randomId("aud_"), space.owner_user_id, space.agent_id, space.id, now, JSON.stringify({ cardId, slug }))
  ]);
  return { ...event, cardId, spaceId: space.id, ownerAgentId: space.agent_id };
}

export async function deleteD1Event(request: Request, slug: string) {
  const database = db();
  const space = await systemOwnerSpace(request);
  if (!database || !space) return { deleted: false, storage: "d1" };
  const row = await database.prepare("SELECT id FROM cards WHERE space_id=? AND owner_agent_id=? AND card_type='event' AND external_id=?").bind(space.id, space.agent_id, slug).first<{ id: string }>();
  if (!row) return { deleted: false, storage: "d1" };
  await database.batch([
    database.prepare("DELETE FROM cards WHERE id=? AND space_id=?").bind(row.id, space.id),
    database.prepare("INSERT INTO audit_events (id, user_id, agent_id, space_id, action, created_at, metadata_json) VALUES (?, ?, ?, ?, 'event.deleted', ?, ?)").bind(randomId("aud_"), space.owner_user_id, space.agent_id, space.id, new Date().toISOString(), JSON.stringify({ cardId: row.id, slug }))
  ]);
  return { deleted: true, storage: "d1" };
}

export async function listCurrentD1Events(request: Request) {
  const space = await currentCardSpace(request);
  if (!space) return null;
  return listEventCards(request, space.id);
}

export async function listD1Subscriptions(request: Request, eventSlug?: string | null) {
  const database = db();
  const space = await currentCardSpace(request);
  if (!database || !space) return null;
  const query = eventSlug
    ? database.prepare("SELECT * FROM event_subscriptions WHERE space_id=? AND event_slug=? ORDER BY joined_at DESC").bind(space.id, eventSlug)
    : database.prepare("SELECT * FROM event_subscriptions WHERE space_id=? ORDER BY joined_at DESC").bind(space.id);
  return (await query.all()).results;
}

export async function saveD1Subscription(request: Request, rawInput: unknown) {
  const database = db();
  const space = await currentCardSpace(request);
  if (!database || !space) throw new Error("请先认领 Agent Card");
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) throw new Error("Invalid subscription payload");
  const input = rawInput as Record<string, unknown>;
  const eventSlug = requiredInput(input, "event_slug");
  const name = requiredInput(input, "name");
  const email = requiredInput(input, "email").toLowerCase();
  const role = requiredInput(input, "role");
  const eventCard = await database.prepare("SELECT id FROM cards WHERE space_id=? AND card_type='event' AND external_id=?").bind(space.id, eventSlug).first<{ id: string }>();
  if (!eventCard) throw new Error("活动不存在或不属于当前空间");
  const now = new Date().toISOString();
  const currentSession = await sessionForRequest(request);
  const record = {
    event_slug: eventSlug, event_title: clean(input.event_title), event_date: clean(input.event_date),
    event_time: clean(input.event_time), event_venue: clean(input.event_venue), event_category: clean(input.event_category),
    name, email, wechat: clean(input.wechat), phone: clean(input.phone), role, company: clean(input.company),
    note: clean(input.note), subscribe_updates: input.subscribe_updates === true, joined_at: now
  };
  await database.prepare(`INSERT INTO event_subscriptions
    (id, space_id, event_card_id, user_id, event_slug, name, email, wechat, phone, role, company, note, subscribe_updates, joined_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(event_card_id, email) DO UPDATE SET name=excluded.name, wechat=excluded.wechat, phone=excluded.phone, role=excluded.role, company=excluded.company, note=excluded.note, subscribe_updates=excluded.subscribe_updates, updated_at=excluded.updated_at`).bind(
      randomId("sub_"), space.id, eventCard.id, currentSession?.userId ?? null, eventSlug, name, email,
      record.wechat || null, record.phone || null, role, record.company || null, record.note || null,
      record.subscribe_updates ? 1 : 0, now, now
    ).run();
  return record;
}
