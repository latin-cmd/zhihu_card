import { env } from "cloudflare:workers";
import {
  activity as sampleActivity,
  community as sampleCommunity,
  nearby as sampleNearby,
  partners as samplePartners,
  topics as sampleTopics,
  venue as sampleVenue
} from "./sample";

const runtimeEnv = env as Env & Record<string, unknown>;
const DIRECTUS_URL = runtimeEnv.DIRECTUS_URL;
const DIRECTUS_TOKEN = runtimeEnv.DIRECTUS_TOKEN;

type DirectusResponse<T> = {
  data: T;
};

async function directusFetch<T>(path: string): Promise<T> {
  if (!DIRECTUS_URL) {
    throw new Error("DIRECTUS_URL is not configured");
  }

  const response = await fetch(`${DIRECTUS_URL.replace(/\/$/, "")}${path}`, {
    headers: DIRECTUS_TOKEN ? { Authorization: `Bearer ${DIRECTUS_TOKEN}` } : {}
  });

  if (!response.ok) {
    throw new Error(`Directus request failed: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as DirectusResponse<T>;
  return payload.data;
}

function first<T>(value: T[] | T | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function loadActivityPage() {
  try {
    const [communityData, activityData, partnersData] = await Promise.all([
      directusFetch("/items/community_info"),
      directusFetch("/items/activities?limit=1&sort=start_date&fields=*,venue.*"),
      directusFetch("/items/partners?sort=name")
    ]);

    const liveActivity = first(activityData as unknown[]);
    const liveCommunity = first(communityData as unknown[] | unknown);

    if (!liveActivity || !liveCommunity) {
      throw new Error("Directus returned no activity or community data");
    }

    const topicRows = await directusFetch(
      `/items/activities_topics?filter[activities_id][_eq]=${encodeURIComponent(
        (liveActivity as any).id
      )}&fields=topics_id.*`
    );

    const directusTopics = await Promise.all(
      (topicRows as any[]).map(async (row) => {
        const topic = row.topics_id ?? row;
        const referenceRows = await directusFetch(
          `/items/topics_references?filter[topics_id][_eq]=${encodeURIComponent(
            topic.id
          )}&fields=references_id.*`
        );

        return {
          ...topic,
          references: (referenceRows as any[]).map((refRow) => refRow.references_id ?? refRow)
        };
      })
    );

    return normalizeDirectusPage(
      liveActivity,
      liveCommunity,
      partnersData as unknown[],
      directusTopics
    );
  } catch {
    return {
      activity: sampleActivity,
      community: sampleCommunity,
      nearby: sampleNearby,
      partners: samplePartners,
      topics: sampleTopics,
      venue: sampleVenue,
      source: "sample" as const
    };
  }
}

function normalizeDirectusPage(
  rawActivity: any,
  rawCommunity: any,
  rawPartners: any[],
  rawTopics: any[]
) {
  const venue = rawActivity.venue ?? sampleVenue;
  const topics = rawTopics.map((topic: any) => {
    return {
      id: topic.id,
      name: topic.name,
      summary: topic.summary,
      references: (topic.references ?? []).map((refRow: any) => {
        const reference = refRow.references_id ?? refRow;
        return {
          title: reference.title,
          type: reference.type,
          url: reference.url
        };
      })
    };
  });

  return {
    activity: {
      id: rawActivity.id,
      slug: rawActivity.slug,
      title: rawActivity.title,
      subtitle: rawActivity.subtitle,
      startDate: rawActivity.start_date,
      startTime: rawActivity.start_time,
      endTime: rawActivity.end_time,
      status: rawActivity.status,
      price: rawActivity.price,
      capacity: rawActivity.capacity,
      hosts: rawActivity.hosts ?? [],
      cover: rawActivity.cover_url ?? sampleActivity.cover,
      agenda: rawActivity.agenda ?? []
    },
    community: {
      name: rawCommunity.name,
      tagline: rawCommunity.tagline,
      intro: rawCommunity.intro,
      contact: {
        email: rawCommunity.email,
        wechat: rawCommunity.wechat,
        phone: rawCommunity.phone
      }
    },
    nearby: sampleNearby,
    partners: rawPartners.map((partner) => ({
      name: partner.name,
      role: partner.role,
      url: partner.url
    })),
    topics,
    venue: {
      name: venue.name,
      address: venue.address,
      city: venue.city,
      district: venue.district,
      transit: venue.transit,
      mapProvider: "Amap"
    },
    source: "directus" as const
  };
}
