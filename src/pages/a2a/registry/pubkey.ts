import { pubkey } from "../../../lib/a2a-registry";

export function GET() {
  return new Response(pubkey, {
    headers: {
      "access-control-allow-origin": "*",
      "content-type": "text/plain; charset=utf-8"
    }
  });
}
