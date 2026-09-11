import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node skills/event-image-to-directus/scripts/validate-payload.mjs payload.json");
  process.exit(1);
}

const payload = JSON.parse(readFileSync(file, "utf8"));
const required = [
  "slug",
  "title",
  "category",
  "host",
  "venue",
  "locationName",
  "locationAddress",
  "date",
  "time",
  "cover",
  "priceLabel",
  "statusLabel",
  "presentedBy",
  "presentedByAvatar",
  "presentedByDescription",
  "registrationStatus",
  "registrationNote",
  "registrationAction",
  "contactLabel",
  "submittedAt"
];

const missing = required.filter((field) => {
  const value = payload[field];
  return value === undefined || value === null || value === "";
});

if (missing.length) {
  console.error(`Missing required fields: ${missing.join(", ")}`);
  process.exit(1);
}

for (const field of ["hosts", "about", "sections", "subscribeFields"]) {
  if (!Array.isArray(payload[field])) {
    console.error(`${field} must be an array`);
    process.exit(1);
  }
}

if (!payload.sections.every((item) => item && item.title && item.body)) {
  console.error("Every section must include title and body");
  process.exit(1);
}

if (!/^[a-z0-9-]+$/.test(payload.slug)) {
  console.error("slug must contain only lowercase ASCII letters, numbers, and hyphens");
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      slug: payload.slug,
      title: payload.title,
      sections: payload.sections.length
    },
    null,
    2
  )
);
