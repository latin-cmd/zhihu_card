import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async () => Response.json({
  id: "card-space-delete-card",
  name: "Delete Card",
  description: "Delete one non-identity card from a target Card Space. This public Skill is shared by every Space and is not bound to a user.",
  method: "DELETE",
  endpointTemplate: "/api/spaces/{spaceId}/cards/{cardId}",
  authority: "claimed Agent Card session for the target Space",
  constraints: ["The agent_identity root card cannot be deleted."]
}, { headers: { "Cache-Control": "public, max-age=3600" } });
