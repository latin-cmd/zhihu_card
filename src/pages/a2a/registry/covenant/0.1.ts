import { covenant, registry } from "../../../../lib/a2a-registry";

export function GET() {
  return new Response(covenant, {
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=3600, immutable",
      "content-type": "text/markdown; charset=utf-8",
      "x-content-sha256": registry.covenant.sha256
    }
  });
}
