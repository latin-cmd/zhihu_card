export const cityPage = {
  city: "深圳",
  brand: "绒屿",
  description:
    "绒屿维护深圳地区读书会沙龙和线下活动索引，支持展示页 SSR、后台动态写入和 AI 工具接口读取。",
  subscribeDescription: "订阅绒屿深圳地区读书会沙龙，接收活动开放和进群通知。",
  cover:
    "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80"
};

export const navLinks = [
  { href: "/events", label: "Events" },
  { href: "/", label: "Featured" }
];

export const eventCards = [
  {
    slug: "indie-dev-coffee-chat",
    title: "独立开发者 Coffee Chat",
    host: "绒屿",
    venue: "深圳线下咖啡空间",
    date: "8月8日",
    time: "10:00",
    cover:
      "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1600&q=80",
    priceLabel: "Free",
    statusLabel: "开放报名",
    attendeeCount: 21,
    category: "Indie Hackers",
    presentedBy: "绒屿",
    presentedByAvatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80",
    presentedByDescription:
      "绒屿关注深圳地区独立产品、个人开发者收入、小团队增长和线下共读交流。",
    hosts: ["绒屿", "独立开发者 Coffee Chat"],
    attendees: 21,
    attendeeNames: "Jason、晴子 和 19 位朋友",
    locationName: "深圳线下咖啡空间",
    locationAddress: "深圳市具体地点报名后由活动者微信同步",
    registrationStatus: "Registration",
    registrationNote: "提交报名后，后台会记录报名信息，由活动者微信邀请进群并确认线下参与。",
    registrationAction: "加入活动",
    contactLabel: "联系活动者",
    about: [
      "轻量 Coffee Chat，适合正在做 side project、SaaS、小工具或内容产品的人。",
      "现场不设正式演讲，以 6-8 人小组交换近况、问题和资源。"
    ],
    sections: [
      {
        title: "交流方式",
        body:
          "每个人用 3 分钟介绍正在做的产品或问题，然后自由组队讨论。报名后通过微信进群确认地点和参与方式。"
      }
    ],
    subscribeFields: ["name", "email", "wechat", "phone", "role", "company", "note"]
  }
];
