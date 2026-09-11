export const community = {
  name: "绒屿",
  tagline: "连接深圳读书会、线下沙龙和本地共读社群。",
  intro:
    "绒屿面向深圳地区的读书会参与者、组织者和内容创作者，维护活动展示、报名和后续社群连接。站点的 AI 工具接口保持不变，动态数据由 Worker 后端连接 Directus API 或 Cloudflare 存储处理。",
  contact: {
    email: "hello@example.cn",
    wechat: "rongyu-reading",
    phone: "400-000-0000"
  }
};

export const venue = {
  name: "绒屿深圳读书会",
  address: "深圳市线下活动地点以报名后通知为准",
  city: "绒屿",
  district: "深圳",
  transit: "报名后由活动者微信同步具体集合方式",
  mapProvider: "Amap"
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
  { name: "绒屿", role: "活动组织", url: "#" },
  { name: "深圳读书会", role: "社群共建", url: "#" },
  { name: "独立开发者 Coffee Chat", role: "活动索引", url: "/events/indie-dev-coffee-chat" }
];

export const nearby: Array<{ name: string; detail: string }> = [];

export const activity = {
  id: "rongyu-shenzhen-reading-salon",
  title: "深圳地区的读书会沙龙",
  subtitle: "绒屿开放深圳地区读书会报名，活动添加后由活动者微信完成入群和线下参与确认。",
  startDate: "2026-08-15",
  startTime: "",
  endTime: "",
  status: "开放报名",
  price: "开放报名",
  capacity: 60,
  hosts: ["绒屿"],
  cover:
    "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1800&q=80",
  agenda: [
    { title: "添加索引活动" },
    { title: "添加活动者微信" },
    { title: "邀请进群" },
    { title: "线下参与活动" }
  ]
};
