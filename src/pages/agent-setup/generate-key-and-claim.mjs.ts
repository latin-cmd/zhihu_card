import type { APIRoute } from "astro";
import script from "../../../skills/claim-agent-card/scripts/generate-key-and-claim.mjs?raw";

export const prerender = false;

export const GET: APIRoute = async () => new Response(script, {
  headers: {
    "Content-Type": "text/javascript; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff"
  }
});
