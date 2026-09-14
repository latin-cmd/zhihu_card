import type { APIRoute } from "astro";
import { refreshSpaceAgentCard } from "../../../../../lib/card-space-store";

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  const card = await refreshSpaceAgentCard(request, params.id ?? "");
  if (!card) return Response.json({ error: "Agent Card authority required" }, { status: 401 });
  return Response.json({ agentCard: card }, { status: 201 });
};
