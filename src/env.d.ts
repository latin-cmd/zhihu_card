/// <reference types="@astrojs/cloudflare" />
/// <reference types="@cloudflare/workers-types" />

type ActivityStorageMode = "auto" | "kv" | "directus" | "memory";

interface Env {
  ACTIVITY_KV?: KVNamespace;
  PUBLIC_ASSETS?: R2Bucket;
  DIRECTUS_URL?: string;
  DIRECTUS_TOKEN?: string;
  DIRECTUS_EVENTS_COLLECTION?: string;
  DIRECTUS_SUBSCRIPTIONS_COLLECTION?: string;
  DIRECTUS_ORGANIZER_CONTACTS_COLLECTION?: string;
  DEFAULT_ORGANIZER_QR_IMAGE_URL?: string;
  ACTIVITY_STORAGE?: ActivityStorageMode;
  BACKOFFICE_API_TOKEN?: string;
}
