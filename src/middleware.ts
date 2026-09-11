import { defineMiddleware } from "astro:middleware";

const noStoreHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "Pragma": "no-cache",
  "Expires": "0"
};

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const { pathname } = context.url;

  if (pathname === "/a2a" || pathname === "/a2a/" || pathname.startsWith("/a2a/registry/")) {
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(noStoreHeaders)) {
      headers.set(key, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  return response;
});
