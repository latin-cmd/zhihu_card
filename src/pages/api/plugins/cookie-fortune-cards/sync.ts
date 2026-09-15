import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { currentCardSpace, isSameOrigin } from "../../../../lib/card-space-store";
import { syncCookieFortuneCards } from "../../../../../plugins/cookie-fortune-cards/runtime";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!isSameOrigin(request)) return Response.json({ error: "跨站请求已拒绝。" }, { status: 403 });
  const space = await currentCardSpace(request);
  if (!space) return Response.json({ error: "请先用 Cookie 认领 Agent Card。" }, { status: 401 });
  try {
    const result = await syncCookieFortuneCards({
      database: env.CARD_SPACE_DB,
      userId: space.owner_user_id,
      agentId: space.agent_id,
      spaceId: space.id,
      request,
      input: await request.json()
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("cookie-fortune-cards sync failed", error instanceof Error ? error.message : "unknown_error");
    return Response.json({ error: "Cookie Card 插件暂时无法生成今日内容。" }, { status: 500 });
  }
};
