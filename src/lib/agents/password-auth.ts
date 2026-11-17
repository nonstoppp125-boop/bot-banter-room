import {
  clearSessionCookie, createD1SessionStore, createSessionCookie, generateSessionToken,
  hashSessionToken, readSessionCookie, type D1SessionDatabase,
} from "./session-auth";
import { createD1WorkspaceAccessStore } from "./workspace-store";

type AuthDatabase = D1SessionDatabase & {
  prepare: (query: string) => { bind: (...values: unknown[]) => {
    run: () => Promise<{ success?: boolean; meta?: { changes?: number } }>;
    first: <T = Record<string, unknown>>() => Promise<T | null>;
  }};
};
export type PasswordAuthEnv = {
  ACTION_DB?: AuthDatabase;
  LIZA_AUTH_EMAIL?: string;
  LIZA_AUTH_PASSWORD_HASH?: string;
};
const json = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "no-store", "Vary": "Cookie" },
});
const EMAIL = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
const HASH = /^pbkdf2\\$310000\\$([A-Za-z0-9_-]{22})\\$([A-Za-z0-9_-]{43})$/;
const MAX_LOGIN_BODY_BYTES = 4_096;
type LoginBodyResult = { ok: true; value: unknown } | { ok: false; status: 400 | 413 };
async function readLoginBody(request: Request): Promise<LoginBodyResult> {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    if (!/^\\d+$/.test(declared)) return { ok: false, status: 400 };
    if (Number(declared) > MAX_LOGIN_BODY_BYTES) return { ok: false, status: 413 };
  }
  if (!request.body) return { ok: false, status: 400 };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_LOGIN_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
    if (!total) return { ok: false, status: 400 };
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) }; }
    catch { return { ok: false, status: 400 }; }
  } catch { return { ok: false, status: 400 }; }
  finally { reader.releaseLock(); }
}
function b64url(bytes: Uint8Array): string {
  let raw = ""; for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
}
function fromB64url(value: string): Uint8Array {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
async function sha256(value: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const match = encoded.match(HASH);
  if (!match || password.length < 1 || password.length > 256) return false;
  const salt = fromB64url(match[1]!);
  const expected = fromB64url(match[2]!);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const actual = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 310_000 }, key, 256,
  ));
  if (actual.length !== expected.length) return false;
  let difference = 0; for (let i = 0; i < actual.length; i++) difference |= actual[i]! ^ expected[i]!;
  return difference === 0;
}
async function provisionOwner(database: AuthDatabase, email: string): Promise<{ userId: string; workspaceId: string }> {
  const now = new Date().toISOString();
  const userId = "u_" + await sha256("liza-password-user:" + email);
  const workspaceId = "w_" + await sha256("liza-password-workspace:" + userId);
  await database.prepare(
    "INSERT INTO users (id,email,display_name,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,updated_at=excluded.updated_at",
  ).bind(userId, email, email.split("@")[0]!, now, now).run();
  const user = await database.prepare("SELECT id FROM users WHERE id=? AND email=? AND deleted_at IS NULL LIMIT 1")
    .bind(userId, email).first<{ id: string }>();
  if (!user?.id) throw new Error("Owner account provisioning failed.");
  await database.prepare(
    "INSERT OR IGNORE INTO workspaces (id,owner_user_id,name,created_at,updated_at) VALUES (?,?,?,?,?)",
  ).bind(workspaceId, userId, "Liza Workspace", now, now).run();
  await database.prepare(
    "INSERT OR IGNORE INTO workspace_members (workspace_id,user_id,role,created_at) VALUES (?,?,'owner',?)",
  ).bind(workspaceId, userId, now).run();
  return { userId, workspaceId };
}
function configured(env: PasswordAuthEnv): { email: string; passwordHash: string } | null {
  const email = env.LIZA_AUTH_EMAIL?.trim().toLowerCase();
  const passwordHash = env.LIZA_AUTH_PASSWORD_HASH?.trim();
  return email && EMAIL.test(email) && passwordHash && HASH.test(passwordHash) ? { email, passwordHash } : null;
}
async function issueSession(request: Request, env: PasswordAuthEnv, email: string): Promise<Response> {
  if (!env.ACTION_DB) return json({ error: "Session storage is unavailable." }, 503);
  const { userId, workspaceId } = await provisionOwner(env.ACTION_DB, email);
  const now = new Date().toISOString();
  const token = generateSessionToken();
  const expiresAt = new Date(Date.parse(now) + 12 * 60 * 60 * 1000).toISOString();
  await createD1SessionStore(env.ACTION_DB).create({
    id: "s_" + crypto.randomUUID().replace(/-/g, ""),
    userId, workspaceId, tokenHash: await hashSessionToken(token), createdAt: now, expiresAt,
  });
  return new Response(null, { status: 204, headers: {
    "Set-Cookie": createSessionCookie(token, 12 * 60 * 60),
    "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
  }});
}
export async function handlePasswordLogin(request: Request, env: PasswordAuthEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Cross-origin login is blocked." }, 403);
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") return json({ error: "JSON content type is required." }, 415);
  const auth = configured(env);
  if (!auth || !env.ACTION_DB) return json({ error: "Password login is not configured." }, 503);
  const parsed = await readLoginBody(request);
  if (!parsed.ok) return json({ error: parsed.status === 413 ? "Login request is too large." : "Invalid login request." }, parsed.status);
  const input = parsed.value as { email?: unknown; password?: unknown } | null;
  if (!input || typeof input.email !== "string" || typeof input.password !== "string" ||
      input.email.length > 254 || input.password.length > 256) return json({ error: "Invalid email or password." }, 400);
  try {
    const key = await sha256(auth.email);
    const now = new Date().toISOString();
    await env.ACTION_DB.prepare(
      "INSERT INTO auth_login_attempts (email_hash,window_started_at,attempts) VALUES (?,?,1) ON CONFLICT(email_hash) DO UPDATE SET attempts=CASE WHEN window_started_at < ? THEN 1 ELSE attempts+1 END,window_started_at=CASE WHEN window_started_at < ? THEN excluded.window_started_at ELSE window_started_at END",
    ).bind(key, now, new Date(Date.now() - 15 * 60_000).toISOString(), new Date(Date.now() - 15 * 60_000).toISOString()).run();
    const attempts = await env.ACTION_DB.prepare("SELECT attempts FROM auth_login_attempts WHERE email_hash=? LIMIT 1")
      .bind(key).first<{ attempts: number }>();
    if ((attempts?.attempts ?? 0) > 5) return json({ error: "Too many login attempts. Try again in 15 minutes." }, 429);
    const validEmail = input.email.trim().toLowerCase() === auth.email;
    const validPassword = await verifyPassword(input.password, auth.passwordHash);
    if (!validEmail || !validPassword) return json({ error: "Email or password is incorrect." }, 401);
    await env.ACTION_DB.prepare("DELETE FROM auth_login_attempts WHERE email_hash=?").bind(key).run();
    return await issueSession(request, env, auth.email);
  } catch { return json({ error: "Login could not be completed." }, 500); }
}
export async function handleSessionStatus(request: Request, env: PasswordAuthEnv): Promise<Response> {
  if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
  if (!env.ACTION_DB) return json({ error: "Session storage is unavailable." }, 503);
  const token = readSessionCookie(request.headers.get("cookie"));
  if (!token) return json({ authenticated: false }, 401);
  try {
    const session = await createD1SessionStore(env.ACTION_DB).getActive(token, new Date().toISOString());
    if (!session?.workspaceId) return json({ authenticated: false }, 401);
    const membership = await createD1WorkspaceAccessStore(env.ACTION_DB).getMembership(session.workspaceId, session.userId);
    return membership ? json({ authenticated: true }) : json({ authenticated: false }, 401);
  } catch { return json({ error: "Session lookup failed." }, 500); }
}
export async function handleSessionLogout(request: Request, env: PasswordAuthEnv): Promise<Response> {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "Cross-origin logout is blocked." }, 403);
  if (!env.ACTION_DB) return json({ error: "Session storage is unavailable." }, 503);
  const token = readSessionCookie(request.headers.get("cookie"));
  try {
    if (token) await createD1SessionStore(env.ACTION_DB).revoke(token, new Date().toISOString());
    return new Response(null, { status: 204, headers: { "Set-Cookie": clearSessionCookie(), "Cache-Control": "no-store" } });
  } catch { return json({ error: "Logout could not be completed." }, 500); }
}
