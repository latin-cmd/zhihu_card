import { env } from "cloudflare:workers";

type RuntimeEnv = Env & Record<string, unknown>;

function runtimeEnv() { return env as RuntimeEnv; }

const stateCookie = "__Host-zhihu_oauth_state";
const pendingTokenCookie = "__Host-zhihu_oauth_pending";
const stateLifetimeSeconds = 600;
const pendingTokenLifetimeSeconds = 300;

function callbackUrl(request: Request) {
  return new URL("/auth/zhihu/callback", new URL(request.url).origin).toString();
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function cookieValue(request: Request, name: string) {
  for (const item of (request.headers.get("cookie") ?? "").split(";")) {
    const separator = item.indexOf("=");
    if (separator !== -1 && item.slice(0, separator).trim() === name) {
      return decodeURIComponent(item.slice(separator + 1).trim());
    }
  }
  return "";
}

// SameSite=Lax (not Strict): the callback arrives as a top-level GET navigation
// from openapi.zhihu.com, and Strict cookies aren't sent on cross-site navigation.
function secureCookie(name: string, value: string, maxAge: number) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookie(name: string) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function redirectTo(location: string, extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders);
  headers.set("Location", location);
  return new Response(null, { status: 302, headers });
}

/**
 * Step 1 of https://developer.zhihu.com/docs?key=zhihu_oauth_integrated:
 * send the user to Zhihu's authorize page. `state` is our own CSRF guard,
 * not part of Zhihu's documented flow, mirroring what other integrators do.
 */
export function startZhihuOAuth(request: Request) {
  const appId = runtimeEnv().ZHIHU_OAUTH_APP_ID;
  if (!appId) {
    return Response.json({ error: "ZHIHU_OAUTH_APP_ID is not configured" }, { status: 503 });
  }

  const state = bytesToHex(crypto.getRandomValues(new Uint8Array(24)));
  const authorizeUrl = new URL("https://openapi.zhihu.com/authorize");
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl(request));
  authorizeUrl.searchParams.set("app_id", appId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("state", state);

  return redirectTo(authorizeUrl.toString(), { "Set-Cookie": secureCookie(stateCookie, state, stateLifetimeSeconds) });
}

/**
 * Steps 2-3: Zhihu redirects back with `authorization_code` (+ our `state`),
 * then we exchange it server-side for an access_token via POST /access_token.
 * Binding the resulting token to a local user/Card Space is intentionally
 * left as a TODO — that logic will be wired up separately.
 */
export async function completeZhihuOAuth(request: Request) {
  const url = new URL(request.url);
  const authorizationCode = url.searchParams.get("authorization_code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const expectedState = cookieValue(request, stateCookie);
  const clearState = clearCookie(stateCookie);

  if (!authorizationCode || !state || !expectedState || state !== expectedState) {
    return redirectTo("/credentials/zhihu?oauth_error=state", { "Set-Cookie": clearState });
  }

  const appId = runtimeEnv().ZHIHU_OAUTH_APP_ID;
  const appKey = runtimeEnv().ZHIHU_OAUTH_APP_KEY;
  if (!appId || !appKey) {
    return redirectTo("/credentials/zhihu?oauth_error=not_configured", { "Set-Cookie": clearState });
  }

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch("https://openapi.zhihu.com/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        app_id: appId,
        app_key: appKey,
        grant_type: "authorization_code",
        redirect_uri: callbackUrl(request),
        code: authorizationCode
      }),
      signal: AbortSignal.timeout(15_000)
    });
  } catch {
    return redirectTo("/credentials/zhihu?oauth_error=token_exchange", { "Set-Cookie": clearState });
  }

  if (!tokenResponse.ok) {
    return redirectTo("/credentials/zhihu?oauth_error=token_exchange", { "Set-Cookie": clearState });
  }

  const payload = await tokenResponse.json() as { access_token?: string; token_type?: string; expires_in?: number };
  if (!payload.access_token) {
    return redirectTo("/credentials/zhihu?oauth_error=token_exchange", { "Set-Cookie": clearState });
  }

  // TODO: bind this access_token to a user / Card Space instead of just staging it.
  const headers = new Headers();
  headers.append("Set-Cookie", clearState);
  headers.append("Set-Cookie", secureCookie(pendingTokenCookie, JSON.stringify(payload), pendingTokenLifetimeSeconds));
  headers.set("Location", "/credentials/zhihu?oauth=pending");
  return new Response(null, { status: 302, headers });
}
