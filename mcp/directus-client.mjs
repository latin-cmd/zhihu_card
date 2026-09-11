const DIRECTUS_URL = process.env.DIRECTUS_URL ?? "http://127.0.0.1:8055";
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN;

export async function directusItems(collection, query = "") {
  const response = await fetch(
    `${DIRECTUS_URL.replace(/\/$/, "")}/items/${collection}${query}`,
    {
      headers: DIRECTUS_TOKEN ? { Authorization: `Bearer ${DIRECTUS_TOKEN}` } : {}
    }
  );

  if (!response.ok) {
    throw new Error(`Directus ${collection} request failed: ${response.status}`);
  }

  const payload = await response.json();
  return payload.data;
}

export async function getActivityTopics(activityId) {
  const rows = await directusItems(
    "activities_topics",
    `?filter[activities_id][_eq]=${encodeURIComponent(activityId)}&fields=topics_id.*`
  );

  return rows.map((row) => row.topics_id ?? row);
}

export async function getTopicReferences(topicId) {
  const rows = await directusItems(
    "topics_references",
    `?filter[topics_id][_eq]=${encodeURIComponent(topicId)}&fields=references_id.*`
  );

  return rows.map((row) => row.references_id ?? row);
}
