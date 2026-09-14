import type { APIRoute } from "astro";
import { getPublicSpace, getSpace } from "../../../../lib/card-space-store";
export const prerender = false;
export const GET: APIRoute = async ({ request, params }) => {
  const spaceId = params.id ?? "";
  const space = await getSpace(request, spaceId) ?? await getPublicSpace(spaceId);
  if (!space?.agentCard) return Response.json({ error: "公开 Card Space 或 Agent Card 不存在。" }, { status: 404 });
  return Response.json(space.agentCard.body, { headers: { "Cache-Control": "public, max-age=60" } });
};
