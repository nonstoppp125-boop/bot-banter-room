import { describe, expect, it } from "vitest";
import { handleOAuthCallbackRequest } from "@/lib/agents/oauth-callback-api";
import { encryptOAuthVerifier, generateOAuthPkcePair, generateOAuthState, hashOAuthState } from "@/lib/agents/integration-hub";

const key = new Uint8Array(32).fill(9);
const keyText = btoa(String.fromCharCode(...key)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const redirectUri = "https://app.example/api/integrations/oauth/callback";

async function setup(workspaceId = "workspace-1") {
  const state = generateOAuthState();
  const stateHash = await hashOAuthState(state);
  const pkce = await generateOAuthPkcePair();
  const encryptedVerifierBlob = await encryptOAuthVerifier({
    verifier: pkce.verifier, key, provider: "instagram", userId: "user-1", workspaceId: "workspace-1",
  });
  const queries: string[] = [];
  const bindings: unknown[][] = [];
  let consumed = false;
  const database = {
    prepare(query: string) {
      queries.push(query);
      return {
        bind(...values: unknown[]) {
          bindings.push(values);
          return {
            first: async <T = Record<string, unknown>>() => {
              if (query.includes("FROM sessions")) {
                return {
                  id: "session-1", user_id: "user-1", workspace_id: workspaceId,
                  expires_at: "2026-11-17T00:00:00.000Z", created_at: "2026-11-16T00:00:00.000Z",
                } as T;
              }
              if (query.startsWith("UPDATE oauth_transactions")) {
                if (consumed) return null;
                consumed = true;
                return {
                  state_hash: stateHash, provider: "instagram", user_id: "user-1",
                  workspace_id: "workspace-1", redirect_uri: redirectUri,
                  encrypted_verifier_blob: encryptedVerifierBlob,
                  scopes_json: JSON.stringify(["instagram_business_basic", "instagram_business_content_publishing"]),
                  expires_at: new Date(Date.now() + 600_000).toISOString(),
                  created_at: new Date().toISOString(),
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
  return { state, pkce, database, queries, bindings };
}

function callbackRequest(state: string, workspaceCookie = "__Host-liza_session=" + "E".repeat(43)) {
  const url = new URL(redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code", "provider-auth-code");
  return new Request(url, { headers: { cookie: workspaceCookie } });
}

const envBase = {
  OAUTH_ENCRYPTION_KEY: keyText,
  OAUTH_INSTAGRAM_REDIRECT_URI: redirectUri,
  OAUTH_INSTAGRAM_REGISTERED_REDIRECT_URI: redirectUri,
  OAUTH_INSTAGRAM_CLIENT_ID: "client-123",
  OAUTH_INSTAGRAM_CLIENT_SECRET: "server-secret",
  OAUTH_INSTAGRAM_TOKEN_ENDPOINT: "https://graph.facebook.com/v22.0/oauth/access_token",
};

describe("OAuth callback exchange and credential persistence", () => {
  it("exchanges a valid one-time code and stores credentials only as encrypted bytes", async () => {
    const stateData = await setup();
    let sentBody = "";
    const fetcher: typeof fetch = async (_input, init) => {
      sentBody = String(init?.body ?? "");
      return new Response(JSON.stringify({
        access_token: "access-token-secret",
        refresh_token: "refresh-token-secret",
        token_type: "Bearer",
        expires_in: 3600,
        scope: "instagram_business_basic instagram_business_content_publishing",
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const response = await handleOAuthCallbackRequest(
      callbackRequest(stateData.state),
      { ...envBase, ACTION_DB: stateData.database },
      fetcher,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("connected=instagram");
    expect(sentBody).toContain("code_verifier=");
    const insert = stateData.queries.findIndex((query) => query.includes("INSERT INTO app_connections"));
    expect(insert).toBeGreaterThanOrEqual(0);
    expect(stateData.bindings[insert]?.[5]).toBeInstanceOf(Uint8Array);
    expect(stateData.bindings[insert]).not.toContain("access-token-secret");
    expect(stateData.bindings[insert]).not.toContain("refresh-token-secret");
  });

  it("rejects a transaction bound to a different workspace before token exchange", async () => {
    const stateData = await setup("workspace-2");
    let called = false;
    const fetcher: typeof fetch = async () => { called = true; return new Response("{}", { status: 200 }); };
    const response = await handleOAuthCallbackRequest(
      callbackRequest(stateData.state),
      { ...envBase, ACTION_DB: stateData.database },
      fetcher,
    );
    expect(response.status).toBe(403);
    expect(called).toBe(false);
  });

  it("rejects replayed state without exchanging a second token", async () => {
    const stateData = await setup();
    let calls = 0;
    const fetcher: typeof fetch = async () => {
      calls++;
      return new Response(JSON.stringify({ access_token: "secret", scope: "instagram_business_basic instagram_business_content_publishing" }), { status: 200 });
    };
    const first = await handleOAuthCallbackRequest(callbackRequest(stateData.state), { ...envBase, ACTION_DB: stateData.database }, fetcher);
    const second = await handleOAuthCallbackRequest(callbackRequest(stateData.state), { ...envBase, ACTION_DB: stateData.database }, fetcher);
    expect(first.status).toBe(303);
    expect(second.status).toBe(400);
    expect(calls).toBe(1);
  });

  it("rejects a token endpoint outside the provider host allowlist", async () => {
    const stateData = await setup();
    let called = false;
    const fetcher: typeof fetch = async () => { called = true; return new Response("{}", { status: 200 }); };
    const response = await handleOAuthCallbackRequest(
      callbackRequest(stateData.state),
      { ...envBase, ACTION_DB: stateData.database, OAUTH_INSTAGRAM_TOKEN_ENDPOINT: "https://evil.example/token" },
      fetcher,
    );
    expect(response.status).toBe(400);
    expect(called).toBe(false);
  });
});
