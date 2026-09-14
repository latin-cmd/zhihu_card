const zhihuContentsEndpoint = "https://developer.zhihu.com/api/v1/user/contents";
const maxItemsPerClaim = 20;

type JsonRecord = Record<string, unknown>;

interface ZhihuContentItem {
  ContentType?: unknown;
  Url?: unknown;
  CreatedAt?: unknown;
  LikeCount?: unknown;
  CommentCount?: unknown;
  FavoriteCount?: unknown;
  Title?: unknown;
  Summary?: unknown;
}

interface SyncContext {
  database: D1Database;
  accessSecret: string;
  userId: string;
  agentId: string;
  spaceId: string;
  connectionId: string;
}

export interface ZhihuCardSyncResult {
  ok: true;
  fetched: number;
  sourceCardsCreated: number;
  eventCardsCreated: number;
  skipped: number;
}

export class ZhihuCardSyncError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ZhihuCardSyncError";
    this.code = code;
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function count(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : 0;
}

function randomId(prefix: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `${prefix}${btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "")}`;
}

function contentId(contentType: string, value: string) {
  let url: URL;
  try { url = new URL(value); } catch { return ""; }
  if (url.protocol !== "https:" || !/(^|\.)zhihu\.com$/i.test(url.hostname)) return "";
  const patterns: Record<string, RegExp> = {
    answer: /\/answer\/([^/]+)/i,
    article: /\/p\/([^/]+)/i,
    zvideo: /\/zvideo\/([^/]+)/i,
    pin: /\/pin\/([^/]+)/i,
    question: /\/question\/([^/]+)/i
  };
  const match = url.pathname.match(patterns[contentType] ?? /\/([^/]+)\/?$/);
  return match?.[1]?.replace(/[^a-zA-Z0-9_-]/g, "") ?? "";
}

function isoDate(value: unknown) {
  const seconds = count(value);
  if (!seconds) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function candidate(item: ZhihuContentItem) {
  const contentType = clean(item.ContentType).toLowerCase();
  const sourceUrl = clean(item.Url);
  const id = contentId(contentType, sourceUrl);
  if (!id || !["answer", "article", "zvideo", "pin", "question"].includes(contentType)) return null;
  const title = clean(item.Title) || `知乎${contentType}`;
  const summary = clean(item.Summary);
  const createdAt = isoDate(item.CreatedAt);
  const metrics = {
    likeCount: count(item.LikeCount),
    commentCount: count(item.CommentCount),
    favoriteCount: count(item.FavoriteCount)
  };
  const sourceExternalId = `zhihu:${contentType}:${id}`;
  const eventExternalId = `zhihu-${id}`;
  return {
    contentType, sourceUrl, title, summary, createdAt, metrics, sourceExternalId, eventExternalId,
    sourcePayload: { source: "zhihu", contentType, url: sourceUrl, createdAt, metrics },
    eventPayload: {
      slug: eventExternalId,
      cardKind: "zhihu_content",
      contentType,
      sourceUrl,
      title,
      summary,
      sourceLabel: "知乎创作",
      category: contentType,
      host: "知乎创作",
      venue: "知乎",
      locationName: "知乎",
      locationAddress: sourceUrl,
      date: createdAt ? createdAt.slice(0, 10) : "知乎创作",
      time: "详情",
      statusLabel: "内容 Card",
      about: summary ? [summary] : [],
      sections: []
    }
  };
}

async function fetchOwnerContents(accessSecret: string) {
  const url = new URL(zhihuContentsEndpoint);
  url.searchParams.set("ContentType", "all");
  url.searchParams.set("Limit", String(maxItemsPerClaim));
  url.searchParams.set("Offset", "0");
  url.searchParams.set("SortField", "ts");
  url.searchParams.set("SortOrder", "desc");

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessSecret}`,
        "Content-Type": "application/json",
        "X-Request-Timestamp": Math.floor(Date.now() / 1000).toString()
      },
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    throw new ZhihuCardSyncError("network_error", "暂时无法读取知乎创作。");
  }

  let payload: JsonRecord | null = null;
  try { payload = await response.json() as JsonRecord; } catch { /* handled below */ }
  const apiCode = typeof payload?.Code === "number" ? payload.Code : null;
  if (response.status === 429 || apiCode === 30001) throw new ZhihuCardSyncError("rate_limited", "知乎接口请求频率过高。");
  if (apiCode === 30002) throw new ZhihuCardSyncError("quota_exhausted", "知乎开放 API 额度不足。");
  if (response.status === 401 || response.status === 403 || apiCode === 20001) throw new ZhihuCardSyncError("unauthorized", "知乎凭证无权读取本人创作。");
  if (!response.ok || apiCode !== 0 || !payload) throw new ZhihuCardSyncError("api_error", "知乎创作接口返回异常。");
  const data = payload.Data && typeof payload.Data === "object" && !Array.isArray(payload.Data) ? payload.Data as JsonRecord : null;
  if (!data || !Array.isArray(data.Items)) throw new ZhihuCardSyncError("invalid_response", "知乎创作接口响应格式异常。");
  return (data.Items as ZhihuContentItem[]).slice(0, maxItemsPerClaim);
}

export async function syncZhihuCredentialCards(context: SyncContext): Promise<ZhihuCardSyncResult> {
  const items = await fetchOwnerContents(context.accessSecret);
  const candidates = items.map(candidate).filter((item): item is NonNullable<ReturnType<typeof candidate>> => Boolean(item));
  const existingRows = await context.database.prepare(
    "SELECT source_provider, external_id FROM cards WHERE space_id=? AND source_provider IN ('zhihu', 'zhihu-event')"
  ).bind(context.spaceId).all<{ source_provider: string; external_id: string }>();
  const existing = new Set(existingRows.results.map((row) => `${row.source_provider}\u0000${row.external_id}`));
  const now = new Date().toISOString();
  const statements: D1PreparedStatement[] = [];
  let sourceCardsCreated = 0;
  let eventCardsCreated = 0;

  for (const item of candidates) {
    const sourceKey = `zhihu\u0000${item.sourceExternalId}`;
    if (!existing.has(sourceKey)) {
      statements.push(context.database.prepare(`INSERT OR IGNORE INTO cards
        (id, space_id, owner_agent_id, source_provider, source_connection_id, external_id, card_type, title, summary, payload_json, created_at, updated_at, visibility)
        VALUES (?, ?, ?, 'zhihu', ?, ?, 'zhihu_content', ?, ?, ?, ?, ?, 'public')`).bind(
          randomId("card_"), context.spaceId, context.agentId, context.connectionId, item.sourceExternalId,
          item.title, item.summary || null, JSON.stringify(item.sourcePayload), now, now
        ));
      existing.add(sourceKey);
      sourceCardsCreated += 1;
    }

    const eventKey = `zhihu-event\u0000${item.eventExternalId}`;
    if (!existing.has(eventKey)) {
      statements.push(context.database.prepare(`INSERT OR IGNORE INTO cards
        (id, space_id, owner_agent_id, source_provider, source_connection_id, external_id, card_type, title, summary, payload_json, created_at, updated_at, visibility)
        VALUES (?, ?, ?, 'zhihu-event', ?, ?, 'event', ?, ?, ?, ?, ?, 'public')`).bind(
          randomId("card_"), context.spaceId, context.agentId, context.connectionId, item.eventExternalId,
          item.title, item.summary || null, JSON.stringify(item.eventPayload), now, now
        ));
      existing.add(eventKey);
      eventCardsCreated += 1;
    }
  }

  const skipped = candidates.length * 2 - sourceCardsCreated - eventCardsCreated;
  statements.push(context.database.prepare(
    "INSERT INTO audit_events (id, user_id, agent_id, space_id, action, created_at, metadata_json) VALUES (?, ?, ?, ?, 'zhihu.cards.synced', ?, ?)"
  ).bind(randomId("aud_"), context.userId, context.agentId, context.spaceId, now, JSON.stringify({
    fetched: items.length,
    accepted: candidates.length,
    sourceCardsCreated,
    eventCardsCreated,
    skipped,
    limit: maxItemsPerClaim,
    via: "zhihu-credential-to-card-events"
  })));
  await context.database.batch(statements);
  return { ok: true, fetched: items.length, sourceCardsCreated, eventCardsCreated, skipped };
}
