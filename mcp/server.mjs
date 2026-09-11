import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  directusItems,
  getActivityTopics,
  getTopicReferences
} from "./directus-client.mjs";

const server = new McpServer({
  name: "directus-activity-cms",
  version: "0.1.0"
});

function jsonResult(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

server.tool(
  "search_activities",
  {
    query: z.string().optional(),
    city: z.string().optional(),
    topic: z.string().optional(),
    limit: z.number().int().min(1).max(50).default(10)
  },
  async ({ query, city, limit }) => {
    const filters = [];

    if (query) {
      filters.push(`filter[_or][0][title][_contains]=${encodeURIComponent(query)}`);
      filters.push(`filter[_or][1][subtitle][_contains]=${encodeURIComponent(query)}`);
    }

    if (city) {
      filters.push(`filter[venue][city][_eq]=${encodeURIComponent(city)}`);
    }

    filters.push(`limit=${limit}`);
    filters.push("sort=start_date");
    filters.push("fields=*,venue.*");

    const activities = await directusItems("activities", `?${filters.join("&")}`);
    return jsonResult(activities);
  }
);

server.tool(
  "get_activity_detail",
  {
    activity_id: z.string()
  },
  async ({ activity_id }) => {
    const field = /^\d+$/.test(activity_id) ? "id" : "slug";
    const activity = await directusItems(
      "activities",
      `?filter[${field}][_eq]=${encodeURIComponent(activity_id)}&limit=1&fields=*,venue.*`
    );

    const item = activity[0] ?? null;
    if (!item) {
      return jsonResult(null);
    }

    const topics = await getActivityTopics(activity_id);
    return jsonResult({ ...item, topics });
  }
);

server.tool(
  "get_topic_references",
  {
    topic_id: z.string()
  },
  async ({ topic_id }) => {
    const id = /^\d+$/.test(topic_id)
      ? topic_id
      : (
          await directusItems(
            "topics",
            `?filter[slug][_eq]=${encodeURIComponent(topic_id)}&limit=1`
          )
        )[0]?.id;
    const references = id ? await getTopicReferences(id) : [];
    return jsonResult(references);
  }
);

server.tool("get_community_info", {}, async () => {
  const community = await directusItems("community_info", "?limit=1");
  return jsonResult(Array.isArray(community) ? (community[0] ?? null) : community);
});

const transport = new StdioServerTransport();
await server.connect(transport);
