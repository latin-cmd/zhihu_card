import type { APIRoute } from "astro";
import { listSpaces } from "../../../lib/card-space-store";
export const prerender = false;
export const GET: APIRoute = async ({ request }) => Response.json({ spaces: await listSpaces(request) }, { headers: { "Cache-Control": "no-store" } });
