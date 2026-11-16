import { describe, expect, it } from "vitest";
import { handleIntegrationDisconnectRequest } from "@/lib/agents/integration-disconnect-api";

function makeDatabase(changes = 1) {
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
                  expires_at: "2026-11-17T00:00:00.000Z", created_at: "2026-11-16T00:00:00.000Z",
                } as T
              : null,
            run: async () => ({ success: true, meta: { changes } }),
          };
        },
      };
    },
  };
  return { database, queries, bindings };
}

const url = "https://app.example/api/integrations/disconnect";
const cookie = "__Host-liza_session=" + "F".repeat(43);
function post(origin = "https://app.example") {
  return new Request(url, {
    method: "POST",
    headers: { origin, "content-type": "application/json", cookie },
    body: JSON.stringify({ connectionId: "connection-1" }),
  });
}

describe("integration disconnect API", () => {
  it("rejects cross-origin requests", async () => {
    const { database } = makeDatabase();
    expect((await handleIntegrationDisconnectRequest(post("https://evil.example"), { ACTION_DB: database })).status).toBe(403);
  });

  it("clears only the active user's workspace-scoped encrypted credentials", async () => {
    const { database, queries, bindings } = makeDatabase();
    const response = await handleIntegrationDisconnectRequest(post(), { ACTION_DB: database });
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("disconnected");
    const update = queries.findIndex((query) => query.includes("UPDATE app_connections"));
    expect(update).toBeGreaterThanOrEqual(0);
    expect(queries[update]).toContain("encrypted_token_blob=NULL");
    expect(queries[update]).toContain("workspace_id=? AND user_id=?");
    expect(bindings[update]).toContain("workspace-1");
    expect(bindings[update]).toContain("user-1");
    expect(bindings[update]).toContain("connection-1");
  });

  it("does not disclose or update another user's connection", async () => {
    const { database } = makeDatabase(0);
    const response = await handleIntegrationDisconnectRequest(post(), { ACTION_DB: database });
    expect(response.status).toBe(404);
  });
});
