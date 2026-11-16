import { describe, expect, it } from "vitest";
import { handleOAuthStartRequest } from "@/lib/agents/oauth-api";

function makeDatabase() {
  const queries: string[] = [];
  const bindings: unknown[][] = [];
  const database = {
    prepare(query: string) {
      queries.push(query);
      return {
        bind(...values: unknown[]) {
          bindings.push(values);
          return {
            first: async <T = Record<string, unknown>>() => query.includes("FROM sessions")
              ? {
                  id: "session-1", user_id: "user-1", workspace_id: "workspace-1",
                  expires_at: "2026-11-17T00:00:00.000Z",
                  created_at: "2026-11-16T00:00:00.000Z",
                } as T
              : null,
            run: async () => ({ success: true, meta: { changes: 1 } }),
          };
        },
      };
    },
  };
  return { database, queries, bindings };
}

const url = "https://app.example/api/integrations/oauth/start";
const cookie = "__Host-liza_session=" + "D".repeat(43);
const key = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)))
  .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");

function post(provider: string, origin = "https://app.example") {
  return new Request(url, {
    method: "POST",
    headers: { origin, "content-type": "application/json", cookie },
    body: JSON.stringify({ provider }),
  });
}

describe("OAuth authorization start API", () => {
  it("rejects cross-origin starts", async () => {
    const { database } = makeDatabase();
    const response = await handleOAuthStartRequest(post("instagram", "https://evil.example"), {
      ACTION_DB: database, OAUTH_ENCRYPTION_KEY: key,
    });
    expect(response.status).toBe(403);
  });

  it("does not start providers without an approved scope allowlist", async () => {
    const { database } = makeDatabase();
    const response = await handleOAuthStartRequest(post("linkedin"), {
      ACTION_DB: database, OAUTH_ENCRYPTION_KEY: key,
    });
    expect(response.status).toBe(400);
  });

  it("persists only a state hash and encrypted PKCE verifier before redirecting", async () => {
    const { database, queries, bindings } = makeDatabase();
    const response = await handleOAuthStartRequest(post("instagram"), {
      ACTION_DB: database,
      OAUTH_ENCRYPTION_KEY: key,
      OAUTH_INSTAGRAM_CLIENT_ID: "client-123",
      OAUTH_INSTAGRAM_AUTHORIZATION_ENDPOINT: "https://www.facebook.com/v22.0/dialog/oauth",
      OAUTH_INSTAGRAM_REDIRECT_URI: "https://app.example/api/integrations/oauth/callback/instagram",
      OAUTH_INSTAGRAM_REGISTERED_REDIRECT_URI: "https://app.example/api/integrations/oauth/callback/instagram",
    });
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    expect(location.searchParams.get("client_id")).toBe("client-123");
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("scope")).toContain("instagram_business_basic");
    const insert = queries.findIndex((query) => query.includes("INSERT OR IGNORE INTO oauth_transactions"));
    expect(insert).toBeGreaterThanOrEqual(0);
    expect(bindings[insert]?.[0]).toMatch(/^[a-f0-9]{64}$/);
    expect(bindings[insert]?.[5]).toBeInstanceOf(Uint8Array);
    expect((bindings[insert]?.[5] as Uint8Array).byteLength).toBeGreaterThan(32);
  });

  it("fails closed when provider configuration is missing", async () => {
    const { database } = makeDatabase();
    const response = await handleOAuthStartRequest(post("instagram"), {
      ACTION_DB: database, OAUTH_ENCRYPTION_KEY: key,
    });
    expect(response.status).toBe(503);
  });
});
