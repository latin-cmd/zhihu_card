import type { APIRoute } from "astro";
import { createSpaceCard } from "../../../../../lib/card-space-store";

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
  try {
    const card = await createSpaceCard(request, params.id ?? "", await request.json());
    if (!card) return Response.json({ error: "Agent Card authority required" }, { status: 401 });
    return Response.json({ card }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid card payload" }, { status: 400 });
  }
};
