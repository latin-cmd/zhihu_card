const ISLAND_ORIGIN = "https://crito-island.m937746825.workers.dev";

const corsHeaders = {
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": "*"
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST({ request }: { request: Request }) {
  const response = await fetch(`${ISLAND_ORIGIN}/a2a`, {
    method: "POST",
    headers: {
      "authorization": request.headers.get("authorization") ?? "",
      "content-type": request.headers.get("content-type") ?? "application/json"
    },
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
