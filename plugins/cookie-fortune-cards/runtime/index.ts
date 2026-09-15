type JsonRecord = Record<string, unknown>;

export interface CookieFortuneContext {
  database: D1Database;
  userId: string;
  agentId: string;
  spaceId: string;
  request: Request;
  input: unknown;
}

const sources = [
  { title: "周易·易经", url: "https://ctext.org/book-of-changes/yi-jing/zh" },
  { title: "礼记·月令", url: "https://ctext.org/liji/yue-ling/zh" },
  { title: "淮南子·天文训", url: "https://ctext.org/huainanzi/tian-wen-xun/zh" }
];

const fortunes = [
  { trigram: "乾", element: "天", guidance: "适合先确定方向，再推进一件最重要的事。" },
  { trigram: "坤", element: "地", guidance: "适合整理、承接与完成，给长期事务多一点耐心。" },
  { trigram: "震", element: "雷", guidance: "变化可能来得突然，先观察，再做小步行动。" },
  { trigram: "巽", element: "风", guidance: "沟通与迭代更有帮助，避免一次性下过重结论。" },
  { trigram: "坎", element: "水", guidance: "复杂事项宜留余量，重要决定多做一次核验。" },
  { trigram: "离", element: "火", guidance: "表达和创作较顺，注意休息并避免过度承诺。" },
  { trigram: "艮", element: "山", guidance: "暂停也是进展，适合收尾、复盘和明确边界。" },
  { trigram: "兑", element: "泽", guidance: "协作氛围较好，真诚交流比独自猜测更有效。" }
];

function clean(value: unknown, max = 64) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function randomId(prefix: string) {
  return `${prefix}${crypto.randomUUID().replaceAll("-", "")}`;
}

function primaryLanguage(value: string) {
  return value.toLowerCase().match(/^[a-z]{2,3}/)?.[0] ?? "und";
}

function coarsePlatform(value: string) {
  const text = value.toLowerCase();
  if (/iphone|ipad|ios/.test(text)) return "iOS/iPadOS";
  if (/android/.test(text)) return "Android";
  if (/windows|win32|win64/.test(text)) return "Windows";
  if (/mac/.test(text)) return "macOS";
  if (/linux|cros/.test(text)) return "Linux/ChromeOS";
  return "Web";
}

function boundedOffset(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(-840, Math.min(840, Math.round(value)))
    : 0;
}

async function digestBytes(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function syncCookieFortuneCards(context: CookieFortuneContext) {
  const input = context.input && typeof context.input === "object" && !Array.isArray(context.input) ? inputRecord(context.input) : {};
  const requestTime = new Date();
  const languageHeader = context.request.headers.get("accept-language")?.split(",")[0] ?? "";
  const language = primaryLanguage(clean(input.language) || languageHeader);
  const hintedPlatform = context.request.headers.get("sec-ch-ua-platform")?.replaceAll('"', "") ?? "";
  const platform = coarsePlatform(clean(input.platform) || hintedPlatform);
  const offsetMinutes = boundedOffset(input.timezoneOffsetMinutes);
  const localTime = new Date(requestTime.getTime() - offsetMinutes * 60_000);
  const localDate = localTime.toISOString().slice(0, 10);
  const localHour = localTime.getUTCHours();
  const seed = await digestBytes(`${context.spaceId}|${localDate}|${language}|${platform}`);
  const fortune = fortunes[seed[0] % fortunes.length];
  const score = 40 + seed[1] % 61;
  const rating = score >= 82 ? "大吉" : score >= 68 ? "吉" : score >= 52 ? "平" : "谨慎";
  const timeHint = localHour < 6 ? "夜深宜静" : localHour < 12 ? "上午宜启" : localHour < 18 ? "午后宜稳" : "晚间宜收";
  const summary = `${rating} · ${fortune.trigram}（${fortune.element}）· ${timeHint}`;
  const now = requestTime.toISOString();
  const privacy = { ipUsed: false, geolocationUsed: false, usernameUsed: false, fullUserAgentStored: false };
  const browserPayload = { cardKind: "browser_context", date: localDate, language, platform, requestTime: now, localHour, privacy, provenance: "browser/request signals supplied during Cookie claim" };
  const contextEventPayload = {
    slug: `browser-context-${localDate}`, cardKind: "browser_context", presentationMode: "content", title: `浏览器环境记录 · ${localDate}`,
    date: localDate, time: `${String(localHour).padStart(2, "0")}:00`, category: "Browser Context", venue: platform,
    locationName: "Cookie Card Space", about: [`主语言：${language}`, `平台类别：${platform}`, "未使用 IP、地理位置、时区名称、用户名或完整 User-Agent。"], sections: []
  };
  const fortunePayload = { cardKind: "daily_fortune", entertainmentOnly: true, date: localDate, rating, score, trigram: fortune.trigram, element: fortune.element, guidance: fortune.guidance, timeHint, context: { language, platform, localHour }, sources };
  const fortuneEventPayload = {
    slug: `daily-fortune-${localDate}`, cardKind: "daily_fortune", presentationMode: "content", title: `今日 Cookie 吉凶 · ${rating}`,
    date: localDate, time: `${String(localHour).padStart(2, "0")}:00`, category: "文化娱乐", venue: "Cookie Card Space",
    locationName: "娱乐占签", about: [summary, fortune.guidance, "本结果由粗粒度浏览器上下文稳定生成，仅供文化娱乐，不预测真实事件。"], sections: [{ title: "参考索引", body: sources.map((source) => source.title).join("、") }]
  };
  const rows = [
    ["cookie-context-plugin", `browser-context:${localDate}`, "browser_context", `浏览器环境 · ${localDate}`, `语言 ${language} · 平台 ${platform}`, browserPayload],
    ["cookie-context-event", `browser-context-${localDate}`, "event", `浏览器环境记录 · ${localDate}`, `语言 ${language} · 平台 ${platform}`, contextEventPayload],
    ["cookie-fortune-plugin", `daily-fortune:${localDate}`, "fortune", `今日 Cookie 吉凶 · ${rating}`, summary, fortunePayload],
    ["cookie-fortune-event", `daily-fortune-${localDate}`, "event", `今日 Cookie 吉凶 · ${rating}`, summary, fortuneEventPayload]
  ] as const;
  const existingRows = await context.database.prepare(
    "SELECT source_provider, external_id FROM cards WHERE space_id=? AND source_provider IN ('cookie-context-plugin','cookie-context-event','cookie-fortune-plugin','cookie-fortune-event')"
  ).bind(context.spaceId).all<{ source_provider: string; external_id: string }>();
  const existing = new Set(existingRows.results.map((row) => `${row.source_provider}\u0000${row.external_id}`));
  const statements: D1PreparedStatement[] = rows.map(([provider, externalId, cardType, title, cardSummary, payload]) => context.database.prepare(`INSERT INTO cards
    (id, space_id, owner_agent_id, source_provider, source_connection_id, external_id, card_type, title, summary, payload_json, created_at, updated_at, visibility)
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'public')
    ON CONFLICT(space_id, source_provider, external_id) DO UPDATE SET title=excluded.title, summary=excluded.summary, payload_json=excluded.payload_json, updated_at=excluded.updated_at, visibility='public'`)
    .bind(randomId("card_"), context.spaceId, context.agentId, provider, externalId, cardType, title, cardSummary, JSON.stringify(payload), now, now));
  statements.push(context.database.prepare(
    "INSERT INTO audit_events (id, user_id, agent_id, space_id, action, created_at, metadata_json) VALUES (?, ?, ?, ?, 'cookie_fortune.cards.synced', ?, ?)"
  ).bind(randomId("aud_"), context.userId, context.agentId, context.spaceId, now, JSON.stringify({ localDate, language, platform, privacy, via: "cookie-fortune-cards" })));
  await context.database.batch(statements);
  const created = rows.filter(([provider, externalId]) => !existing.has(`${provider}\u0000${externalId}`)).length;
  return { ok: true, localDate, context: { language, platform, requestTime: now, localHour, privacy }, fortune: { rating, score, trigram: fortune.trigram, element: fortune.element, guidance: fortune.guidance, entertainmentOnly: true }, cardsCreated: created, cardsUpdated: rows.length - created };
}

function inputRecord(value: object): JsonRecord {
  return value as JsonRecord;
}
