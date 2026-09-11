import { env } from "cloudflare:workers";
import { eventCards } from "../data/events";

export interface SubmittedEvent {
  slug: string;
  title: string;
  category: string;
  host: string;
  venue: string;
  locationName: string;
  locationAddress: string;
  date: string;
  time: string;
  cover: string;
  priceLabel: string;
  statusLabel: string;
  attendeeCount: number;
  presentedBy: string;
  presentedByAvatar: string;
  presentedByDescription: string;
  hosts: string[];
  attendees: number;
  attendeeNames: string;
  registrationStatus: string;
  registrationNote: string;
  registrationAction: string;
  contactLabel: string;
  about: string[];
  sections: Array<{
    title: string;
    body: string;
  }>;
  subscribeFields: string[];
  submittedAt: string;
}

export interface SubmittedEventInput {
  title?: string;
  category?: string;
  host?: string;
  venue?: string;
  locationAddress?: string;
  date?: string;
  time?: string;
  cover?: string;
  priceLabel?: string;
  statusLabel?: string;
  about?: string;
}

export interface EventSubscription {
  event_slug: string;
  event_title: string;
  event_date: string;
  event_time: string;
  event_venue: string;
  event_category: string;
  name: string;
  email: string;
  wechat?: string;
  phone?: string;
  role: string;
  company?: string;
  note?: string;
  subscribe_updates?: boolean;
  joined_at: string;
}

export interface OrganizerContactCard {
  event_slug: string;
  organizer_name: string;
  qr_image_url?: string;
  organizer_note?: string;
  contact_note?: string;
  subscribe_note?: string;
  report_note?: string;
}

type DirectusResponse<T> = {
  data: T;
};

type ActivityEnv = Env & Record<string, unknown>;
type StoreMode = "kv" | "directus" | "memory";

const eventKeyPrefix = "event:";
const subscriptionKeyPrefix = "subscription:";
const memoryEvents = new Map<string, SubmittedEvent>();
const memorySubscriptions = new Map<string, EventSubscription>();
const fallbackCover =
  "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1600&q=80";
const fallbackAvatar =
  "https://images.unsplash.com/photo-1543269865-cbf427effbad?auto=format&fit=crop&w=240&q=80";

function getEnv() {
  return env as ActivityEnv;
}

function getMode(runtimeEnv = getEnv()): StoreMode {
  const configured = runtimeEnv.ACTIVITY_STORAGE;
  if (configured === "kv" || configured === "directus" || configured === "memory") {
    return configured;
  }

  if (runtimeEnv.ACTIVITY_KV) {
    return "kv";
  }

  if (runtimeEnv.DIRECTUS_URL) {
    return "directus";
  }

  return "memory";
}

function encodeKeyPart(value: string) {
  return encodeURIComponent(value.trim().toLowerCase());
}

function subscriptionKey(record: Pick<EventSubscription, "event_slug" | "email">) {
  return `${subscriptionKeyPrefix}${encodeKeyPart(record.event_slug)}:${encodeKeyPart(record.email)}`;
}

function slugify(value: string) {
  const ascii = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return ascii || `event-${Date.now()}`;
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function requiredString(value: unknown, field: string) {
  const clean = cleanString(value);
  if (!clean) {
    throw new Error(`${field} is required`);
  }
  return clean;
}

function createSubmittedEvent(input: SubmittedEventInput): SubmittedEvent {
  const title = requiredString(input.title, "title");
  const category = requiredString(input.category, "category");
  const host = requiredString(input.host, "host");
  const venue = requiredString(input.venue, "venue");
  const locationAddress = requiredString(input.locationAddress, "locationAddress");
  const date = requiredString(input.date, "date");
  const time = requiredString(input.time, "time");
  const priceLabel = requiredString(input.priceLabel, "priceLabel");
  const statusLabel = requiredString(input.statusLabel, "statusLabel");
  const about = requiredString(input.about, "about");

  return {
    slug: `${slugify(title)}-${Date.now().toString(36)}`,
    title,
    category,
    host,
    venue,
    locationName: venue,
    locationAddress,
    date,
    time,
    cover: cleanString(input.cover) || fallbackCover,
    priceLabel,
    statusLabel,
    attendeeCount: 0,
    presentedBy: host,
    presentedByAvatar: fallbackAvatar,
    presentedByDescription: `${host} submitted this event.`,
    hosts: [host],
    attendees: 0,
    attendeeNames: "No attendees yet.",
    registrationStatus: statusLabel,
    registrationNote: "This event was created through the Submit Event form.",
    registrationAction: "Join Event",
    contactLabel: "Contact the Host",
    about: [about],
    sections: [
      {
        title: "Event Details",
        body: about
      }
    ],
    subscribeFields: ["name", "email", "wechat", "phone", "role", "company", "note"],
    submittedAt: new Date().toISOString()
  };
}

function createSubscription(input: Record<string, unknown>): EventSubscription {
  return {
    event_slug: requiredString(input.event_slug, "event_slug"),
    event_title: requiredString(input.event_title, "event_title"),
    event_date: requiredString(input.event_date, "event_date"),
    event_time: requiredString(input.event_time, "event_time"),
    event_venue: requiredString(input.event_venue, "event_venue"),
    event_category: requiredString(input.event_category, "event_category"),
    name: requiredString(input.name, "name"),
    email: requiredString(input.email, "email"),
    wechat: cleanString(input.wechat),
    phone: cleanString(input.phone),
    role: requiredString(input.role, "role"),
    company: cleanString(input.company),
    note: cleanString(input.note),
    subscribe_updates: Boolean(input.subscribe_updates),
    joined_at: new Date().toISOString()
  };
}

async function listJsonFromKv<T>(kv: KVNamespace, prefix: string): Promise<T[]> {
  const output: T[] = [];
  let cursor: string | undefined;

  do {
    const page = await kv.list({ prefix, cursor });
    const values = await Promise.all(page.keys.map((key) => kv.get<T>(key.name, "json")));
    output.push(...values.filter((value): value is T => Boolean(value)));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  return output;
}

async function directusFetch<T>(
  path: string,
  init: RequestInit = {},
  runtimeEnv = getEnv()
): Promise<T> {
  if (!runtimeEnv.DIRECTUS_URL) {
    throw new Error("DIRECTUS_URL is not configured");
  }

  const headers = new Headers(init.headers);
  if (runtimeEnv.DIRECTUS_TOKEN) {
    headers.set("Authorization", `Bearer ${runtimeEnv.DIRECTUS_TOKEN}`);
  }

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${runtimeEnv.DIRECTUS_URL.replace(/\/$/, "")}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    throw new Error(`Directus request failed: ${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as DirectusResponse<T>;
  return payload.data;
}

function directusCollection(name: "events" | "subscriptions", runtimeEnv = getEnv()) {
  if (name === "events") {
    return runtimeEnv.DIRECTUS_EVENTS_COLLECTION || "submitted_events";
  }

  return runtimeEnv.DIRECTUS_SUBSCRIPTIONS_COLLECTION || "event_subscriptions";
}

function organizerContactFallback(
  eventSlug: string,
  organizerName = "绒屿",
  runtimeEnv = getEnv()
): OrganizerContactCard {
  return {
    event_slug: eventSlug,
    organizer_name: organizerName,
    qr_image_url: cleanString(runtimeEnv.DEFAULT_ORGANIZER_QR_IMAGE_URL),
    organizer_note: "通过活动者微信完成报名确认、进群和线下参与沟通。",
    contact_note: "添加活动者微信后，请备注活动名称和你的称呼。",
    subscribe_note: "订阅后续活动更新，请添加活动者微信并说明关注的活动方向。",
    report_note: "如需反馈活动信息，请添加活动者微信并说明问题。"
  };
}

async function readDirectusOrganizerContactCard(eventSlug: string, runtimeEnv = getEnv()) {
  const collection = runtimeEnv.DIRECTUS_ORGANIZER_CONTACTS_COLLECTION || "organizer_contact_cards";
  const path = `/items/${collection}?filter[event_slug][_eq]=${encodeURIComponent(
    eventSlug
  )}&fields=event_slug,organizer_name,qr_image_url,organizer_note,contact_note,subscribe_note,report_note&limit=1`;
  const cards = await directusFetch<OrganizerContactCard[]>(path, {}, runtimeEnv);
  return cards[0] ?? null;
}

async function readDirectusEvents(runtimeEnv = getEnv()) {
  const collection = directusCollection("events", runtimeEnv);
  return directusFetch<SubmittedEvent[]>(`/items/${collection}?sort=-submittedAt`, {}, runtimeEnv);
}

async function writeDirectusEvent(event: SubmittedEvent, runtimeEnv = getEnv()) {
  const collection = directusCollection("events", runtimeEnv);
  return directusFetch<SubmittedEvent>(
    `/items/${collection}`,
    {
      method: "POST",
      body: JSON.stringify(event)
    },
    runtimeEnv
  );
}

async function findDirectusEventId(slug: string, runtimeEnv = getEnv()) {
  const collection = directusCollection("events", runtimeEnv);
  const filter = `/items/${collection}?filter[slug][_eq]=${encodeURIComponent(slug)}&fields=id,slug&limit=1`;
  const events = await directusFetch<Array<{ id: string | number; slug: string }>>(
    filter,
    {},
    runtimeEnv
  );
  return events[0]?.id ?? null;
}

async function deleteDirectusEvent(slug: string, runtimeEnv = getEnv()) {
  const collection = directusCollection("events", runtimeEnv);
  const id = await findDirectusEventId(slug, runtimeEnv);
  if (!id) {
    return false;
  }

  await directusFetch<unknown>(
    `/items/${collection}/${encodeURIComponent(String(id))}`,
    {
      method: "DELETE"
    },
    runtimeEnv
  );
  return true;
}

async function readDirectusSubscriptions(eventSlug?: string, runtimeEnv = getEnv()) {
  const collection = directusCollection("subscriptions", runtimeEnv);
  const filter = eventSlug
    ? `?filter[event_slug][_eq]=${encodeURIComponent(eventSlug)}`
    : "";
  return directusFetch<EventSubscription[]>(`/items/${collection}${filter}`, {}, runtimeEnv);
}

async function writeDirectusSubscription(record: EventSubscription, runtimeEnv = getEnv()) {
  const collection = directusCollection("subscriptions", runtimeEnv);
  return directusFetch<EventSubscription>(
    `/items/${collection}`,
    {
      method: "POST",
      body: JSON.stringify(record)
    },
    runtimeEnv
  );
}

export async function readSubmittedEvents(): Promise<SubmittedEvent[]> {
  const runtimeEnv = getEnv();
  const mode = getMode(runtimeEnv);

  if (mode === "kv") {
    if (!runtimeEnv.ACTIVITY_KV) {
      throw new Error("ACTIVITY_KV binding is not configured");
    }
    return listJsonFromKv<SubmittedEvent>(runtimeEnv.ACTIVITY_KV, eventKeyPrefix);
  }

  if (mode === "directus") {
    return readDirectusEvents(runtimeEnv);
  }

  return Array.from(memoryEvents.values()).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export async function findSubmittedEvent(slug: string) {
  const runtimeEnv = getEnv();
  const mode = getMode(runtimeEnv);

  if (mode === "kv") {
    return runtimeEnv.ACTIVITY_KV?.get<SubmittedEvent>(`${eventKeyPrefix}${slug}`, "json") ?? null;
  }

  const events = await readSubmittedEvents();
  return events.find((event) => event.slug === slug) ?? null;
}

export async function createAndStoreSubmittedEvent(input: SubmittedEventInput) {
  const runtimeEnv = getEnv();
  const event = createSubmittedEvent(input);
  const mode = getMode(runtimeEnv);

  if (mode === "kv") {
    if (!runtimeEnv.ACTIVITY_KV) {
      throw new Error("ACTIVITY_KV binding is not configured");
    }
    await runtimeEnv.ACTIVITY_KV.put(`${eventKeyPrefix}${event.slug}`, JSON.stringify(event));
    return event;
  }

  if (mode === "directus") {
    return writeDirectusEvent(event, runtimeEnv);
  }

  memoryEvents.set(event.slug, event);
  return event;
}

export function isStaticEventSlug(slug: string) {
  return eventCards.some((event) => event.slug === slug);
}

export async function deleteSubmittedEvent(slug: string) {
  const runtimeEnv = getEnv();
  const mode = getMode(runtimeEnv);

  if (mode === "kv") {
    if (!runtimeEnv.ACTIVITY_KV) {
      throw new Error("ACTIVITY_KV binding is not configured");
    }
    const key = `${eventKeyPrefix}${slug}`;
    const existing = await runtimeEnv.ACTIVITY_KV.get(key);
    if (!existing) {
      return { deleted: false, storage: mode };
    }
    await runtimeEnv.ACTIVITY_KV.delete(key);
    return { deleted: true, storage: mode };
  }

  if (mode === "directus") {
    const deleted = await deleteDirectusEvent(slug, runtimeEnv);
    return { deleted, storage: mode };
  }

  const deleted = memoryEvents.delete(slug);
  return { deleted, storage: mode };
}

export async function readSubscriptions(eventSlug?: string): Promise<EventSubscription[]> {
  const runtimeEnv = getEnv();
  const mode = getMode(runtimeEnv);

  if (mode === "kv") {
    if (!runtimeEnv.ACTIVITY_KV) {
      throw new Error("ACTIVITY_KV binding is not configured");
    }

    const prefix = eventSlug
      ? `${subscriptionKeyPrefix}${encodeKeyPart(eventSlug)}:`
      : subscriptionKeyPrefix;
    return listJsonFromKv<EventSubscription>(runtimeEnv.ACTIVITY_KV, prefix);
  }

  if (mode === "directus") {
    return readDirectusSubscriptions(eventSlug, runtimeEnv);
  }

  const subscriptions = Array.from(memorySubscriptions.values());
  return eventSlug
    ? subscriptions.filter((record) => record.event_slug === eventSlug)
    : subscriptions;
}

export async function createAndStoreSubscription(input: Record<string, unknown>) {
  const runtimeEnv = getEnv();
  const record = createSubscription(input);
  const mode = getMode(runtimeEnv);

  if (mode === "kv") {
    if (!runtimeEnv.ACTIVITY_KV) {
      throw new Error("ACTIVITY_KV binding is not configured");
    }
    await runtimeEnv.ACTIVITY_KV.put(subscriptionKey(record), JSON.stringify(record));
    return record;
  }

  if (mode === "directus") {
    return writeDirectusSubscription(record, runtimeEnv);
  }

  memorySubscriptions.set(subscriptionKey(record), record);
  return record;
}

export async function listEventsWithSubmissions() {
  const submittedEvents = await readSubmittedEvents();
  return [...submittedEvents, ...eventCards];
}

export async function readOrganizerContactCard(
  eventSlug: string,
  organizerName = "绒屿"
): Promise<OrganizerContactCard> {
  const runtimeEnv = getEnv();
  if (runtimeEnv.DIRECTUS_URL) {
    try {
      const card = await readDirectusOrganizerContactCard(eventSlug, runtimeEnv);
      if (card) {
        return {
          ...organizerContactFallback(eventSlug, organizerName, runtimeEnv),
          ...card,
          qr_image_url:
            cleanString(card.qr_image_url) ||
            cleanString(runtimeEnv.DEFAULT_ORGANIZER_QR_IMAGE_URL)
        };
      }
    } catch {
      // Keep the page renderable if Directus is unreachable or the model is not bootstrapped yet.
    }
  }

  return organizerContactFallback(eventSlug, organizerName, runtimeEnv);
}
