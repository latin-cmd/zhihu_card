import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async () => Response.json({
  id: "claim-agent-card",
  name: "Claim Agent Card",
  description: "Claim or resume an Agent Card with a Zhihu ownership proof and bind an Agent-owned P-256 public key.",
  method: "POST",
  endpoint: "/api/agent-cards/claim",
  authority: "Zhihu Access Secret ownership proof; the Agent private key remains local",
  inputSchema: {
    type: "object",
    required: ["provider", "proof", "agentPublicKey"],
    properties: {
      provider: { const: "zhihu" },
      proof: { type: "object", required: ["accessSecret"], properties: { accessSecret: { type: "string", writeOnly: true } } },
      agentPublicKey: { type: "object", required: ["kty", "crv", "x", "y"], properties: { kty: { const: "EC" }, crv: { const: "P-256" }, x: { type: "string" }, y: { type: "string" } } }
    }
  },
  output: ["agentCardId", "agentKeyId", "spaceId", "visibility", "publicA2aSpace", "cardSync"],
  constraints: [
    "Never submit a private JWK",
    "A repeated credential resumes the same identity",
    "A changed public key revokes the previous active Agent key",
    "Every active Agent Card and its Card Space are always public in the A2A registry"
  ]
}, { headers: { "Cache-Control": "public, max-age=3600" } });
