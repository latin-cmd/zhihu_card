import type { APIRoute } from "astro";
import { claimAgentCardWithZhihu } from "../../../lib/zhihu-credential";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => claimAgentCardWithZhihu(request);
