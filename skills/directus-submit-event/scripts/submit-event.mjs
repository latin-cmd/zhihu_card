import { existsSync, readFileSync } from "node:fs";

function loadEnv(path = ".env") {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function arg(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] ?? "";
}

function slugify(value) {
  const ascii = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return ascii || `event-${Date.now().toString(36)}`;
}

function required(value, name) {
  if (!value) {
    console.error(`${name} is required.`);
    process.exit(1);
  }
  return value;
}

function eventFromArgs() {
  const title = required(arg("--title"), "--title");
  const category = arg("--category") || "Reading";
  const host = arg("--host") || "绒屿";
  const venue = arg("--venue") || "深圳线下空间";
  const now = new Date().toISOString();
  const slug = `${slugify(title)}-${Date.now().toString(36)}`;

  return {
    slug,
    title,
    category,
    host,
    venue,
    locationName: venue,
    locationAddress: arg("--address") || "报名后由活动者微信同步",
    date: arg("--date") || "2026-08-15",
    time: arg("--time") || "10:00",
    cover:
      arg("--cover") ||
      "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1600&q=80",
    priceLabel: arg("--price") || "开放报名",
    statusLabel: arg("--status") || "开放报名",
    attendeeCount: 0,
    presentedBy: host,
    presentedByAvatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=240&q=80",
    presentedByDescription: `${host} submitted this event.`,
    hosts: [host],
    attendees: 0,
    attendeeNames: "No attendees yet.",
    registrationStatus: arg("--status") || "开放报名",
    registrationNote: "提交报名后由活动者微信邀请进群并确认线下参与。",
    registrationAction: "加入活动",
    contactLabel: "联系活动者",
    about: [arg("--about") || `${title}，报名后通过微信进群确认地点和参与方式。`],
    sections: [
      {
        title: "活动流程",
        body: "添加索引活动，添加活动者微信，邀请进群，线下参与活动。"
      }
    ],
    subscribeFields: ["name", "email", "wechat", "phone", "role", "company", "note"],
    submittedAt: now
  };
}

loadEnv();

const directusUrl = required(process.env.DIRECTUS_URL, "DIRECTUS_URL");
const token = required(process.env.DIRECTUS_TOKEN, "DIRECTUS_TOKEN");
const collection =
  arg("--collection") ||
  process.env.DIRECTUS_EVENTS_COLLECTION ||
  "submitted_events";
const payload = arg("--file")
  ? JSON.parse(readFileSync(arg("--file"), "utf8"))
  : eventFromArgs();

const response = await fetch(`${directusUrl.replace(/\/$/, "")}/items/${collection}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify(payload)
});

const text = await response.text();
if (!response.ok) {
  console.error(`Directus create failed: ${response.status}`);
  console.error(text);
  process.exit(1);
}

const result = JSON.parse(text);
console.log(
  JSON.stringify(
    {
      collection,
      id: result.data?.id,
      slug: result.data?.slug,
      title: result.data?.title
    },
    null,
    2
  )
);
