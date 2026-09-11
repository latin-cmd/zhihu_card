const REGISTRY_ORIGIN = "https://crito-a2a-registry.m937746825.workers.dev";

const corsHeaders = {
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": "*"
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST({ request }: { request: Request }) {
  const response = await fetch(`${REGISTRY_ORIGIN}/verify`, {
    method: "POST",
    headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
    body: request.body
  });

  return new Response(response.body, {
    status: response.status,
    headers: {
      ...corsHeaders,
      "content-type": response.headers.get("content-type") ?? "application/json; charset=utf-8"
    }
  });
}
