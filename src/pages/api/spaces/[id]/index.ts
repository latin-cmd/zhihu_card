import type { APIRoute } from "astro";
import { getPublicSpace } from "../../../../lib/card-space-store";

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  const space = await getPublicSpace(params.id ?? "");
  if (!space) return Response.json({ error: "Public Card Space not found" }, { status: 404 });
  const origin = url.hostname === "community.crito.top" ? "https://community.crito.top" : url.origin;
  const skills = [
    { id: "claim-agent-card", manifest: `${origin}/api/skills/claim-agent-card`, endpoint: `${origin}/api/agent-cards/claim` },
    { id: "card-space-add-card", manifest: `${origin}/api/skills/card-space-add-card`, endpoint: `${origin}/api/spaces/${space.id}/cards` },
    { id: "card-space-update-card", manifest: `${origin}/api/skills/card-space-update-card`, endpoint: `${origin}/api/spaces/${space.id}/cards/{cardId}` },
    { id: "card-space-delete-card", manifest: `${origin}/api/skills/card-space-delete-card`, endpoint: `${origin}/api/spaces/${space.id}/cards/{cardId}` },
    { id: "zhihu-credential-to-card-events", manifest: `${origin}/api/skills/zhihu-credential-to-card-events`, endpoint: `${origin}/api/spaces/${space.id}/cards` }
  ];
  return Response.json({
    protocolVersion: "0.3.0",
    id: space.id,
    name: space.name,
    provider: space.provider,
    agentId: space.agent_id,
    visibility: space.visibility,
    credential: {
      type: "AgentCard",
      id: space.card_id,
      url: `${origin}/api/spaces/${space.id}/agent-card`,
      keyId: space.agentCard?.key_id ?? null
    },
    skills,
    cards: space.cards
  }, { headers: { "Cache-Control": "public, max-age=60" } });
};
