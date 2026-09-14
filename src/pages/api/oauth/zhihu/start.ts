import type { APIRoute } from "astro";
import { startZhihuOAuth } from "../../../../lib/zhihu-oauth";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => startZhihuOAuth(request);
