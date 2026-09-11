const ISLAND_ORIGIN = "https://crito-island.m937746825.workers.dev";

export async function GET() {
  const response = await fetch(`${ISLAND_ORIGIN}/.well-known/agent-card.json`);
  return new Response(response.body, {
    status: response.status,
    headers: {
      "access-control-allow-origin": "*",
      "content-type": response.headers.get("content-type") ?? "application/json; charset=utf-8"
    }
  });
}
