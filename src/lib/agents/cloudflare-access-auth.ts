import {
  clearSessionCookie,
  createD1SessionStore,
  createSessionCookie,
  generateSessionToken,
  hashSessionToken,
  readSessionCookie,
  type D1SessionDatabase,
} from "./session-auth";

type AuthDatabase = D1SessionDatabase & {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<{ success?: boolean; meta?: { changes?: number } }>;
      first: <T = Record<string, unknown>>() => Promise<T | null>;
    };
  };
};
export type CloudflareAccessAuthEnv = {
  ACTION_DB?: AuthDatabase;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  CF_ACCESS_ALLOWED_EMAIL_DOMAINS?: string;
};
export type CloudflareAccessIdentity = {
  subject: string;
  email: string;
  name: string;
};
type JwtHeader = { alg?: unknown; kid?: unknown; typ?: unknown };
type AccessJwk = JsonWebKey & { kid?: string; use?: string; alg?: string };
type JwtClaims = { iss?: unknown; aud?: unknown; sub?: unknown; email?: unknown; name?: unknown; exp?: unknown; nbf?: unknown; iat?: unknown };

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", Vary: "Cookie" } });

function decodeBase64Url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid JWT encoding.");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}
function parseJsonPart<T>(part: string): T {
  return JSON.parse(new TextDecoder().decode(decodeBase64Url(part))) as T;
}
function validTeamDomain(value: string): boolean {
  return value.length <= 253 && /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(value) &&
    !value.includes("..") && !value.includes("/") && !value.includes(":");
}
async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Verifies Cloudflare Access RS256 assertion, issuer, audience, key ID and time claims. */
export async function verifyCloudflareAccessAssertion(input: {
  token: string;
  teamDomain: string;
  audience: string;
  nowSeconds?: number;
  fetcher?: typeof fetch;
}): Promise<CloudflareAccessIdentity> {
  if (!validTeamDomain(input.teamDomain) || !input.audience.trim() ||
      input.token.length > 16_384) throw new Error("Cloudflare Access configuration or token is invalid.");
  const parts = input.token.split(".");
  if (parts.length !== 3) throw new Error("Cloudflare Access assertion is malformed.");
  const header = parseJsonPart<JwtHeader>(parts[0]!);
  const claims = parseJsonPart<JwtClaims>(parts[1]!);
  if (header.alg !== "RS256" || typeof header.kid !== "string" || header.kid.length > 256) {
    throw new Error("Cloudflare Access signing algorithm or key ID is invalid.");
  }
  const fetcher = input.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  let response: Response;
  try {
    response = await fetcher("https://" + input.teamDomain + "/cdn-cgi/access/certs", {
      headers: { Accept: "application/json" }, signal: controller.signal, redirect: "error",
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error("Cloudflare Access signing keys are unavailable.");
  const jwks = await response.json() as { keys?: AccessJwk[] };
  if (!Array.isArray(jwks.keys) || jwks.keys.length > 50) throw new Error("Cloudflare Access key set is invalid.");
  const jwk = jwks.keys.find((key) => key.kid === header.kid && key.kty === "RSA" && key.use === "sig" && key.alg === "RS256");
  if (!jwk) throw new Error("Cloudflare Access signing key was not found.");
  const publicKey = await crypto.subtle.importKey(
    "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"],
  );
  const signed = new TextEncoder().encode(parts[0] + "." + parts[1]);
  const validSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5", publicKey, toArrayBuffer(decodeBase64Url(parts[2]!)), signed,
  );
  if (!validSignature) throw new Error("Cloudflare Access assertion signature is invalid.");

  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== "https://" + input.teamDomain || !audience.includes(input.audience) ||
      typeof claims.sub !== "string" || !claims.sub.trim() || claims.sub.length > 256 ||
      typeof claims.email !== "string" || claims.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email) ||
      typeof claims.exp !== "number" || claims.exp <= now ||
      claims.exp > now + 86_400 ||
      (typeof claims.nbf === "number" && claims.nbf > now + 60) ||
      (typeof claims.iat === "number" && (claims.iat > now + 60 || claims.iat < now - 86_400))) {
    throw new Error("Cloudflare Access assertion claims are invalid.");
  }
  const email = claims.email.trim().toLowerCase();
  const name = typeof claims.name === "string" && claims.name.trim()
    ? claims.name.trim().slice(0, 160) : email.split("@")[0]!.slice(0, 160);
  return { subject: claims.sub, email, name };
}

function isAllowedDomain(email: string, configured: string | undefined): boolean {
  if (!configured?.trim()) return true;
  const allowed = configured.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email.split("@")[1]!.toLowerCase());
}

export async function handleCloudflareAccessSessionRequest(
  request: Request,
  env: CloudflareAccessAuthEnv,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  const database = env.ACTION_DB;
  const teamDomain = env.CF_ACCESS_TEAM_DOMAIN?.trim().toLowerCase();
  const audience = env.CF_ACCESS_AUD?.trim();
  const assertion = request.headers.get("cf-access-jwt-assertion");
  if (!database || !teamDomain || !audience) return json({ error: "Cloudflare Access login is not configured." }, 503);
  if (!assertion) return json({ error: "Sign in through the configured Cloudflare Access application." }, 401);

  try {
    const identity = await verifyCloudflareAccessAssertion({ token: assertion, teamDomain, audience, fetcher });
    if (!isAllowedDomain(identity.email, env.CF_ACCESS_ALLOWED_EMAIL_DOMAINS)) {
      return json({ error: "This email domain is not allowed to access the workspace." }, 403);
    }
    const now = new Date().toISOString();
    const userId = "u_" + await sha256Hex("cloudflare-access:user:" + identity.subject);
    await database.prepare(
      "INSERT INTO users (id,email,display_name,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,updated_at=excluded.updated_at",
    ).bind(userId, identity.email, identity.name, now, now).run();
    const user = await database.prepare("SELECT id FROM users WHERE email=? AND deleted_at IS NULL LIMIT 1")
      .bind(identity.email).first<{ id: string }>();
    if (!user?.id) return json({ error: "User account could not be provisioned." }, 500);
    const workspaceId = "w_" + await sha256Hex("cloudflare-access:workspace:" + user.id);
    const workspaceName = identity.name.slice(0, 120) + "'s workspace";
    await database.prepare(
      "INSERT OR IGNORE INTO workspaces (id,owner_user_id,name,created_at,updated_at) VALUES (?,?,?,?,?)",
    ).bind(workspaceId, user.id, workspaceName, now, now).run();
    await database.prepare(
      "INSERT OR IGNORE INTO workspace_members (workspace_id,user_id,role,created_at) VALUES (?,?,'owner',?)",
    ).bind(workspaceId, user.id, now).run();

    const token = generateSessionToken();
    const expiresAt = new Date(Date.parse(now) + 8 * 60 * 60 * 1000).toISOString();
    await createD1SessionStore(database).create({
      id: "s_" + crypto.randomUUID().replace(/-/g, ""),
      userId: user.id,
      workspaceId,
      tokenHash: await hashSessionToken(token),
      expiresAt,
      createdAt: now,
    });
    return new Response(null, {
      status: 303,
      headers: {
        Location: new URL("/", request.url).toString(),
        "Set-Cookie": createSessionCookie(token, 8 * 60 * 60),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return json({ error: "Cloudflare Access sign-in could not be completed." }, 401);
  }
}

export async function handleSessionLogoutRequest(request: Request, env: CloudflareAccessAuthEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return json({ error: "Cross-origin logout is blocked." }, 403);
  if (!env.ACTION_DB) return json({ error: "Session storage is not configured." }, 503);
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
  try {
    await createD1SessionStore(env.ACTION_DB).revoke(token, new Date().toISOString());
    return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
  } catch {
    return json({ error: "Logout could not be completed." }, 500);
  }
}
