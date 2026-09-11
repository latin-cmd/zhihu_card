import {
  activity,
  community,
  partners,
  topics,
  venue
} from "../src/data/content.ts";

const DIRECTUS_URL = process.env.DIRECTUS_URL ?? "http://127.0.0.1:8055";
const DIRECTUS_TOKEN = process.env.DIRECTUS_TOKEN ?? "";
const ADMIN_EMAIL = process.env.DIRECTUS_ADMIN_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.DIRECTUS_ADMIN_PASSWORD ?? "change-me-now";

async function request(path, options = {}) {
  const response = await fetch(`${DIRECTUS_URL.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.errors?.[0]?.message ?? response.statusText;
    throw new Error(`${options.method ?? "GET"} ${path}: ${message}`);
  }

  return payload?.data ?? payload;
}

async function login() {
  const payload = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    })
  });

  return payload.access_token;
}

function api(token) {
  return async (path, options = {}) =>
    request(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {})
      }
    });
}

async function ignoreExisting(action, label) {
  try {
    await action();
    console.log(`created ${label}`);
  } catch (error) {
    if (
      error.message.includes("already exists") ||
      error.message.includes("must be unique") ||
      error.message.includes("Field already exists") ||
      error.message.includes("already has an associated relationship")
    ) {
      console.log(`exists ${label}`);
      return;
    }

    throw error;
  }
}

function collection(name, singleton = false) {
  return {
    collection: name,
    meta: {
      singleton,
      hidden: false
    },
    schema: {
      name
    }
  };
}

function field(collectionName, fieldName, type, extra = {}) {
  return {
    collection: collectionName,
    field: fieldName,
    type,
    meta: {
      interface: extra.interface,
      special: extra.special,
      required: extra.required ?? false
    },
    schema: {
      name: fieldName,
      data_type: extra.dataType ?? type,
      is_nullable: extra.required ? false : true,
      is_unique: extra.unique ?? false
    }
  };
}

async function createCollections(client) {
  for (const item of [
    collection("venues"),
    collection("activities"),
    collection("topics"),
    collection("references"),
    collection("partners"),
    collection("community_info", true),
    collection("activities_topics"),
    collection("topics_references"),
    collection("submitted_events"),
    collection("event_subscriptions"),
    collection("organizer_contact_cards")
  ]) {
    await ignoreExisting(
      () => client("/collections", { method: "POST", body: JSON.stringify(item) }),
      `collection ${item.collection}`
    );
  }
}

async function createFields(client) {
  const fields = [
    field("venues", "name", "string", { required: true }),
    field("venues", "address", "text", { dataType: "text" }),
    field("venues", "city", "string"),
    field("venues", "district", "string"),
    field("venues", "transit", "string"),

    field("activities", "title", "string", { required: true }),
    field("activities", "slug", "string", { required: true, unique: true }),
    field("activities", "subtitle", "text", { dataType: "text" }),
    field("activities", "start_date", "date"),
    field("activities", "start_time", "time"),
    field("activities", "end_time", "time"),
    field("activities", "status", "string"),
    field("activities", "price", "string"),
    field("activities", "capacity", "integer", { dataType: "integer" }),
    field("activities", "hosts", "json", { dataType: "json", special: ["cast-json"] }),
    field("activities", "cover_url", "string"),
    field("activities", "agenda", "json", { dataType: "json", special: ["cast-json"] }),
    field("activities", "venue", "integer", { dataType: "integer" }),

    field("topics", "name", "string", { required: true }),
    field("topics", "slug", "string", { required: true, unique: true }),
    field("topics", "summary", "text", { dataType: "text" }),

    field("references", "title", "string", { required: true }),
    field("references", "slug", "string", { required: true, unique: true }),
    field("references", "type", "string"),
    field("references", "url", "string"),

    field("partners", "name", "string", { required: true }),
    field("partners", "role", "string"),
    field("partners", "url", "string"),

    field("community_info", "name", "string", { required: true }),
    field("community_info", "tagline", "string"),
    field("community_info", "intro", "text", { dataType: "text" }),
    field("community_info", "email", "string"),
    field("community_info", "wechat", "string"),
    field("community_info", "phone", "string"),

    field("activities_topics", "activities_id", "integer", { dataType: "integer" }),
    field("activities_topics", "topics_id", "integer", { dataType: "integer" }),
    field("topics_references", "topics_id", "integer", { dataType: "integer" }),
    field("topics_references", "references_id", "integer", { dataType: "integer" }),

    field("submitted_events", "slug", "string", { required: true, unique: true }),
    field("submitted_events", "title", "string", { required: true }),
    field("submitted_events", "category", "string", { required: true }),
    field("submitted_events", "host", "string", { required: true }),
    field("submitted_events", "venue", "string", { required: true }),
    field("submitted_events", "locationName", "string"),
    field("submitted_events", "locationAddress", "text", { dataType: "text" }),
    field("submitted_events", "date", "string"),
    field("submitted_events", "time", "string"),
    field("submitted_events", "cover", "string"),
    field("submitted_events", "priceLabel", "string"),
    field("submitted_events", "statusLabel", "string"),
    field("submitted_events", "attendeeCount", "integer", { dataType: "integer" }),
    field("submitted_events", "presentedBy", "string"),
    field("submitted_events", "presentedByAvatar", "string"),
    field("submitted_events", "presentedByDescription", "text", { dataType: "text" }),
    field("submitted_events", "hosts", "json", { dataType: "json", special: ["cast-json"] }),
    field("submitted_events", "attendees", "integer", { dataType: "integer" }),
    field("submitted_events", "attendeeNames", "string"),
    field("submitted_events", "registrationStatus", "string"),
    field("submitted_events", "registrationNote", "text", { dataType: "text" }),
    field("submitted_events", "registrationAction", "string"),
    field("submitted_events", "contactLabel", "string"),
    field("submitted_events", "about", "json", { dataType: "json", special: ["cast-json"] }),
    field("submitted_events", "sections", "json", { dataType: "json", special: ["cast-json"] }),
    field("submitted_events", "subscribeFields", "json", { dataType: "json", special: ["cast-json"] }),
    field("submitted_events", "submittedAt", "string"),

    field("event_subscriptions", "event_slug", "string", { required: true }),
    field("event_subscriptions", "event_title", "string"),
    field("event_subscriptions", "event_date", "string"),
    field("event_subscriptions", "event_time", "string"),
    field("event_subscriptions", "event_venue", "string"),
    field("event_subscriptions", "event_category", "string"),
    field("event_subscriptions", "name", "string", { required: true }),
    field("event_subscriptions", "email", "string", { required: true }),
    field("event_subscriptions", "wechat", "string"),
    field("event_subscriptions", "phone", "string"),
    field("event_subscriptions", "role", "string"),
    field("event_subscriptions", "company", "string"),
    field("event_subscriptions", "note", "text", { dataType: "text" }),
    field("event_subscriptions", "subscribe_updates", "boolean", { dataType: "boolean" }),
    field("event_subscriptions", "joined_at", "string"),

    field("organizer_contact_cards", "event_slug", "string", { required: true, unique: true }),
    field("organizer_contact_cards", "organizer_name", "string", { required: true }),
    field("organizer_contact_cards", "qr_image_url", "string"),
    field("organizer_contact_cards", "organizer_note", "text", { dataType: "text" }),
    field("organizer_contact_cards", "contact_note", "text", { dataType: "text" }),
    field("organizer_contact_cards", "subscribe_note", "text", { dataType: "text" }),
    field("organizer_contact_cards", "report_note", "text", { dataType: "text" })
  ];

  for (const item of fields) {
    await ignoreExisting(
      () => client(`/fields/${item.collection}`, { method: "POST", body: JSON.stringify(item) }),
      `field ${item.collection}.${item.field}`
    );
  }
}

async function relation(client, collectionName, fieldName, relatedCollection, onDelete = "SET NULL") {
  await ignoreExisting(
    () =>
      client("/relations", {
        method: "POST",
        body: JSON.stringify({
          collection: collectionName,
          field: fieldName,
          related_collection: relatedCollection,
          meta: {
            many_collection: collectionName,
            many_field: fieldName,
            one_collection: relatedCollection
          },
          schema: {
            table: collectionName,
            column: fieldName,
            foreign_key_table: relatedCollection,
            foreign_key_column: "id",
            on_delete: onDelete
          }
        })
      }),
    `relation ${collectionName}.${fieldName}`
  );
}

async function createRelations(client) {
  await relation(client, "activities", "venue", "venues");
  await relation(client, "activities_topics", "activities_id", "activities", "CASCADE");
  await relation(client, "activities_topics", "topics_id", "topics", "CASCADE");
  await relation(client, "topics_references", "topics_id", "topics", "CASCADE");
  await relation(client, "topics_references", "references_id", "references", "CASCADE");
}

async function createPermission(client, policyId, collectionName, action) {
  const existing = await client(
    `/permissions?filter[policy][_eq]=${encodeURIComponent(
      policyId
    )}&filter[collection][_eq]=${encodeURIComponent(
      collectionName
    )}&filter[action][_eq]=${encodeURIComponent(action)}&limit=1`
  );

  if (existing[0]) {
    console.log(`exists permission ${collectionName}.${action}`);
    return;
  }

  await ignoreExisting(
    () =>
      client("/permissions", {
        method: "POST",
        body: JSON.stringify({
          policy: policyId,
          collection: collectionName,
          action,
          permissions: {},
          validation: null,
          presets: null,
          fields: ["*"]
        })
      }),
    `permission ${collectionName}.${action}`
  );
}

async function createPermissions(client) {
  const policies = await client("/policies?filter[admin_access][_eq]=true&limit=1");
  const adminPolicy = policies[0];

  if (!adminPolicy) {
    console.log("skipped permissions: no admin policy was visible to this token");
    return;
  }

  const collections = [
    "venues",
    "activities",
    "topics",
    "references",
    "partners",
    "community_info",
    "activities_topics",
    "topics_references",
    "submitted_events",
    "event_subscriptions",
    "organizer_contact_cards"
  ];

  for (const collectionName of collections) {
    for (const action of ["read", "create", "update", "delete"]) {
      await createPermission(client, adminPolicy.id, collectionName, action);
    }
  }
}

async function findOne(client, collectionName, fieldName, value) {
  const rows = await client(
    `/items/${collectionName}?filter[${fieldName}][_eq]=${encodeURIComponent(value)}&limit=1`
  );

  return rows[0] ?? null;
}

async function upsertBy(client, collectionName, fieldName, value, body) {
  const existing = await findOne(client, collectionName, fieldName, value);

  if (existing) {
    return client(`/items/${collectionName}/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
  }

  return client(`/items/${collectionName}`, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

async function seed(client) {
  const optionalTime = (value) => value || null;
  const venueItem = await upsertBy(client, "venues", "name", venue.name, venue);
  const communityBody = {
    name: community.name,
    tagline: community.tagline,
    intro: community.intro,
    email: community.contact.email,
    wechat: community.contact.wechat,
    phone: community.contact.phone
  };

  await client("/items/community_info", {
    method: "PATCH",
    body: JSON.stringify(communityBody)
  });

  const activityItem = await upsertBy(client, "activities", "slug", activity.id, {
    slug: activity.id,
    title: activity.title,
    subtitle: activity.subtitle,
    start_date: activity.startDate,
    start_time: optionalTime(activity.startTime),
    end_time: optionalTime(activity.endTime),
    status: activity.status,
    price: activity.price,
    capacity: activity.capacity,
    hosts: activity.hosts,
    cover_url: activity.cover,
    agenda: activity.agenda,
    venue: venueItem.id
  });

  for (const partner of partners) {
    await upsertBy(client, "partners", "name", partner.name, partner);
  }

  const defaultContactCard = {
    organizer_name: community.name,
    qr_image_url: "",
    organizer_note: "通过活动者微信完成报名确认、进群和线下参与沟通。",
    contact_note: "添加活动者微信后，请备注活动名称和你的称呼。",
    subscribe_note: "订阅后续活动更新，请添加活动者微信并说明关注的活动方向。",
    report_note: "如需反馈活动信息，请添加活动者微信并说明问题。"
  };

  await upsertBy(client, "organizer_contact_cards", "event_slug", "events", {
    event_slug: "events",
    ...defaultContactCard
  });

  await upsertBy(client, "organizer_contact_cards", "event_slug", "indie-dev-coffee-chat", {
    event_slug: "indie-dev-coffee-chat",
    ...defaultContactCard,
    organizer_name: "绒屿"
  });

  for (const topic of topics) {
    const topicItem = await upsertBy(client, "topics", "slug", topic.id, {
      slug: topic.id,
      name: topic.name,
      summary: topic.summary
    });

    const activityTopic = await client(
      `/items/activities_topics?filter[activities_id][_eq]=${activityItem.id}&filter[topics_id][_eq]=${topicItem.id}&limit=1`
    );
    if (!activityTopic[0]) {
      await client("/items/activities_topics", {
        method: "POST",
        body: JSON.stringify({
          activities_id: activityItem.id,
          topics_id: topicItem.id
        })
      });
    }

    for (const reference of topic.references) {
      const referenceId = reference.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const referenceItem = await upsertBy(client, "references", "slug", referenceId, {
        slug: referenceId,
        ...reference
      });

      const topicReference = await client(
        `/items/topics_references?filter[topics_id][_eq]=${topicItem.id}&filter[references_id][_eq]=${referenceItem.id}&limit=1`
      );
      if (!topicReference[0]) {
        await client("/items/topics_references", {
          method: "POST",
          body: JSON.stringify({
            topics_id: topicItem.id,
            references_id: referenceItem.id
          })
        });
      }
    }
  }
}

const token = DIRECTUS_TOKEN || (await login());
const client = api(token);

await createCollections(client);
await createFields(client);
await createRelations(client);
await createPermissions(client);
await seed(client);

try {
  await client("/utils/cache/clear?system=true", { method: "POST" });
  console.log("Directus cache cleared.");
} catch (error) {
  console.log(`skipped cache clear: ${error.message}`);
}

console.log("Directus schema and sample data are ready.");
