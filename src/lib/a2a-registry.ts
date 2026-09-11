import registryData from "../../A2A/registry/registry.json";
import pubkeyText from "../../A2A/registry/community-pubkey.txt?raw";
import covenantText from "../../A2A/docs/拓荒协约.md?raw";

export const registry = registryData;
export const pubkey = pubkeyText;
export const covenant = covenantText;

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "access-control-allow-origin": "*",
      "content-type": "application/json; charset=utf-8"
    }
  });
}

export function activeAgents() {
  return registry.agents.filter((agent) => agent.status === "active");
}

export function registryStats() {
  const active = activeAgents();
  const skillCounts = new Map<string, number>();

  for (const agent of active) {
    for (const skill of agent.skills ?? []) {
      skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
    }
  }

  return {
    registry: registry.registry,
    version: registry.version,
    updatedAt: registry.updatedAt,
    covenant: registry.covenant,
    totalAgents: registry.agents.length,
    activeAgents: active.length,
    signedAgents: active.filter((agent) => agent.verified).length,
    conformantAgents: active.filter((agent) => agent.quality?.conformance?.cardValid === true).length,
    healthyAgents: active.filter((agent) => agent.quality?.health?.reachable === true).length,
    taskVerifiedAgents: active.filter((agent) => agent.quality?.taskConformance?.passed === true).length,
    trendingSkills: [...skillCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 20)
      .map(([skill, count]) => ({ skill, count })),
    generatedAt: new Date().toISOString()
  };
}

export function searchAgents(url: URL) {
  const q = (url.searchParams.get("q") ?? url.searchParams.get("search") ?? "").toLowerCase();
  const tag = url.searchParams.get("tag");
  const skill = url.searchParams.get("skill");

  return activeAgents().filter((agent) => {
    if (tag && !(agent.tags ?? []).includes(tag)) return false;
    if (skill && !(agent.skills ?? []).includes(skill)) return false;
    if (!q) return true;

    const haystack = [
      agent.name,
      agent.owner,
      agent.url,
      agent.cardUrl,
      ...(agent.tags ?? []),
      ...(agent.skills ?? [])
    ].join(" ").toLowerCase();

    return haystack.includes(q);
  });
}
