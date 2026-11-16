export interface SessionRecord {
  id: string;
  userId: string;
  workspaceId: string | null;
  expiresAt: string;
  createdAt: string;
}
export interface SessionCreateInput extends SessionRecord {
  tokenHash: string;
}
export type D1SessionDatabase = {
  prepare: (query: string) => {
    bind: (...values: unknown[]) => {
      run: () => Promise<{ success?: boolean; meta?: { changes?: number } }>;
      first: <T = Record<string, unknown>>() => Promise<T | null>;
    };
  };
};
export interface SessionStore {
  create(session: SessionCreateInput): Promise<void>;
  getActive(rawToken: string, now: string): Promise<SessionRecord | null>;
  revoke(rawToken: string, now: string): Promise<boolean>;
}
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;
function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
export function generateSessionToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}
export async function hashSessionToken(token: string): Promise<string> {
  if (!TOKEN.test(token)) throw new Error("Session token format is invalid.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
}
export function createSessionCookie(token: string, maxAgeSeconds: number): string {
  if (!TOKEN.test(token)) throw new Error("Session token format is invalid.");
  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds < 1 || maxAgeSeconds > 2_592_000) {
    throw new Error("Session cookie lifetime must be between 1 second and 30 days.");
  }
  return "__Host-liza_session=" + token + "; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=" + maxAgeSeconds;
}
export function clearSessionCookie(): string {
  return "__Host-liza_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}
export function readSessionCookie(cookieHeader: string | null | undefined): string | null {
  if (typeof cookieHeader !== "string" || cookieHeader.length > 8192) return null;
  let found: string | null = null;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === "__Host-liza_session") {
      if (found !== null) return null;
      found = rest.join("=");
    }
  }
  return found !== null && TOKEN.test(found) ? found : null;
}
export function createD1SessionStore(database: D1SessionDatabase): SessionStore {
  if (!database || typeof database.prepare !== "function") throw new Error("A valid D1 session database is required.");
  return {
    create: async (session) => {
      if (!ID.test(session.id) || !ID.test(session.userId) ||
          (session.workspaceId !== null && !ID.test(session.workspaceId)) ||
          !/^[a-f0-9]{64}$/.test(session.tokenHash) ||
          !Number.isFinite(Date.parse(session.createdAt)) ||
          !Number.isFinite(Date.parse(session.expiresAt)) ||
          Date.parse(session.expiresAt) <= Date.parse(session.createdAt)) {
        throw new Error("Invalid session record.");
      }
      const result = await database.prepare(
        "INSERT INTO sessions (id, user_id, workspace_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(session.id, session.userId, session.workspaceId, session.tokenHash, session.expiresAt, session.createdAt).run();
      if (result.success === false || result.meta?.changes !== 1) throw new Error("D1 session creation failed.");
    },
    getActive: async (rawToken, now) => {
      if (!validTime(now)) throw new Error("Session lookup timestamp is invalid.");
      const tokenHash = await hashSessionToken(rawToken);
      const row = await database.prepare(
        "SELECT id, user_id, workspace_id, expires_at, created_at FROM sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ? LIMIT 1",
      ).bind(tokenHash, now).first<{
        id: string; user_id: string; workspace_id: string | null; expires_at: string; created_at: string;
      }>();
      return row ? {
        id: row.id, userId: row.user_id, workspaceId: row.workspace_id,
        expiresAt: row.expires_at, createdAt: row.created_at,
      } : null;
    },
    revoke: async (rawToken, now) => {
      if (!validTime(now)) throw new Error("Session revocation timestamp is invalid.");
      const tokenHash = await hashSessionToken(rawToken);
      const result = await database.prepare(
        "UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL",
      ).bind(now, tokenHash).run();
      if (result.success === false) throw new Error("D1 session revocation failed.");
      if (result.meta?.changes === 0) return false;
      if (result.meta?.changes !== 1) throw new Error("D1 did not return a session revocation change count.");
      return true;
    },
  };
}
