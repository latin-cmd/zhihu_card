import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

const cacheControl = "public, max-age=31536000, immutable";

function contentType(key: string) {
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

export const GET: APIRoute = async ({ params }) => {
  const key = params.key?.replace(/^\/+/, "");
  const bucket = (env as Env).PUBLIC_ASSETS;

  if (!key) {
    return new Response("Missing R2 object key", { status: 400 });
  }

  if (!bucket) {
    return new Response("PUBLIC_ASSETS R2 binding is not configured", { status: 503 });
  }

  const object = await bucket.get(key);
  if (!object) {
    return new Response("Not found", { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Content-Type", headers.get("Content-Type") || contentType(key));
  headers.set("Cache-Control", cacheControl);
  headers.set("ETag", object.httpEtag);

  return new Response(object.body, { headers });
};
