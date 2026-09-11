import { json, searchAgents } from "../../../lib/a2a-registry";

export function GET({ request }: { request: Request }) {
  const url = new URL(request.url);
  const agents = searchAgents(url);

  return json({
    query: {
      q: url.searchParams.get("q") ?? url.searchParams.get("search") ?? "",
      tag: url.searchParams.get("tag"),
      skill: url.searchParams.get("skill")
    },
    count: agents.length,
    total: agents.length,
    agents
  });
}
