import { describe, expect, it } from "vitest";
import { handlePasswordLogin, handleSessionStatus } from "@/lib/agents/password-auth";

async function encodedHash(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 310_000 }, key, 256,
  ));
  const b64 = (bytes: Uint8Array) => {
    let raw = ""; for (const byte of bytes) raw += String.fromCharCode(byte);
    return btoa(raw).replace(/\\+/g, "-").replace(/\\//g, "_").replace(/=+$/g, "");
  };
  return "pbkdf2$310000$" + b64(salt) + "$" + b64(bits);
}
function database() {
  const users = new Set<string>();
  const sessions = new Map<string, Record<string, unknown>>();
  return {
    prepare(query: string) {
      return {
        bind(...values: unknown[]) {
          return {
            run: async () => {
              if (query.startsWith("INSERT INTO users")) users.add(String(values[0]));
              if (query.startsWith("INSERT INTO sessions")) sessions.set(String(values[3]), {
                id: values[0], user_id: values[1], workspace_id: values[2], token_hash: values[3],
                expires_at: values[4], created_at: values[5], revoked_at: null,
              });
              return { success: true, meta: { changes: 1 } };
            },
            first: async <T = Record<string, unknown>>() => {
              if (query.includes("SELECT attempts")) return { attempts: 1 } as T;
              if (query.includes("SELECT id FROM users")) return users.has(String(values[0])) ? { id: values[0] } as T : null;
              if (query.includes("FROM sessions")) {
                const row = sessions.get(String(values[0]));
                return row && String(row["expires_at"]) > String(values[1]) ? row as T : null;
              }
              return null;
            },
          };
        },
      };
    },
  };
}
const env = { ACTION_DB: database(), LIZA_AUTH_EMAIL: "owner@example.com", LIZA_AUTH_PASSWORD_HASH: "" };
function request(body: unknown, origin = "https://liza.example") {
  return new Request("https://liza.example/api/auth/login", {
    method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  });
}
describe("first-party password authentication", () => {
  it("rejects cross-origin login", async () => {
    const response = await handlePasswordLogin(request({ email: env.LIZA_AUTH_EMAIL, password: "correct horse battery" }, "https://evil.example"), env);
    expect(response.status).toBe(403);
  });
  it("creates a workspace session after valid owner credentials", async () => {
    const password = "correct horse battery staple";
    env.LIZA_AUTH_PASSWORD_HASH = await encodedHash(password);
    const response = await handlePasswordLogin(request({ email: env.LIZA_AUTH_EMAIL, password }), env);
    expect(response.status).toBe(204);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__Host-liza_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
  });
  it("rejects invalid credentials and requires a session for status", async () => {
    env.LIZA_AUTH_PASSWORD_HASH = await encodedHash("another long password");
    const response = await handlePasswordLogin(request({ email: env.LIZA_AUTH_EMAIL, password: "wrong" }), env);
    expect(response.status).toBe(401);
    expect((await handleSessionStatus(new Request("https://liza.example/api/auth/session"), env)).status).toBe(401);
  });
  it("rejects malformed password hash configuration", async () => {
    env.LIZA_AUTH_PASSWORD_HASH = "plaintext";
    expect((await handlePasswordLogin(request({ email: env.LIZA_AUTH_EMAIL, password: "x" }), env)).status).toBe(503);
  });
});
