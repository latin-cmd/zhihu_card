import type { APIRoute } from "astro";
import { deleteD1Event } from "../../../../lib/card-space-store";
import { requireBackofficeAuth } from "../../../../lib/backoffice-auth";

export const prerender = false;

export const DELETE: APIRoute = async ({ params, request }) => {
  const authError = requireBackofficeAuth(request);
  if (authError) return authError;

  const slug = params.slug?.trim();
  if (!slug) {
    return Response.json({ error: "Missing event slug" }, { status: 400 });
  }

  try {
    const result = await deleteD1Event(request, slug);
    if (!result.deleted) {
      return Response.json(
        { deleted: false, slug, storage: result.storage },
        { status: 404 }
      );
    }

    return Response.json({ deleted: true, slug, storage: result.storage });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Failed to delete event"
      },
      { status: 500 }
    );
  }
};
