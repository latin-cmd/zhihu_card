import {
  logoutCurrentSession,
  isSameOrigin,
  migrateLegacyZhihuCredential,
  readZhihuSpaceStatus,
  saveVerifiedZhihuConnection
} from "./card-space-store";

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function verifyAccessSecret(accessSecret: string) {
  let response: Response;
  try {
    response = await fetch("https://developer.zhihu.com/api/v1/quota", {
      headers: { Accept: "application/json", Authorization: `Bearer ${accessSecret}`, "X-Request-Timestamp": Math.floor(Date.now() / 1000).toString() },
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    return { ok: false as const, status: 502, error: "暂时无法连接知乎开放平台，请稍后重试。" };
  }
  if (response.status === 429) return { ok: false as const, status: 429, error: "知乎开放平台请求频率过高，请稍后重试。" };
  if (response.status >= 500) return { ok: false as const, status: 502, error: "知乎开放平台暂时不可用，请稍后重试。" };
  let payload: { Code?: unknown } | null = null;
  try { payload = await response.json() as { Code?: unknown }; } catch { /* invalid envelope is not valid */ }
  if (!response.ok || payload?.Code !== 0) return { ok: false as const, status: 400, error: "Access Secret 无效或没有开放平台权限。" };
  return { ok: true as const };
}

export async function claimAgentCardWithZhihu(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  let input: { provider?: unknown; proof?: unknown; agentPublicKey?: unknown };
  try { input = await request.json() as typeof input; } catch {
    return Response.json({ error: "请求内容必须是 JSON。" }, { status: 400 });
  }
  if (clean(input.provider) !== "zhihu") return Response.json({ error: "当前只支持使用知乎凭证认领 Agent Card。" }, { status: 400 });
  const proof = input.proof && typeof input.proof === "object" && !Array.isArray(input.proof)
    ? input.proof as Record<string, unknown>
    : {};
  const accessSecret = clean(proof.accessSecret);
  if (!accessSecret || accessSecret.length > 4096) return Response.json({ error: "请输入有效的知乎 Access Secret。" }, { status: 400 });
  if (!input.agentPublicKey || typeof input.agentPublicKey !== "object" || Array.isArray(input.agentPublicKey)) {
    return Response.json({ error: "认领 Agent Card 必须提供 Agent 自己生成的 P-256 公钥。" }, { status: 400 });
  }
  const agentPublicKey = input.agentPublicKey as Record<string, unknown>;
  if ("d" in agentPublicKey || agentPublicKey.kty !== "EC" || agentPublicKey.crv !== "P-256") {
    return Response.json({ error: "只能提交 P-256 公钥；不要提交 Agent 私钥。" }, { status: 400 });
  }
  const verification = await verifyAccessSecret(accessSecret);
  if (!verification.ok) return Response.json({ error: verification.error }, { status: verification.status });
  try {
    return await saveVerifiedZhihuConnection(request, accessSecret, agentPublicKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("agentPublicKey")) return Response.json({ error: message }, { status: 400 });
    return Response.json({ error: "凭证已验证，但 Agent Card 认领服务尚未就绪。" }, { status: 503 });
  }
}

export async function readZhihuCredentialStatus(request: Request) {
  return readZhihuSpaceStatus(request);
}

export async function zhihuCredentialStatusResponse(request: Request) {
  try {
    const migrated = await migrateLegacyZhihuCredential(request);
    const headers = new Headers(migrated.headers);
    headers.set("Cache-Control", "no-store");
    return Response.json(migrated.status, { headers });
  } catch (error) {
    console.error("Zhihu legacy credential migration failed", error);
    return Response.json({ error: "本地凭证迁移失败，请稍后重试。" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

export async function saveZhihuCredential(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  let accessSecret = "";
  try { accessSecret = clean((await request.json() as { accessSecret?: unknown }).accessSecret); } catch { return Response.json({ error: "请求内容必须是 JSON。" }, { status: 400 }); }
  if (!accessSecret || accessSecret.length > 4096) return Response.json({ error: "请输入有效的 Access Secret。" }, { status: 400 });
  const verification = await verifyAccessSecret(accessSecret);
  if (!verification.ok) return Response.json({ error: verification.error }, { status: verification.status });
  try {
    return await saveVerifiedZhihuConnection(request, accessSecret);
  } catch {
    return Response.json({ error: "凭证已验证，但本地 Card Space 尚未就绪。" }, { status: 503 });
  }
}

export async function deleteZhihuCredential(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: "请求来源无效。" }, { status: 403 });
  return logoutCurrentSession(request);
}
