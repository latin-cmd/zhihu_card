import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async () => Response.json({
  id: "card-space-update-card",
  name: "Update Card",
  description: "Update local Card presentation with an Agent-signed request while preserving source provenance.",
  method: "PATCH",
  readMethod: "GET",
  endpointTemplate: "/api/spaces/{spaceId}/cards/{cardId}",
  authority: "active Agent Card plus proof-of-possession of its bound P-256 private key",
  requiredHeaders: ["X-Agent-Card-Id", "X-Agent-Key-Id", "X-Agent-Timestamp", "X-Agent-Nonce", "X-Agent-Signature"],
  updateOnlyHeaders: ["If-Match"],
  inputSchema: {
    type: "object",
    properties: {
      title: { type: "string", minLength: 1, maxLength: 500 },
      summary: { type: "string", maxLength: 8000 },
      visibility: { type: "string", enum: ["public", "private"] },
      presentation: { type: ["object", "null"] }
    },
    additionalProperties: false
  },
  constraints: ["Source provenance fields are immutable", "Agent identity Cards are protected", "Zhihu source-card edits synchronize the paired Event detail Card", "If-Match prevents blind overwrites"]
}, { headers: { "Cache-Control": "public, max-age=3600" } });
