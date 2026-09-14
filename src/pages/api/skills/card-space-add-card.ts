import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async () => Response.json({
  id: "card-space-add-card",
  name: "Add Card",
  description: "Add a generic card to a target Card Space. This public Skill is shared by every Space and is not bound to a user.",
  method: "POST",
  endpointTemplate: "/api/spaces/{spaceId}/cards",
  authority: "claimed Agent Card session for the target Space",
  inputSchema: {
    type: "object",
    required: ["card_type", "title"],
    properties: {
      card_type: { type: "string" },
      title: { type: "string" },
      summary: { type: "string" },
      payload: { type: "object" },
      external_id: { type: "string" },
      source_provider: { type: "string", default: "agent-skill" },
      visibility: { type: "string", enum: ["public", "private"], default: "public" }
    }
  }
}, { headers: { "Cache-Control": "public, max-age=3600" } });
