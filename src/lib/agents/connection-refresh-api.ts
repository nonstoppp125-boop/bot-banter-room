import {
  createD1ConnectionStore,
  decryptConnectionCredentials,
  encryptConnectionCredentials,
  INTEGRATION_PROVIDERS,
  type D1ConnectionDatabase,
  type IntegrationProviderId,
} from "./integration-hub";
import { createD1SessionStore, readSessionCookie } from "./session-auth";

type RefreshDatabase = D1ConnectionDatabase & Parameters<typeof createD1SessionStore>[0];
export type ConnectionRefreshEnv = {
  ACTION_DB?: RefreshDatabase;
  OAUTH_ENCRYPTION_KEY?: string;
  [key: string]: unknown;
};
const TOKEN_HOSTS: Record<IntegrationProviderId, readonly string[]> = {
  linkedin: ["www.linkedin.com"], instagram: ["graph.facebook.com"], facebook: ["graph.facebook.com"],
  youtube: ["oauth2.googleapis.com"], x: ["api.x.com"], tiktok: ["open.tiktokapis.com"],
  github: ["github.com"], "google-drive": ["oauth2.googleapis.com"], gmail: ["oauth2.googleapis.com"],
  "google-calendar": ["oauth2.googleapis.com"], slack: ["slack.com"], discord: ["discord.com"],
  notion: ["api.notion.com"], telegram: [],
};
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
function envString(env: ConnectionRefreshEnv, key: string): string | undefined {
  const value = env[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function decodeKey(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error("Invalid OAuth encryption key.");
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=");
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
async function readBody(request: Request): Promise<unknown | null> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > 2048) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > 2048) { void reader.cancel().catch(() => undefined); return null; }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
  finally { reader.releaseLock(); }
}

/** User-triggered refresh for an owned connection; credentials remain encrypted at rest. */
export async function handleConnectionRefreshRequest(
  request: Request,
  env: ConnectionRefreshEnv,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return json({ error: "Cross-origin integration changes are blocked." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return json({ error: "JSON content type is required." }, 415);
  const database = env.ACTION_DB;
  const keyText = env.OAUTH_ENCRYPTION_KEY;
  if (!database || !keyText) return json({ error: "Connection refresh service is not configured." }, 503);
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ error: "Authentication required." }, 401);

  try {
    const now = new Date().toISOString();
    const session = await createD1SessionStore(database).getActive(token, now);
    if (!session?.workspaceId) return json({ error: "Active workspace session required." }, 401);
    const body = await readBody(request);
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        typeof (body as Record<string, unknown>)["connectionId"] !== "string") return json({ error: "A valid connection ID is required." }, 400);
    const connectionId = (body as Record<string, string>)["connectionId"];
    const store = createD1ConnectionStore(database);
    const connection = await store.getOwned({ id: connectionId, workspaceId: session.workspaceId, userId: session.userId });
    if (!connection) return json({ error: "Connection was not found or is not owned by this user." }, 404);

    const providerPrefix = connection.provider.replace(/-/g, "_").toUpperCase();
    const clientId = envString(env, "OAUTH_" + providerPrefix + "_CLIENT_ID");
    const clientSecret = envString(env, "OAUTH_" + providerPrefix + "_CLIENT_SECRET");
    const tokenEndpoint = envString(env, "OAUTH_" + providerPrefix + "_TOKEN_ENDPOINT");
    if (!clientId || !clientSecret || !tokenEndpoint) return json({ error: "Provider refresh configuration is incomplete." }, 503);
    const endpoint = new URL(tokenEndpoint);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.hash ||
        !TOKEN_HOSTS[connection.provider].includes(endpoint.hostname)) return json({ error: "Provider token endpoint is not approved." }, 400);

    const key = decodeKey(keyText);
    const credentials = await decryptConnectionCredentials({
      blob: connection.encryptedTokenBlob, key, provider: connection.provider,
      userId: session.userId, workspaceId: session.workspaceId,
    });
    if (!credentials.refreshToken) return json({ error: "This connection has no refresh token; reconnect the provider." }, 409);

    const form = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
      client_id: clientId,
    });
    const headers = new Headers({ Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" });
    if (envString(env, "OAUTH_" + providerPrefix + "_CLIENT_AUTH_METHOD") === "basic") {
      headers.set("Authorization", "Basic " + btoa(clientId + ":" + clientSecret));
    } else {
      form.set("client_secret", clientSecret);
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let response: Response;
    try {
      response = await fetcher(endpoint.toString(), { method: "POST", headers, body: form.toString(), signal: controller.signal });
    } finally { clearTimeout(timeout); }
    const raw = await response.text();
    if (!response.ok || raw.length > 16_384) return json({ error: "Provider token refresh failed." }, 502);
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return json({ error: "Provider token response was invalid." }, 502); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json({ error: "Provider token response was invalid." }, 502);
    const data = payload as Record<string, unknown>;
    const accessToken = data["access_token"];
    const nextRefresh = data["refresh_token"];
    if (typeof accessToken !== "string" || !accessToken || accessToken.length > 10_000 ||
        (nextRefresh !== undefined && (typeof nextRefresh !== "string" || nextRefresh.length > 10_000))) {
      return json({ error: "Provider did not return a valid refreshed access token." }, 502);
    }
    const scopes = typeof data["scope"] === "string" && data["scope"].trim()
      ? data["scope"].trim().split(/\s+/) : connection.scopes;
    if (connection.scopes.some((scope) => !scopes.includes(scope)) || scopes.some((scope) => !INTEGRATION_PROVIDERS[connection.provider].allowedScopes.includes(scope))) return json({ error: "Provider refresh returned insufficient or unapproved scopes." }, 403);
    const expiresIn = data["expires_in"] === undefined ? null : Number(data["expires_in"]);
    if (expiresIn !== null && (!Number.isFinite(expiresIn) || expiresIn < 60 || expiresIn > 31_536_000)) return json({ error: "Provider token expiry was invalid." }, 502);
    const tokenExpiresAt = expiresIn === null ? null : new Date(Date.parse(now) + expiresIn * 1000).toISOString();
    const encryptedTokenBlob = await encryptConnectionCredentials({
      credentials: {
        accessToken,
        refreshToken: typeof nextRefresh === "string" ? nextRefresh : credentials.refreshToken,
        tokenType: typeof data["token_type"] === "string" && data["token_type"].length <= 40 ? data["token_type"] : credentials.tokenType,
        createdAt: now,
      },
      key, provider: connection.provider, userId: session.userId, workspaceId: session.workspaceId,
    });
    const updated = await store.updateCredentials({
      id: connection.id, workspaceId: session.workspaceId, userId: session.userId,
      scopes, encryptedTokenBlob, tokenExpiresAt, now,
    });
    if (!updated) return json({ error: "Connection changed during refresh; retry after reloading." }, 409);
    return json({ refreshed: true, tokenExpiresAt });
  } catch {
    return json({ error: "Connection refresh failed; reconnect the provider if necessary." }, 502);
  }
}
