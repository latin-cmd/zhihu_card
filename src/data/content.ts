export const community = {
  name: "城市共学会",
  tagline: "让本地活动、知识资料和合作网络被人和 AI 一起使用。",
  intro:
    "城市共学会面向独立开发者、产品经理、内容创作者和本地组织者，定期举办小型沙龙、工作坊和主题共学活动。站点数据模型与 Directus 保持一致，后续可由 MCP Server 读写同一套 API。",
  contact: {
    email: "hello@example.cn",
    wechat: "city-learning",
    phone: "400-000-0000"
  }
};

export const venue = {
  name: "滨江创意客厅",
  address: "杭州市滨江区江南大道 588 号 7F",
  city: "杭州",
  district: "滨江区",
  transit: "地铁 6 号线星民站步行 8 分钟",
  mapProvider: "Amap"
};

export const topics = [
  {
    id: "ai-local-data",
    name: "AI 可读写的城市活动数据",
    summary: "Directus 数据建模、MCP 工具设计、权限边界与审计。",
    references: [
      {
        title: "Directus Headless CMS 文档",
        type: "Documentation",
        url: "https://docs.directus.io/"
      },
      {
        title: "Model Context Protocol 规范",
        type: "Spec",
        url: "https://modelcontextprotocol.io/"
      }
    ]
  },
  {
    id: "cn-deploy",
    name: "中国境内部署与备案路径",
    summary: "ICP 备案、常规网站/API 边界、地图服务与支付系统解耦。",
    references: [
      {
        title: "阿里云 ICP 备案指引",
        type: "Guide",
        url: "https://beian.aliyun.com/"
      }
    ]
  },
  {
    id: "event-operation",
    name: "小型沙龙运营结构",
    summary: "从活动页、资料包、周边资源到合作伙伴的轻量闭环。",
    references: [
      {
        title: "Luma 活动页体验参考",
        type: "Reference",
        url: "https://lu.ma/"
      }
    ]
  }
];

export const partners = [
  { name: "开源空间", role: "场地合作", url: "#" },
  { name: "本地云社区", role: "技术支持", url: "#" },
  { name: "独立开发者周刊", role: "内容传播", url: "#" }
];

export const nearby = [
  { name: "停车场", detail: "园区 B2 层，建议提前 15 分钟到达" },
  { name: "咖啡", detail: "一层有连锁咖啡和简餐" },
  { name: "酒店", detail: "周边 1 公里内有商务酒店，可由地图 API 实时补全" }
];

export const activity = {
  id: "directus-mcp-city-event",
  title: "Directus + MCP 城市活动数据沙龙",
  subtitle: "用一套 Headless CMS 数据，同时服务活动展示页和 AI 工具调用。",
  startDate: "2026-08-15",
  startTime: "14:00",
  endTime: "17:30",
  status: "开放报名",
  price: "免费预约",
  capacity: 60,
  hosts: ["城市共学会", "开源空间"],
  cover:
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1800&q=80",
  agenda: [
    { time: "14:00", title: "签到与自由交流" },
    { time: "14:30", title: "Directus 数据模型拆解" },
    { time: "15:30", title: "MCP Server 工具设计演示" },
    { time: "16:30", title: "境内部署、备案和后续票务解耦" },
    { time: "17:10", title: "开放讨论与合作匹配" }
  ]
};
