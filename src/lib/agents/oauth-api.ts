import {
  createD1OAuthTransactionStore,
  createOAuthAuthorizationUrl,
  encryptOAuthVerifier,
  generateOAuthPkcePair,
  generateOAuthState,
  hashOAuthState,
  INTEGRATION_PROVIDERS,
  type D1OAuthTransactionDatabase,
  type IntegrationProviderId,
} from "./integration-hub";
import { createD1SessionStore, readSessionCookie } from "./session-auth";

type OAuthApiDatabase = D1OAuthTransactionDatabase & Parameters<typeof createD1SessionStore>[0];
export type OAuthApiEnv = {
  ACTION_DB?: OAuthApiDatabase;
  OAUTH_ENCRYPTION_KEY?: string;
  [key: string]: unknown;
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function envString(env: OAuthApiEnv, key: string): string | undefined {
  const value = env[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function decodeEncryptionKey(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{43,44}$/.test(value)) throw new Error("OAuth encryption key encoding is invalid.");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
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
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

/** Starts only preconfigured OAuth providers; credentials and verifier encryption remain server-side. */
export async function handleOAuthStartRequest(request: Request, env: OAuthApiEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return json({ error: "Cross-origin OAuth starts are blocked." }, 403);
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return json({ error: "JSON content type is required." }, 415);
  }
  const database = env.ACTION_DB;
  const encryptionKey = env.OAUTH_ENCRYPTION_KEY;
  if (!database || !encryptionKey) return json({ error: "OAuth storage or encryption is not configured." }, 503);
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ error: "Authentication required." }, 401);

  try {
    const body = await readBody(request);
    if (!isRecord(body) || typeof body["provider"] !== "string" ||
        !Object.prototype.hasOwnProperty.call(INTEGRATION_PROVIDERS, body["provider"])) {
      return json({ error: "Unsupported OAuth provider." }, 400);
    }
    const provider = body["provider"] as IntegrationProviderId;
    const definition = INTEGRATION_PROVIDERS[provider];
    if (definition.auth !== "oauth2" || definition.allowedScopes.length === 0) {
      return json({ error: "Provider OAuth scopes are not approved/configured." }, 400);
    }
    const prefix = provider.replace(/-/g, "_").toUpperCase();
    const clientId = envString(env, "OAUTH_" + prefix + "_CLIENT_ID");
    const authorizationEndpoint = envString(env, "OAUTH_" + prefix + "_AUTHORIZATION_ENDPOINT");
    const redirectUri = envString(env, "OAUTH_" + prefix + "_REDIRECT_URI");
    const registeredRedirectUri = envString(env, "OAUTH_" + prefix + "_REGISTERED_REDIRECT_URI");
    if (!clientId || !authorizationEndpoint || !redirectUri || !registeredRedirectUri) {
      return json({ error: "OAuth provider configuration is incomplete." }, 503);
    }

    const now = new Date().toISOString();
    const session = await createD1SessionStore(database).getActive(token, now);
    if (!session) return json({ error: "Active session required." }, 401);
    const key = decodeEncryptionKey(encryptionKey);
    if (key.byteLength !== 32) return json({ error: "OAuth encryption key must be 256 bits." }, 503);

    const state = generateOAuthState();
    const pkce = await generateOAuthPkcePair();
    const expiresAt = new Date(Date.parse(now) + 10 * 60 * 1000).toISOString();
    const encryptedVerifierBlob = await encryptOAuthVerifier({ verifier: pkce.verifier, key, provider, userId: session.userId });
    const authorizationUrl = createOAuthAuthorizationUrl({
      provider,
      authorizationEndpoint,
      clientId,
      redirectUri,
      registeredRedirectUri,
      scopes: definition.allowedScopes,
      state,
      codeChallenge: pkce.challenge,
    });
    await createD1OAuthTransactionStore(database).create({
      stateHash: await hashOAuthState(state),
      provider,
      userId: session.userId,
      redirectUri,
      encryptedVerifierBlob,
      scopes: [...definition.allowedScopes],
      expiresAt,
      createdAt: now,
    });
    return new Response(null, {
      status: 302,
      headers: { Location: authorizationUrl, "Cache-Control": "no-store" },
    });
  } catch {
    return json({ error: "OAuth authorization could not be started." }, 400);
  }
}
