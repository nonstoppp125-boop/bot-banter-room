import { describe, expect, it } from "vitest";
import { handleIntegrationListRequest } from "@/lib/agents/integration-list-api";

function makeDatabase() {
  const queries: string[] = [];
  const database = {
    prepare(query: string) {
      queries.push(query);
      return {
        bind() {
          return {
            first: async <T = Record<string, unknown>>() => query.includes("FROM sessions")
              ? {
                  id: "session-1", user_id: "user-1", workspace_id: "workspace-1",
                  expires_at: "2026-11-17T00:00:00.000Z", created_at: "2026-11-16T00:00:00.000Z",
                } as T : null,
            all: async <T = Record<string, unknown>>() => ({
              success: true,
              results: [{
                id: "connection-1", provider: "instagram",
                scopes_json: JSON.stringify(["instagram_business_basic"]),
                token_expires_at: "2026-11-17T00:00:00.000Z",
                created_at: "2026-11-16T00:00:00.000Z",
                updated_at: "2026-11-16T00:00:00.000Z",
              }] as T[],
            }),
            run: async () => ({ success: true, meta: { changes: 1 } }),
          };
        },
      };
    },
  };
  return { database, queries };
}

const url = "https://app.example/api/integrations";
const cookie = "__Host-liza_session=" + "H".repeat(43);

describe("authenticated integration list API", () => {
  it("requires an active session", async () => {
    const { database } = makeDatabase();
    const response = await handleIntegrationListRequest(new Request(url), { ACTION_DB: database });
    expect(response.status).toBe(401);
  });

  it("returns only safe metadata for the active user's workspace", async () => {
    const { database, queries } = makeDatabase();
    const response = await handleIntegrationListRequest(
      new Request(url, { headers: { cookie } }),
      { ACTION_DB: database },
    );
    expect(response.status).toBe(200);
    const body = await response.json() as { connections: Array<Record<string, unknown>> };
    expect(body.connections[0]).toMatchObject({ id: "connection-1", provider: "instagram" });
    expect(body.connections[0]).not.toHaveProperty("encryptedTokenBlob");
    expect(body.connections[0]).not.toHaveProperty("accessToken");
    const query = queries.find((item) => item.includes("FROM app_connections")) ?? "";
    expect(query).not.toContain("encrypted_token_blob");
    expect(query).toContain("workspace_id=? AND user_id=?");
  });
});
