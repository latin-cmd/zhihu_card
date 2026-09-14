/// <reference types="@astrojs/cloudflare" />
/// <reference types="@cloudflare/workers-types" />

interface Env {
  ZHIHU_CREDENTIALS_KV?: KVNamespace;
  CARD_SPACE_DB?: D1Database;
  CARD_VAULT_SECRET?: string;
  PUBLIC_ASSETS?: R2Bucket;
  DEFAULT_ORGANIZER_QR_IMAGE_URL?: string;
  BACKOFFICE_API_TOKEN?: string;
  ZHIHU_OAUTH_APP_ID?: string;
  ZHIHU_OAUTH_APP_KEY?: string;
}
