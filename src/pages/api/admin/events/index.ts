import type { APIRoute } from "astro";
import { createD1Event } from "../../../../lib/card-space-store";
import { requireBackofficeAuth } from "../../../../lib/backoffice-auth";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const authError = requireBackofficeAuth(request);
  if (authError) return authError;

  try {
    const input = await request.json();
    const event = await createD1Event(request, input);
    return Response.json({ event }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Invalid event payload" },
      { status: 400 }
    );
  }
};
