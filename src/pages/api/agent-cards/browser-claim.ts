import type { APIRoute } from "astro";
import { claimBrowserAgent } from "../../../lib/card-space-store";

export const POST: APIRoute = ({ request }) => claimBrowserAgent(request);
