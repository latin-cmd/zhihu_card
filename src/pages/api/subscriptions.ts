import type { APIRoute } from "astro";
import { createAndStoreSubscription, readSubscriptions } from "../../lib/activity-store";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const eventSlug = url.searchParams.get("event_slug");
  const subscriptions = await readSubscriptions();
  const records = eventSlug
    ? subscriptions.filter((record) => record.event_slug === eventSlug)
    : subscriptions;

  return Response.json({ subscriptions: records });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const input = await request.json();
    const record = await createAndStoreSubscription(input);
    return Response.json({ subscription: record }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid subscription payload" },
      { status: 400 }
    );
  }
};
