import {
  createD1ConnectionStore,
  createD1OAuthTransactionStore,
  decryptOAuthVerifier,
  encryptConnectionCredentials,
  hashOAuthState,
  INTEGRATION_PROVIDERS,
  type D1ConnectionDatabase,
  type D1OAuthTransactionDatabase,
  type IntegrationProviderId,
} from "./integration-hub";
import { createD1SessionStore, readSessionCookie } from "./session-auth";

type OAuthCallbackDatabase = D1ConnectionDatabase & D1OAuthTransactionDatabase & Parameters<typeof createD1SessionStore>[0];
export type OAuthCallbackEnv = {
  ACTION_DB?: OAuthCallbackDatabase;
  OAUTH_ENCRYPTION_KEY?: string;
  [key: string]: unknown;
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const TOKEN_HOSTS: Record<IntegrationProviderId, readonly string[]> = {
  linkedin: ["www.linkedin.com"],
  instagram: ["graph.facebook.com"],
  facebook: ["graph.facebook.com"],
  youtube: ["oauth2.googleapis.com"],
  x: ["api.x.com"],
  tiktok: ["open.tiktokapis.com"],
  github: ["github.com"],
  "google-drive": ["oauth2.googleapis.com"],
  gmail: ["oauth2.googleapis.com"],
  "google-calendar": ["oauth2.googleapis.com"],
  slack: ["slack.com"],
  discord: ["discord.com"],
  notion: ["api.notion.com"],
  telegram: [],
};
function envString(env: OAuthCallbackEnv, key: string): string | undefined {
  const value = env[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function decodeKey(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error("Invalid OAuth encryption key.");
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=");
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function prefix(provider: IntegrationProviderId): string {
  return provider.replace(/-/g, "_").toUpperCase();
}

/** Consumes one-time state, verifies session/workspace binding, exchanges the code and stores only encrypted credentials. */
export async function handleOAuthCallbackRequest(
  request: Request,
  env: OAuthCallbackEnv,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const database = env.ACTION_DB;
  const encryptionKey = env.OAUTH_ENCRYPTION_KEY;
  if (!database || !encryptionKey) return json({ error: "OAuth callback service is not configured." }, 503);
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ error: "Authentication required." }, 401);

  try {
    const now = new Date().toISOString();
    const session = await createD1SessionStore(database).getActive(token, now);
    if (!session?.workspaceId) return json({ error: "Active workspace session required." }, 401);

    const url = new URL(request.url);
    const state = url.searchParams.get("state") ?? "";
    if (!/^[A-Za-z0-9_-]{32,200}$/.test(state)) return json({ error: "OAuth state is missing or invalid." }, 400);
    const transaction = await createD1OAuthTransactionStore(database).consume(await hashOAuthState(state), now);
    if (!transaction) return json({ error: "OAuth transaction is expired, invalid or already consumed." }, 400);
    if (transaction.userId !== session.userId || transaction.workspaceId !== session.workspaceId) {
      return json({ error: "OAuth transaction belongs to a different user or workspace." }, 403);
    }

    const provider = transaction.provider;
    const providerConfig = INTEGRATION_PROVIDERS[provider];
    const providerPrefix = prefix(provider);
    const redirectUri = envString(env, "OAUTH_" + providerPrefix + "_REDIRECT_URI");
    const registeredRedirectUri = envString(env, "OAUTH_" + providerPrefix + "_REGISTERED_REDIRECT_URI");
    const clientId = envString(env, "OAUTH_" + providerPrefix + "_CLIENT_ID");
    const clientSecret = envString(env, "OAUTH_" + providerPrefix + "_CLIENT_SECRET");
    const tokenEndpoint = envString(env, "OAUTH_" + providerPrefix + "_TOKEN_ENDPOINT");
    if (!redirectUri || !registeredRedirectUri || !clientId || !clientSecret || !tokenEndpoint ||
        redirectUri !== registeredRedirectUri || transaction.redirectUri !== redirectUri) {
      return json({ error: "OAuth provider token configuration is incomplete or mismatched." }, 503);
    }
    const expectedRedirect = new URL(redirectUri);
    if (expectedRedirect.origin !== url.origin || expectedRedirect.pathname !== url.pathname ||
        expectedRedirect.search || expectedRedirect.hash) {
      return json({ error: "OAuth callback URL does not match the registered redirect." }, 400);
    }
    if (providerConfig.auth !== "oauth2" || transaction.scopes.length === 0 ||
        transaction.scopes.some((scope) => !providerConfig.allowedScopes.includes(scope))) {
      return json({ error: "OAuth transaction contains unsupported scopes." }, 400);
    }
    if (url.searchParams.has("error")) return json({ error: "Provider authorization was denied." }, 400);
    const code = url.searchParams.get("code") ?? "";
    if (!code || code.length > 2000) return json({ error: "OAuth authorization code is missing or invalid." }, 400);

    const endpoint = new URL(tokenEndpoint);
    if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.hash ||
        !TOKEN_HOSTS[provider].includes(endpoint.hostname)) {
      return json({ error: "OAuth token endpoint is not approved for this provider." }, 400);
    }
    const key = decodeKey(encryptionKey);
    if (key.byteLength !== 32) return json({ error: "OAuth encryption key must be 256 bits." }, 503);
    const verifier = await decryptOAuthVerifier({
      blob: transaction.encryptedVerifierBlob,
      key,
      provider,
      userId: session.userId,
      workspaceId: session.workspaceId,
    });

    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    });
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    });
    if (envString(env, "OAUTH_" + providerPrefix + "_CLIENT_AUTH_METHOD") === "basic") {
      headers.set("Authorization", "Basic " + btoa(clientId + ":" + clientSecret));
    } else {
      form.set("client_secret", clientSecret);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let providerResponse: Response;
    try {
      providerResponse = await fetcher(endpoint.toString(), {
        method: "POST",
        headers,
        body: form.toString(),
        signal: controller.signal,
        redirect: "error",
      });
    } finally {
      clearTimeout(timeout);
    }
    const raw = await providerResponse.text();
    if (!providerResponse.ok || raw.length > 16_384) {
      return json({ error: "Provider token exchange failed." }, 502);
    }
    let payload: unknown;
    try { payload = JSON.parse(raw); } catch { return json({ error: "Provider token response was invalid." }, 502); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      return json({ error: "Provider token response was invalid." }, 502);
    }
    const tokenData = payload as Record<string, unknown>;
    const accessToken = tokenData["access_token"];
    const refreshToken = tokenData["refresh_token"];
    const tokenType = tokenData["token_type"];
    if (typeof accessToken !== "string" || !accessToken || accessToken.length > 10_000 ||
        (refreshToken !== undefined && (typeof refreshToken !== "string" || refreshToken.length > 10_000))) {
      return json({ error: "Provider did not return a valid access token." }, 502);
    }
    const grantedScopes = typeof tokenData["scope"] === "string" && tokenData["scope"].trim()
      ? tokenData["scope"].trim().split(/\s+/)
      : transaction.scopes;
    if (transaction.scopes.some((scope) => !grantedScopes.includes(scope))) {
      return json({ error: "Provider did not grant all requested scopes." }, 403);
    }
    const expiresIn = tokenData["expires_in"] === undefined ? null : Number(tokenData["expires_in"]);
    if (expiresIn !== null && (!Number.isFinite(expiresIn) || expiresIn < 60 || expiresIn > 31_536_000)) {
      return json({ error: "Provider token expiry was invalid." }, 502);
    }
    const tokenExpiresAt = expiresIn === null ? null : new Date(Date.parse(now) + expiresIn * 1000).toISOString();
    const encryptedTokenBlob = await encryptConnectionCredentials({
      credentials: {
        accessToken,
        refreshToken: typeof refreshToken === "string" ? refreshToken : null,
        tokenType: typeof tokenType === "string" && tokenType.length <= 40 ? tokenType : "Bearer",
        createdAt: now,
      },
      key,
      provider,
      userId: session.userId,
      workspaceId: session.workspaceId,
    });
    const connectionId = crypto.randomUUID().replace(/-/g, "");
    await createD1ConnectionStore(database).create({
      id: connectionId,
      workspaceId: session.workspaceId,
      userId: session.userId,
      provider,
      scopes: grantedScopes,
      encryptedTokenBlob,
      tokenExpiresAt,
      createdAt: now,
      updatedAt: now,
    });

    const destination = new URL("/settings/integrations", request.url);
    destination.searchParams.set("connected", provider);
    return Response.redirect(destination.toString(), 303);
  } catch {
    return json({ error: "OAuth callback failed; restart the connection flow." }, 502);
  }
}
