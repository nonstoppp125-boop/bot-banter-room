import { describe, expect, it } from "vitest";
import { handleConnectionRefreshRequest } from "@/lib/agents/connection-refresh-api";
import { encryptConnectionCredentials } from "@/lib/agents/integration-hub";

const key = new Uint8Array(32).fill(8);
const keyText = btoa(String.fromCharCode(...key)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const url = "https://app.example/api/integrations/refresh";
const cookie = "__Host-liza_session=" + "G".repeat(43);

async function setup(workspaceId = "workspace-1", refreshToken: string | null = "refresh-secret") {
  const blob = await encryptConnectionCredentials({
    credentials: { accessToken: "old-access-secret", refreshToken, tokenType: "Bearer", createdAt: new Date().toISOString() },
    key, provider: "instagram", userId: "user-1", workspaceId: "workspace-1",
  });
  const queries: string[] = [];
  const bindings: unknown[][] = [];
  const database = {
    prepare(query: string) {
      queries.push(query);
      return {
        bind(...values: unknown[]) {
          bindings.push(values);
          return {
            first: async <T = Record<string, unknown>>() => {
              if (query.includes("FROM sessions")) return {
                id: "session-1", user_id: "user-1", workspace_id: workspaceId,
                expires_at: "2026-11-17T00:00:00.000Z", created_at: "2026-11-16T00:00:00.000Z",
              } as T;
              if (query.includes("FROM app_connections")) {
                if (values[1] !== "workspace-1" || values[2] !== "user-1") return null;
                return {
                  id: "connection-1", provider: "instagram",
                  scopes_json: JSON.stringify(["instagram_business_basic", "instagram_business_content_publishing"]),
                  encrypted_token_blob: blob, token_expires_at: new Date(Date.now() - 1000).toISOString(),
                } as T;
              }
              return null;
            },
            run: async () => ({ success: true, meta: { changes: 1 } }),
          };
        },
      };
    },
  };
  return { database, queries, bindings };
}
function post() {
  return new Request(url, {
    method: "POST",
    headers: { origin: "https://app.example", "content-type": "application/json", cookie },
    body: JSON.stringify({ connectionId: "connection-1" }),
  });
}
const env = {
  OAUTH_ENCRYPTION_KEY: keyText,
  OAUTH_INSTAGRAM_CLIENT_ID: "client-123",
  OAUTH_INSTAGRAM_CLIENT_SECRET: "server-secret",
  OAUTH_INSTAGRAM_TOKEN_ENDPOINT: "https://graph.facebook.com/v22.0/oauth/access_token",
};

describe("owned integration token refresh", () => {
  it("refreshes only the active user's workspace connection and stores the new token encrypted", async () => {
    const state = await setup();
    let body = "";
    let redirectMode = "";
    const fetcher: typeof fetch = async (_input, init) => {
      body = String(init?.body ?? "");
      redirectMode = String(init?.redirect ?? "");
      return new Response(JSON.stringify({
        access_token: "new-access-secret", refresh_token: "new-refresh-secret",
        token_type: "Bearer", expires_in: 3600,
        scope: "instagram_business_basic instagram_business_content_publishing",
      }), { status: 200 });
    };
    const response = await handleConnectionRefreshRequest(post(), { ...env, ACTION_DB: state.database }, fetcher);
    expect(response.status).toBe(200);
    expect(body).toContain("refresh-secret");
    expect(redirectMode).toBe("error");
    expect(await response.json()).toMatchObject({ refreshed: true });
    const update = state.queries.findIndex((query) => query.includes("UPDATE app_connections"));
    expect(update).toBeGreaterThanOrEqual(0);
    expect(state.bindings[update]?.[1]).toBeInstanceOf(Uint8Array);
    expect(state.bindings[update]).not.toContain("new-access-secret");
    expect(state.bindings[update]).not.toContain("new-refresh-secret");
  });

  it("does not refresh a connection outside the active workspace", async () => {
    const state = await setup("workspace-2");
    let called = false;
    const fetcher: typeof fetch = async () => { called = true; return new Response("{}", { status: 200 }); };
    const response = await handleConnectionRefreshRequest(post(), { ...env, ACTION_DB: state.database }, fetcher);
    expect(response.status).toBe(404);
    expect(called).toBe(false);
  });

  it("requires a refresh token and never sends an unapproved provider host", async () => {
    const noRefresh = await setup("workspace-1", null);
    let called = false;
    const fetcher: typeof fetch = async () => { called = true; return new Response("{}", { status: 200 }); };
    const missing = await handleConnectionRefreshRequest(post(), { ...env, ACTION_DB: noRefresh.database }, fetcher);
    expect(missing.status).toBe(409);
    expect(called).toBe(false);
    const state = await setup();
    const badHost = await handleConnectionRefreshRequest(post(), {
      ...env, ACTION_DB: state.database, OAUTH_INSTAGRAM_TOKEN_ENDPOINT: "https://evil.example/token",
    }, fetcher);
    expect(badHost.status).toBe(400);
    expect(called).toBe(false);
  });
});
