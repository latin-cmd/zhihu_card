import type { APIRoute } from "astro";
import { completeZhihuOAuth } from "../../../lib/zhihu-oauth";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => completeZhihuOAuth(request);
