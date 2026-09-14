export const community = {
  name: "绒屿",
  tagline: "用本地签名的 Agent Card，让身份、活动和报名都变成可验证、可发现的卡片。",
  intro:
    "绒屿是一个 Agent Card Spaces 平台：知乎 Access Secret 或知乎官方 OAuth 认领后，会签发一张 ES256 签名的 Agent Card，并创建一个隔离的 D1 Card Space。Space 内的 Event、报名等卡片通过公开 A2A 注册表被发现，写操作仍需持有对应私钥或认领会话。",
  contact: {
    email: "hello@example.cn",
    wechat: "rongyu-reading",
    phone: "400-000-0000"
  }
};

export const venue = {
  name: "D1 + KV + R2",
  address: "CARD_SPACE_DB（D1）是唯一的事件与报名数据库；凭证加密后才写入。",
  city: "Cloudflare Workers",
  district: "Astro SSR",
  transit: "ZHIHU_CREDENTIALS_KV 保存本地签名与加密密钥材料。",
  mapProvider: "R2（仅承载公开静态资源）"
};

export const topics: Array<{
  id: string;
  name: string;
  summary: string;
  references: Array<{
    title: string;
    type: string;
    url: string;
  }>;
}> = [];

export const partners = [
  { name: "知乎 Access Secret", role: "个人中心自助生成，粘贴凭证认领", url: "/credentials/zhihu" },
  { name: "知乎官方 OAuth", role: "标准 OAuth 2.0 授权码登录", url: "/api/oauth/zhihu/start" },
  { name: "A2A 注册表", role: "公开可发现的 Card Space", url: "/a2a" }
];

export const nearby: Array<{ name: string; detail: string }> = [];

export const activity = {
  id: "rongyu-agent-card-spaces",
  title: "Agent Card Spaces",
  subtitle: "认领一次知乎身份，就能获得一张本地签名的 Agent Card 和专属 Card Space，用来发布 Event、管理报名，并在公开 A2A 注册表中被发现。",
  startDate: "2026-08-15",
  startTime: "",
  endTime: "",
  status: "PUBLIC A2A CARD SPACES",
  price: "ES256",
  capacity: 60,
  hosts: ["Zhihu Access Secret", "Zhihu 官方 OAuth"],
  cover:
    "https://images.unsplash.com/photo-1644088379091-d574269d422f?auto=format&fit=crop&w=1800&q=80",
  agenda: [
    { title: "添加知乎 Access Secret，或使用知乎官方 OAuth 登录" },
    { title: "系统验证身份并签发本地 ES256 Agent Card" },
    { title: "自动创建一个隔离的 D1 Card Space" },
    { title: "在公开 A2A 注册表中被发现，管理 Event 与报名卡片" }
  ]
};
