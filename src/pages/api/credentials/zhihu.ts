import type { APIRoute } from "astro";
import {
  deleteZhihuCredential,
  saveZhihuCredential,
  zhihuCredentialStatusResponse
} from "../../../lib/zhihu-credential";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => zhihuCredentialStatusResponse(request);

export const POST: APIRoute = async ({ request }) => saveZhihuCredential(request);

export const DELETE: APIRoute = async ({ request }) => deleteZhihuCredential(request);
