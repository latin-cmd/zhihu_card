import type { APIRoute } from "astro";
import { AgentRequestAuthError, verifyAgentRequest } from "../../../../../lib/agent-request-auth";
import { CardUpdateError, deleteSpaceCard, getSpaceCardByAgent, updateSpaceCardByAgent } from "../../../../../lib/card-space-store";

export const prerender = false;

export const GET: APIRoute = async ({ request, params }) => {
  const spaceId = params.id ?? "";
  const cardId = params.cardId ?? "";
  try {
    const authority = await verifyAgentRequest(request, spaceId, "", "cards:read");
    const card = await getSpaceCardByAgent(spaceId, cardId, authority.agentId);
    return Response.json({ card, authority: { agentCardId: authority.agentCardId, keyId: authority.keyId } }, { headers: { ETag: `"${card.version}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AgentRequestAuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof CardUpdateError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Card read failed." }, { status: 500 });
  }
};

export const PATCH: APIRoute = async ({ request, params }) => {
  const spaceId = params.id ?? "";
  const cardId = params.cardId ?? "";
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > 32_768) return Response.json({ error: "Card update payload is too large." }, { status: 413 });
  try {
    const authority = await verifyAgentRequest(request, spaceId, rawBody, "cards:update");
    let input: unknown;
    try { input = JSON.parse(rawBody); } catch { throw new CardUpdateError(400, "Request body must be valid JSON."); }
    const ifMatch = request.headers.get("If-Match")?.trim().replace(/^W\//, "").replace(/^"|"$/g, "") ?? "";
    const card = await updateSpaceCardByAgent(spaceId, cardId, authority.agentId, Number(ifMatch), input);
    return Response.json({ card, authority: { agentCardId: authority.agentCardId, keyId: authority.keyId } }, { headers: { ETag: `"${card.version}"`, "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AgentRequestAuthError) return Response.json({ error: error.message, code: error.code }, { status: error.status });
    if (error instanceof CardUpdateError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "Card update failed." }, { status: 500 });
  }
};

export const DELETE: APIRoute = async ({ request, params }) => {
  const result = await deleteSpaceCard(request, params.id ?? "", params.cardId ?? "");
  if (!result) return Response.json({ error: "Agent Card authority required" }, { status: 401 });
  if (!result.deleted && result.reason === "protected_agent_identity") return Response.json({ error: "Agent identity card is protected" }, { status: 409 });
  if (!result.deleted) return Response.json({ error: "Card not found" }, { status: 404 });
  return Response.json(result);
};
