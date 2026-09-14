#!/usr/bin/env node

import { mkdir, open } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] ?? "";
}

function base64UrlToBytes(value) {
  return Buffer.from(value, "base64url");
}

function canonicalJson(value) {
  if (value === null || ["boolean", "number", "string"].includes(typeof value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  throw new TypeError("Unsupported Agent Card JSON value.");
}

async function readSecret() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").trim();
}

async function verifyIssuedCard(origin, result, publicJwk) {
  const response = await fetch(`${origin}/api/spaces/${encodeURIComponent(result.spaceId)}/agent-card`, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Unable to read issued Agent Card (${response.status}).`);
  const card = await response.json();
  const extension = card.extensions?.find((item) => item?.uri === "urn:crito:agent-request-signature:v1");
  if (extension?.params?.keyId !== result.agentKeyId || extension?.params?.publicJwk?.x !== publicJwk.x || extension?.params?.publicJwk?.y !== publicJwk.y) {
    throw new Error("Issued Agent Card does not contain the generated public key.");
  }
  const signature = card.signatures?.[0];
  if (!signature?.protected || !signature?.signature) throw new Error("Issued Agent Card has no issuer signature.");
  const protectedHeader = JSON.parse(base64UrlToBytes(signature.protected).toString("utf8"));
  const jwksResponse = await fetch(`${origin}/api/agent-card-issuer/jwks.json`, { headers: { Accept: "application/json" } });
  if (!jwksResponse.ok) throw new Error("Unable to read the local issuer JWKS.");
  const jwks = await jwksResponse.json();
  const issuerJwk = jwks.keys?.find((key) => key.kid === protectedHeader.kid);
  if (!issuerJwk) throw new Error("Agent Card issuer key was not found.");
  const unsignedCard = { ...card };
  delete unsignedCard.signatures;
  const signingInput = `${signature.protected}.${Buffer.from(canonicalJson(unsignedCard)).toString("base64url")}`;
  const issuerKey = await crypto.subtle.importKey("jwk", issuerJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, issuerKey, base64UrlToBytes(signature.signature), Buffer.from(signingInput));
  if (!verified) throw new Error("Agent Card issuer signature verification failed.");
  return card;
}

const originInput = argument("--origin");
const outputInput = argument("--out");
if (!originInput || !outputInput) throw new Error("Usage: generate-key-and-claim.mjs --origin <https-origin> --out <absolute-private-credential-path>");
const originUrl = new URL(originInput);
if (!['https:', 'http:'].includes(originUrl.protocol) || (originUrl.protocol === 'http:' && !['127.0.0.1', 'localhost'].includes(originUrl.hostname))) {
  throw new Error("The claim origin must use HTTPS, except localhost development.");
}
const origin = originUrl.origin;
if (!isAbsolute(outputInput)) throw new Error("--out must be an absolute path.");
const outputPath = resolve(outputInput);
const accessSecret = await readSecret();
if (!accessSecret || accessSecret.length > 4096) throw new Error("A Zhihu Access Secret must be supplied through stdin.");

const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
const response = await fetch(`${origin}/api/agent-cards/claim`, {
  method: "POST",
  headers: { Accept: "application/json", "Content-Type": "application/json" },
  body: JSON.stringify({ provider: "zhihu", proof: { accessSecret }, agentPublicKey: publicJwk })
});
const result = await response.json();
if (!response.ok) throw new Error(result.error || `Agent Card claim failed (${response.status}).`);
await verifyIssuedCard(origin, result, publicJwk);

const credential = {
  version: 1,
  algorithm: "ES256",
  origin,
  agentCardId: result.agentCardId,
  agentKeyId: result.agentKeyId,
  agentId: result.agentId,
  spaceId: result.spaceId,
  publicJwk,
  privateJwk,
  createdAt: new Date().toISOString()
};
await mkdir(dirname(outputPath), { recursive: true, mode: 0o700 });
const file = await open(outputPath, "wx", 0o600);
try { await file.writeFile(`${JSON.stringify(credential, null, 2)}\n`, { encoding: "utf8" }); } finally { await file.close(); }
console.log(JSON.stringify({ ok: true, agentCardId: result.agentCardId, agentKeyId: result.agentKeyId, agentId: result.agentId, spaceId: result.spaceId, credentialPath: outputPath, cardSync: result.cardSync }));
