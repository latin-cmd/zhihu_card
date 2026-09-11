import type { APIRoute } from "astro";
import { createAndStoreSubmittedEvent, readSubmittedEvents } from "../../lib/activity-store";

export const prerender = false;

export const GET: APIRoute = async () => {
  const events = await readSubmittedEvents();
  return Response.json({ events });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const input = await request.json();
    const event = await createAndStoreSubmittedEvent(input);
    return Response.json({ event }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid event payload" },
      { status: 400 }
    );
  }
};
