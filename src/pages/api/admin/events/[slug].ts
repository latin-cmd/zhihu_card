import type { APIRoute } from "astro";
import {
  deleteSubmittedEvent,
  isStaticEventSlug
} from "../../../../lib/activity-store";
import { env } from "cloudflare:workers";

export const prerender = false;

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

export const DELETE: APIRoute = async ({ params, request }) => {
  const token = (env as Env).BACKOFFICE_API_TOKEN;
  if (!token) {
    return Response.json(
      { error: "BACKOFFICE_API_TOKEN is not configured" },
      { status: 503 }
    );
  }

  if (bearerToken(request) !== token) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slug = params.slug?.trim();
  if (!slug) {
    return Response.json({ error: "Missing event slug" }, { status: 400 });
  }

  if (isStaticEventSlug(slug)) {
    return Response.json(
      { error: "Static mock events must be removed from source code" },
      { status: 409 }
    );
  }

  try {
    const result = await deleteSubmittedEvent(slug);
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
