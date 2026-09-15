import type { APIRoute } from "astro";

export const prerender = false;

export const GET: APIRoute = async () => Response.json({
  id: "sync-cookie-fortune-cards",
  name: "Sync Cookie Fortune Cards",
  description: "Create daily browser-context and entertainment fortune Card/Event pairs for the current Cookie-owned Card Space.",
  authority: "Current same-origin browser session",
  endpoint: "/api/plugins/cookie-fortune-cards/sync",
  input: { language: "coarse browser language", platform: "coarse platform category", timezoneOffsetMinutes: "used only to choose the local date; not persisted or returned" },
  output: { contextCard: "browser_context", contextEvent: "event", fortuneCard: "fortune", fortuneEvent: "event", idempotency: "one pair of each kind per local date" },
  privacy: ["No IP geolocation", "No GPS or timezone-name storage", "No browser or OS username", "No full User-Agent storage", "No cross-site Cookie access"],
  disclaimer: "Cultural entertainment only; it does not predict real events or provide professional advice."
}, { headers: { "Cache-Control": "public, max-age=3600" } });
