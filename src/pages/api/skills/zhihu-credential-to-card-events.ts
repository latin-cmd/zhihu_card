import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async () => Response.json({
  id: "zhihu-credential-to-card-events",
  name: "Zhihu Credential to Card Events",
  description: "Import a Zhihu Access Secret owner's recent creations as source Cards and paired Event detail Cards.",
  authority: "Zhihu Access Secret owner data for reads; claimed Agent Card session for Space writes",
  input: { provider: "zhihu", credential: "Access Secret supplied securely or already configured", spaceId: "target Card Space" },
  modes: {
    manual: ["Read at most 20 recent creations", "Present a preview", "Wait for explicit import confirmation"],
    credentialClaimHook: ["Treat successful credential submission as import authorization", "Run after Agent Card issue or resume", "Return created and skipped counts without blocking the verified credential on sync failure"]
  },
  workflow: ["Read at most 20 recent creations", "Create source Cards and paired Event detail Cards with stable source IDs", "Skip existing stable IDs"],
  privacy: ["Never place Access Secrets in cards, URLs, or logs", "Do not import private follows, favorites, or knowledge-base content without explicit instruction", "Do not copy full content bodies"],
  output: { sourceCardType: "zhihu_content", detailCardType: "event", detailSourceProvider: "zhihu-event" }
}, { headers: { "Cache-Control": "public, max-age=3600" } });
