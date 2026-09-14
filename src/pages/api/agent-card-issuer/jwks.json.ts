import type { APIRoute } from "astro";
import { issuerJwks } from "../../../lib/card-space-store";
export const prerender = false;
export const GET: APIRoute = async () => Response.json(await issuerJwks(), { headers: { "Cache-Control": "public, max-age=3600" } });
