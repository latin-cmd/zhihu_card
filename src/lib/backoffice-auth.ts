import { env } from "cloudflare:workers";

function bearerToken(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

export function requireBackofficeAuth(request: Request) {
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

  return null;
}
