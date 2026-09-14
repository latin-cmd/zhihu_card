import type { APIRoute } from "astro";
import { currentCardSpace, listD1Subscriptions, saveD1Subscription } from "../../lib/card-space-store";

export const prerender = false;

export const GET: APIRoute = async ({ url, request }) => {
  const eventSlug = url.searchParams.get("event_slug");
  const records = await listD1Subscriptions(request, eventSlug);
  return Response.json({ subscriptions: records ?? [] }, { status: records ? 200 : 401, headers: { "Cache-Control": "no-store" } });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    if (!await currentCardSpace(request)) return Response.json({ error: "请先认领 Agent Card" }, { status: 401 });
    const input = await request.json();
    const record = await saveD1Subscription(request, input);
    return Response.json({ subscription: record }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid subscription payload" },
      { status: 400 }
    );
  }
};
