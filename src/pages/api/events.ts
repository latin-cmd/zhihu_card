import type { APIRoute } from "astro";
import { listCurrentD1Events } from "../../lib/card-space-store";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const result = await listCurrentD1Events(request);
  if (!result) return Response.json({ error: "请先认领 Agent Card" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return Response.json({ spaceId: result.space.id, events: result.events.map((row) => ({ ...row.payload, cardId: row.id, visibility: row.visibility })) }, { headers: { "Cache-Control": "no-store" } });
};
