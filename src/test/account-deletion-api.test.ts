import { describe, expect, it } from "vitest";
import { handleAccountDeletionRequest } from "@/lib/agents/account-deletion-api";

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
                  id: "session-1", user_id: "user-1", workspace_id: null,
                  expires_at: "2026-11-17T00:00:00.000Z",
                  created_at: "2026-11-16T00:00:00.000Z",
                } as T
              : null,
            run: async () => ({ success: true, meta: { changes: 1 } }),
            all: async <T = Record<string, unknown>>() => ({ success: true, results: [] as T[] }),
          };
        },
      };
    },
  };
  return { database, queries, bindings };
}

const url = "https://liza.example/api/account/deletion";
const cookie = "__Host-liza_session=" + "C".repeat(43);
function post(body: unknown, origin = "https://liza.example") {
  return new Request(url, {
    method: "POST",
    headers: { origin, "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

describe("account deletion request API", () => {
  it("requires same-origin requests and an active session", async () => {
    const { database } = makeDatabase();
    expect((await handleAccountDeletionRequest(post({ operation: "request" }, "https://evil.example"), { ACTION_DB: database })).status).toBe(403);
    expect((await handleAccountDeletionRequest(new Request(url, { method: "POST" }), { ACTION_DB: database })).status).toBe(403);
  });

  it("rejects JSONP media types before reading account-change bodies", async () => {
    const { database, queries } = makeDatabase();
    const request = new Request(url, {
      method: "POST",
      headers: { origin: "https://liza.example", "content-type": "application/jsonp", cookie },
      body: JSON.stringify({ operation: "request", confirmationPhrase: "DELETE MY ACCOUNT" }),
    });
    expect((await handleAccountDeletionRequest(request, { ACTION_DB: database })).status).toBe(415);
    expect(queries).toEqual([]);
  });

  it("requires the exact confirmation phrase before scheduling", async () => {
    const { database } = makeDatabase();
    const response = await handleAccountDeletionRequest(post({ operation: "request", confirmationPhrase: "delete account" }), { ACTION_DB: database });
    expect(response.status).toBe(400);
  });

  it("schedules a same-user request with a 30-day grace period", async () => {
    const { database, queries, bindings } = makeDatabase();
    const response = await handleAccountDeletionRequest(post({ operation: "request", confirmationPhrase: "DELETE MY ACCOUNT" }), { ACTION_DB: database });
    expect(response.status).toBe(201);
    const result = await response.json() as { id: string; status: string; scheduledFor: string };
    expect(result.id).toMatch(/^[a-f0-9]{32}$/);
    expect(result.status).toBe("pending");
    expect(Date.parse(result.scheduledFor) - Date.now()).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    const insert = queries.findIndex((query) => query.includes("INSERT INTO account_deletion_requests"));
    expect(bindings[insert]).toContain("user-1");
  });

  it("cancels only a pending request belonging to the active user", async () => {
    const { database, queries, bindings } = makeDatabase();
    const response = await handleAccountDeletionRequest(post({ operation: "cancel", id: "deletion-1" }), { ACTION_DB: database });
    expect(response.status).toBe(200);
    const update = queries.findIndex((query) => query.includes("UPDATE account_deletion_requests"));
    expect(bindings[update]).toContain("user-1");
    expect(bindings[update]).toContain("deletion-1");
  });
  it("returns only the active user's pending deletion request", async () => {
    const { database, queries, bindings } = makeDatabase();
    const response = await handleAccountDeletionRequest(new Request(url, {
      method: "GET", headers: { cookie },
    }), { ACTION_DB: database });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ pending: null });
    const lookup = queries.findIndex((query) => query.includes("FROM account_deletion_requests"));
    expect(lookup).toBeGreaterThanOrEqual(0);
    expect(bindings[lookup]).toContain("user-1");
  });

});
